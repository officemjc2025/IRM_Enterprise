import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: cycleId } = await params;

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

    const isAuthorized = profile && ["super_admin", "admin", "property_admin"].includes(profile.role);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // 1. Fetch cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from("meter_reading_cycles")
      .select("*")
      .eq("id", cycleId)
      .single();

    if (cycleErr || !cycle) {
      return NextResponse.json({ success: false, message: "Meter reading cycle not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || cycle.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property cycle action denied" }, { status: 403 });
      }
    }

    if (cycle.status !== "DRAFT") {
      return NextResponse.json({ success: false, message: "Cycle is not in DRAFT status" }, { status: 400 });
    }

    // 1.5 Fetch all units for this property
    const { data: units, error: unitsErr } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", cycle.property_id);

    if (unitsErr) throw unitsErr;

    // 2. Fetch all active meters for this property and utility type
    const { data: meters, error: metersErr } = await supabase
      .from("utility_meters")
      .select("*")
      .eq("property_id", cycle.property_id)
      .eq("utility_type", cycle.utility_type)
      .eq("meter_status", "ACTIVE");

    if (metersErr) throw metersErr;

    if (!meters || meters.length === 0) {
      return NextResponse.json({
        success: false,
        message: "ไม่สามารถเปิดรอบจดมิเตอร์ได้เนื่องจากไม่พบมิเตอร์ที่พร้อมใช้งานในโครงการสำหรับประเภทสาธารณูปโภคที่เลือก กรุณาลงทะเบียนทะเบียนมิเตอร์ก่อนดำเนินการ"
      }, { status: 400 });
    }

    const meteredUnitIds = new Set(meters.map(m => m.unit_id));
    const roomsWithoutMeter = units ? units.filter(u => !meteredUnitIds.has(u.id)).length : 0;

    const readingsToInsert: Record<string, unknown>[] = [];

    // For each meter, find latest approved reading
    for (const meter of meters) {
      const { data: lastReading } = await supabase
        .from("meter_readings")
        .select("current_reading")
        .eq("meter_id", meter.id)
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(1);

      let prevVal = 0.00;
      if (lastReading && lastReading.length > 0) {
        prevVal = Number(lastReading[0].current_reading);
      } else {
        // Fallback: check replacement/starting reading if any
        const { data: replacement } = await supabase
          .from("meter_replacement_history")
          .select("starting_reading")
          .eq("new_meter_id", meter.id)
          .single();
        if (replacement) {
          prevVal = Number(replacement.starting_reading);
        } else {
          prevVal = Number((meter as Record<string, unknown>).initial_reading || 0.00);
        }
      }

      readingsToInsert.push({
        cycle_id: cycleId,
        meter_id: meter.id,
        property_id: cycle.property_id,
        unit_id: meter.unit_id,
        utility_type: cycle.utility_type,
        previous_reading: prevVal,
        status: "PENDING",
        anomaly_status: "NORMAL",
        sync_status: "NOT_APPLICABLE"
      });
    }

    if (readingsToInsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from("meter_readings")
        .upsert(readingsToInsert, { onConflict: "cycle_id, meter_id" });

      if (upsertErr) throw upsertErr;
    }

    // Update cycle status to OPEN
    const { data: updatedCycle, error: updateErr } = await supabase
      .from("meter_reading_cycles")
      .update({
        status: "OPEN",
        opened_at: new Date().toISOString()
      })
      .eq("id", cycleId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // Audit Log
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_reading_cycles",
      p_entity_id: cycleId,
      p_action_type: "EDIT",
      p_changed_fields: { before: cycle, after: updatedCycle },
      p_reason: "Open meter reading cycle and generate tasks"
    });

    return NextResponse.json({
      success: true,
      message: "เปิดรอบจดมิเตอร์สำเร็จ",
      summary: {
        meters_found: meters.length,
        readings_created: readingsToInsert.length,
        rooms_without_meter: roomsWithoutMeter
      },
      data: updatedCycle
    });
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
