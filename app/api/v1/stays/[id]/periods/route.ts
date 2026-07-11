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
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: reservation } = await supabase
      .from("reservations")
      .select("property_id")
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

    const { data: periods, error } = await supabase
      .from("stay_charge_periods")
      .select("*")
      .eq("reservation_id", resId)
      .order("period_start", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: periods });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// Generate missing stay charge periods idempotently
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
      .select("*")
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

    const start = new Date(reservation.check_in_at);
    const end = new Date(reservation.check_out_at);

    // Generate monthly periods aligned with migration 029
    const periodsToInsert: Record<string, unknown>[] = [];
    let currentStart = new Date(start);
    let isFirstPeriod = true;

    while (currentStart < end) {
      const nextMonth = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
      const endOfMonth = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
      const periodEnd = endOfMonth < end ? endOfMonth : new Date(end);

      const startStr = currentStart.toISOString().split("T")[0];
      const endStr = periodEnd.toISOString().split("T")[0];

      const dueStart = new Date(currentStart.getFullYear(), currentStart.getMonth(), 5);
      const calculatedDue = dueStart < periodEnd ? dueStart : periodEnd;
      const finalDue = calculatedDue > currentStart ? calculatedDue : currentStart;
      const dueStr = finalDue.toISOString().split("T")[0];

      let rent = reservation.monthly_rate || 0;
      if (reservation.billing_basis === "DAILY") {
        let daysInPeriod = 0;
        if (periodEnd.getTime() === end.getTime()) {
          daysInPeriod = Math.max(0, Math.ceil((end.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          daysInPeriod = Math.max(0, Math.ceil((nextMonth.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)));
        }
        rent = (reservation.daily_rate || 0) * daysInPeriod;
      }

      const discount = isFirstPeriod ? (reservation.discount_amount || 0) : 0;
      isFirstPeriod = false;

      const expectedTotal = Math.max(0, rent - discount);

      periodsToInsert.push({
        reservation_id: resId,
        property_id: reservation.property_id,
        unit_id: reservation.unit_id,
        period_start: startStr,
        period_end: endStr,
        due_date: dueStr,
        rent_amount: rent,
        discount_amount: discount,
        expected_total: expectedTotal,
        outstanding_amount: expectedTotal,
        overall_status: "NOT_READY"
      });

      currentStart = nextMonth;
    }

    // Insert using upsert logic matching unique key uq_reservation_period
    const { data: inserted, error: upsertErr } = await supabase
      .from("stay_charge_periods")
      .upsert(periodsToInsert, { onConflict: "reservation_id, period_start, period_end" })
      .select("*");

    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      success: true,
      message: "Stay charge periods generated successfully",
      data: inserted
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
