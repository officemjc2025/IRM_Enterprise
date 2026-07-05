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
      return NextResponse.json({ success: false, message: "Forbidden: worker and resident roles cannot access service bookings" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const serviceType = searchParams.get("service_type");
    const status = searchParams.get("status");
    const propertyId = searchParams.get("property_id");
    const search = searchParams.get("search");

    let query = supabase
      .from("service_bookings")
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        customer:customer_person_id (id, first_name, last_name, display_name),
        work_order:work_order_id (*)
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

    if (serviceType && serviceType !== "ALL") {
      query = query.eq("service_type", serviceType);
    }

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (startStr) {
      query = query.gte("requested_start_at", startStr);
    }

    if (endStr) {
      query = query.lte("requested_start_at", endStr);
    }

    const { data: bookings, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    let filtered = bookings || [];
    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter((b) => {
        const num = b.booking_number.toLowerCase();
        const unit = b.unit ? b.unit.unit_number.toLowerCase() : "";
        const note = b.customer_note ? b.customer_note.toLowerCase() : "";
        return num.includes(term) || unit.includes(term) || note.includes(term);
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
      customer_person_id,
      service_type,
      requested_start_at,
      requested_end_at,
      customer_note,
      admin_note,
      quoted_amount,
      confirmed_amount
    } = body;

    if (!property_id || !unit_id || !service_type || !requested_start_at) {
      return NextResponse.json({ success: false, message: "property_id, unit_id, service_type, and requested_start_at are required" }, { status: 400 });
    }

    // Property Admin Scope Validation
    if (profile.role === "property_admin") {
      if (!profile.property_id || property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property_admin must only write for their assigned property" }, { status: 403 });
      }
    }

    const { data: booking, error: insertErr } = await supabase
      .from("service_bookings")
      .insert({
        property_id,
        unit_id,
        customer_person_id: customer_person_id || null,
        service_type,
        requested_start_at,
        requested_end_at: requested_end_at || null,
        customer_note: customer_note || null,
        admin_note: admin_note || null,
        quoted_amount: quoted_amount ? parseFloat(quoted_amount) : null,
        confirmed_amount: confirmed_amount ? parseFloat(confirmed_amount) : null,
        status: "PENDING_CONFIRMATION", // default status
        created_by: user.id
      })
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        customer:customer_person_id (id, first_name, last_name, display_name)
      `)
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, data: booking });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
