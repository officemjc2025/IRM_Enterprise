import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const reservationType = searchParams.get("reservation_type");
    const status = searchParams.get("status");
    const propertyId = searchParams.get("property_id");
    const search = searchParams.get("search");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
        work_orders:work_orders (*)
      `)
      .order("created_at", { ascending: false });

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id) {
        return NextResponse.json({ success: true, data: [] });
      }
      query = query.eq("property_id", profile.property_id);
    } else if (propertyId && propertyId !== "ALL") {
      query = query.eq("property_id", propertyId);
    }

    if (reservationType && reservationType !== "ALL") {
      query = query.eq("reservation_type", reservationType);
    }

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (startStr) {
      query = query.gte("check_in_at", startStr);
    }

    if (endStr) {
      query = query.lte("check_in_at", endStr);
    }

    const { data: reservations, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    let filtered = reservations || [];
    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const num = r.reservation_number.toLowerCase();
        const unit = r.unit ? r.unit.unit_number.toLowerCase() : "";
        const ref = r.external_reference ? r.external_reference.toLowerCase() : "";
        const note = r.guest_note ? r.guest_note.toLowerCase() : "";
        return num.includes(term) || unit.includes(term) || ref.includes(term) || note.includes(term);
      });
    }

    // Limit list history to max 100 entries for performance bounds
    return NextResponse.json({ success: true, data: filtered.slice(0, 100) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      property_id,
      unit_id,
      primary_guest_person_id,
      reservation_type,
      billing_basis,
      check_in_at,
      check_out_at,
      adult_count,
      child_count,
      monthly_rate,
      daily_rate,
      base_rental_amount,
      discount_amount,
      deposit_amount,
      calculated_total_amount,
      approved_total_amount,
      currency,
      booking_channel,
      external_reference,
      guest_note,
      internal_note
    } = body;

    if (!property_id || !unit_id || !reservation_type || !check_in_at || !check_out_at) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // Date integrity
    if (new Date(check_out_at) <= new Date(check_in_at)) {
      return NextResponse.json({ success: false, message: "Check-out date must be after check-in date" }, { status: 400 });
    }

    // Property Admin Scope Validation
    if (profile.role === "property_admin") {
      if (!profile.property_id || property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property_admin must only write for their assigned property" }, { status: 403 });
      }
    }

    // Unit belongs to property validation
    const { data: unitCheck } = await supabase
      .from("units")
      .select("property_id")
      .eq("id", unit_id)
      .single();

    if (!unitCheck || unitCheck.property_id !== property_id) {
      return NextResponse.json({ success: false, message: "Unit does not belong to the selected property" }, { status: 400 });
    }

    // Amounts validation
    if (
      (monthly_rate !== undefined && monthly_rate < 0) ||
      (daily_rate !== undefined && daily_rate < 0) ||
      (base_rental_amount !== undefined && base_rental_amount < 0) ||
      (discount_amount !== undefined && discount_amount < 0) ||
      (deposit_amount !== undefined && deposit_amount < 0)
    ) {
      return NextResponse.json({ success: false, message: "Amounts must be non-negative" }, { status: 400 });
    }

    // Server-side overlap protection check (only blocking CONFIRMED and CHECKED_IN stay periods)
    const { data: overlaps } = await supabase
      .from("reservations")
      .select("id")
      .eq("unit_id", unit_id)
      .in("status", ["CONFIRMED", "CHECKED_IN"])
      .lt("check_in_at", check_out_at)
      .gt("check_out_at", check_in_at);

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ success: false, message: "Unit booking overlap conflict: This unit is already reserved or occupied during the selected date range." }, { status: 400 });
    }

    const { data: reservation, error: insertErr } = await supabase
      .from("reservations")
      .insert({
        property_id,
        unit_id,
        primary_guest_person_id: primary_guest_person_id || null,
        reservation_type,
        billing_basis: billing_basis || "MONTHLY",
        check_in_at,
        check_out_at,
        adult_count: adult_count || 1,
        child_count: child_count || 0,
        monthly_rate: monthly_rate ? parseFloat(monthly_rate) : null,
        daily_rate: daily_rate ? parseFloat(daily_rate) : null,
        base_rental_amount: base_rental_amount ? parseFloat(base_rental_amount) : null,
        extension_amount: 0.00,
        discount_amount: discount_amount ? parseFloat(discount_amount) : 0.00,
        deposit_amount: deposit_amount ? parseFloat(deposit_amount) : 0.00,
        calculated_total_amount: calculated_total_amount ? parseFloat(calculated_total_amount) : null,
        approved_total_amount: approved_total_amount ? parseFloat(approved_total_amount) : null,
        currency: currency || "THB",
        booking_channel: booking_channel || null,
        external_reference: external_reference || null,
        guest_note: guest_note || null,
        internal_note: internal_note || null,
        status: "PENDING_CONFIRMATION", // default status
        created_by: user.id
      })
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        primary_guest:primary_guest_person_id (id, first_name, last_name, display_name)
      `)
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, data: reservation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
