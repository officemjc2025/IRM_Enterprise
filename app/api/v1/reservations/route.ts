import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const reservationType = searchParams.get("reservation_type");
    const status = searchParams.get("status");
    const propertyId = searchParams.get("property_id");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
        work_orders:work_orders!work_orders_stay_id_fkey (*)
      `)
      .order("created_at", { ascending: false });

    // Authorization Enforcer
    if (scope.isFullScope) {
      if (scope.role === "property_admin") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("property_id")
          .eq("id", scope.profileId)
          .single();

        if (!profile?.property_id) {
          return NextResponse.json({ success: true, data: [] });
        }
        query = query.eq("property_id", profile.property_id);
      } else if (propertyId && propertyId !== "ALL") {
        query = query.eq("property_id", propertyId);
      }
    } else {
      if (!scope.authorizedUnitIds || scope.authorizedUnitIds.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      query = query.in("unit_id", scope.authorizedUnitIds);
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

    return NextResponse.json({
      success: true,
      message: "Reservations retrieved successfully",
      data: reservations || []
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve reservations";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const body = await request.json();
    const {
      property_id,
      unit_id,
      reservation_type,
      check_in_at,
      check_out_at,
      monthly_rate,
      daily_rate,
      base_rental_amount,
      discount_amount,
      deposit_amount,
      currency,
      booking_channel,
      external_reference,
      guest_note,
      internal_note
    } = body;

    if (!property_id || !unit_id || !reservation_type || !check_in_at || !check_out_at) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    if (!scope.isFullScope && !scope.isUnitAuthorized(unit_id)) {
      return NextResponse.json({ success: false, message: "Forbidden: You are not authorized to create reservations for this unit." }, { status: 403 });
    }

    if (new Date(check_out_at) <= new Date(check_in_at)) {
      return NextResponse.json({ success: false, message: "Check-out date must be after check-in date" }, { status: 400 });
    }

    if (scope.role === "property_admin") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("property_id")
        .eq("id", scope.profileId)
        .single();

      if (!profile?.property_id || property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property_admin must only write for their assigned property" }, { status: 403 });
      }
    }

    const { data: unitCheck } = await supabase
      .from("unit")
      .select("property_id")
      .eq("id", unit_id)
      .single();

    if (!unitCheck || unitCheck.property_id !== property_id) {
      return NextResponse.json({ success: false, message: "Unit does not belong to the selected property" }, { status: 400 });
    }

    if (
      (monthly_rate !== undefined && monthly_rate < 0) ||
      (daily_rate !== undefined && daily_rate < 0) ||
      (base_rental_amount !== undefined && base_rental_amount < 0) ||
      (discount_amount !== undefined && discount_amount < 0) ||
      (deposit_amount !== undefined && deposit_amount < 0)
    ) {
      return NextResponse.json({ success: false, message: "Amounts must be non-negative" }, { status: 400 });
    }

    const { data: overlaps } = await supabase
      .from("reservations")
      .select("id")
      .eq("unit_id", unit_id)
      .in("status", ["CONFIRMED", "CHECKED_IN"])
      .lt("check_in_at", check_out_at)
      .gt("check_out_at", check_in_at);

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ success: false, message: "Reservation overlaps with an existing confirmed stay period" }, { status: 409 });
    }

    const payload = {
      property_id,
      unit_id,
      reservation_type,
      check_in_at,
      check_out_at,
      status: "DRAFT",
      monthly_rate: monthly_rate !== undefined ? monthly_rate : null,
      daily_rate: daily_rate !== undefined ? daily_rate : null,
      base_rental_amount: base_rental_amount !== undefined ? base_rental_amount : null,
      discount_amount: discount_amount !== undefined ? discount_amount : 0,
      deposit_amount: deposit_amount !== undefined ? deposit_amount : 0,
      currency: currency || "THB",
      booking_channel: booking_channel || "DIRECT",
      external_reference: external_reference ? external_reference.trim() : null,
      guest_note: guest_note ? guest_note.trim() : null,
      internal_note: internal_note ? internal_note.trim() : null,
      created_by: scope.profileId
    };

    const { data: created, error: insertErr } = await supabase
      .from("reservations")
      .insert([payload])
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number)
      `)
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      message: "Reservation created successfully",
      data: created
    });
  } catch (error: unknown) {
    console.error("POST RESERVATIONS ERROR:", error);
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create reservation";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
