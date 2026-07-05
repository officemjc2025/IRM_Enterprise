import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: resId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: extensions, error } = await supabase
      .from("reservation_extensions")
      .select(`
        *,
        requested_by_profile:requested_by (id, full_name, display_name),
        approved_by_profile:approved_by (id, full_name, display_name)
      `)
      .eq("reservation_id", resId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: extensions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: resId } = await params;
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

    const { data: reservation } = await supabase
      .from("reservations")
      .select("property_id, check_out_at")
      .eq("id", resId)
      .single();

    if (!reservation) {
      return NextResponse.json({ success: false, message: "Reservation not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || reservation.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const {
      requested_check_out_at,
      pricing_method,
      calculated_amount,
      approved_amount,
      reason
    } = body;

    if (!requested_check_out_at || !pricing_method) {
      return NextResponse.json({ success: false, message: "requested_check_out_at and pricing_method are required" }, { status: 400 });
    }

    const previousCheckOut = reservation.check_out_at;
    if (new Date(requested_check_out_at) <= new Date(previousCheckOut)) {
      return NextResponse.json({ success: false, message: "New checkout date must be after previous checkout date" }, { status: 400 });
    }

    const { data: extension, error: insertErr } = await supabase
      .from("reservation_extensions")
      .insert({
        reservation_id: resId,
        previous_check_out_at: previousCheckOut,
        requested_check_out_at,
        pricing_method,
        calculated_amount: calculated_amount ? parseFloat(calculated_amount) : null,
        approved_amount: approved_amount ? parseFloat(approved_amount) : null,
        reason: reason || null,
        status: "PENDING_APPROVAL",
        requested_by: user.id
      })
      .select("*")
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, data: extension });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
