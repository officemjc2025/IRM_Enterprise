import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: readingId } = await params;
    const body = await request.json();
    const { manager_note } = body;

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

    const isAdmin = profile && ["super_admin", "admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Technicians are not allowed to approve readings" }, { status: 403 });
    }

    const { data: reading, error: fetchErr } = await supabase
      .from("meter_readings")
      .select(`
        *,
        cycle:cycle_id (*)
      `)
      .eq("id", readingId)
      .single();

    if (fetchErr || !reading) {
      return NextResponse.json({ success: false, message: "Reading record not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || reading.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property approval denied" }, { status: 403 });
      }
    }

    if (reading.status !== "REVIEW") {
      return NextResponse.json({ success: false, message: "Reading is not in REVIEW state" }, { status: 400 });
    }

    // Resolve commercial integration stay charge period
    let syncStatus: string = "NOT_APPLICABLE";
    let linkedPeriodId: string | null = null;
    let syncErrorMsg: string | null = null;

    // A. Find check_in stays for the unit
    const { data: stays } = await supabase
      .from("reservations")
      .select("id")
      .eq("unit_id", reading.unit_id)
      .eq("status", "CHECKED_IN");

    if (stays && stays.length > 0) {
      // Find stay charge period where period_start matches billing month YYYY-MM
      const stayIds = stays.map(s => s.id);
      const billingMonth = reading.cycle.billing_month; // YYYY-MM

      const { data: periods } = await supabase
        .from("stay_charge_periods")
        .select("*")
        .in("reservation_id", stayIds)
        .order("period_start", { ascending: true });

      const matchingPeriod = periods?.find(p => p.period_start.startsWith(billingMonth));

      if (matchingPeriod) {
        linkedPeriodId = matchingPeriod.id;

        // Guard: Do not modify a PAID period
        if (matchingPeriod.overall_status === "PAID" || matchingPeriod.water_status === "PAID" || matchingPeriod.electricity_status === "PAID") {
          syncStatus = "SYNC_FAILED";
          syncErrorMsg = "Cannot synchronize charge to an already paid billing period.";
        } else {
          // Perform charge synchronization
          const updatePeriodData: Record<string, unknown> = {};
          if (reading.utility_type === "WATER") {
            updatePeriodData.water_amount = Number(reading.calculated_amount);
            updatePeriodData.water_status = "READY";
          } else {
            updatePeriodData.electricity_amount = Number(reading.calculated_amount);
            updatePeriodData.electricity_status = "READY";
          }

          const { error: periodUpdateErr } = await supabase
            .from("stay_charge_periods")
            .update(updatePeriodData)
            .eq("id", matchingPeriod.id);

          if (periodUpdateErr) {
            syncStatus = "SYNC_FAILED";
            syncErrorMsg = periodUpdateErr.message;
          } else {
            syncStatus = "SYNCED";
          }
        }
      } else {
        syncStatus = "PENDING_PERIOD";
      }
    }

    if (syncStatus === "SYNC_FAILED" && syncErrorMsg) {
      return NextResponse.json({ success: false, message: syncErrorMsg }, { status: 409 });
    }

    const { data: approvedReading, error: updateErr } = await supabase
      .from("meter_readings")
      .update({
        status: "APPROVED",
        sync_status: syncStatus,
        linked_stay_charge_period_id: linkedPeriodId,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        manager_note: manager_note || null,
        recheck_requested: false
      })
      .eq("id", readingId)
      .eq("status", "REVIEW")
      .select("*")
      .single();

    if (updateErr || !approvedReading) {
      return NextResponse.json({
        success: false,
        message: "Reading task is no longer in a reviewable state or has been modified by another user"
      }, { status: 409 });
    }

    // Log entity change
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_readings",
      p_entity_id: readingId,
      p_action_type: "EDIT",
      p_changed_fields: { before: reading, after: approvedReading },
      p_reason: "Approve meter reading and synchronize charges"
    });

    return NextResponse.json({ success: true, data: approvedReading });
  } catch (error: unknown) {
    const err = error as Record<string, unknown> | null;
    const code = err?.code;
    const msg = err?.message;
    if (code === "42P01" || (typeof msg === "string" && msg.includes("relation") && msg.includes("does not exist"))) {
      return NextResponse.json({
        success: false,
        code: "UTILITY_INFRASTRUCTURE_NOT_READY",
        message: "ระบบมิเตอร์และสาธารณูปโภคยังไม่พร้อมใช้งาน"
      }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
