import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    if (!profile || !["super_admin", "admin", "property_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { cycle_id, readings } = body;

    if (!cycle_id || !Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid payload format" }, { status: 400 });
    }

    // 1. Fetch cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from("meter_reading_cycles")
      .select("*")
      .eq("id", cycle_id)
      .single();

    if (cycleErr || !cycle) {
      return NextResponse.json({ success: false, message: "Cycle not found" }, { status: 404 });
    }

    // Property Scope Check
    if (profile.role === "property_admin") {
      if (!profile.property_id || cycle.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property import denied" }, { status: 403 });
      }
    }

    if (!["OPEN", "IN_PROGRESS"].includes(cycle.status)) {
      return NextResponse.json({ success: false, message: "Cycle is not in an active open status" }, { status: 400 });
    }

    // 2. Batch fetch existing readings for this cycle
    const { data: existingReadings, error: fetchReadingsErr } = await supabase
      .from("meter_readings")
      .select("*")
      .eq("cycle_id", cycle_id);

    if (fetchReadingsErr || !existingReadings) {
      throw new Error(`Failed to load cycle readings: ${fetchReadingsErr?.message}`);
    }

    const readingsMap = new Map(existingReadings.map(r => [r.id, r]));

    // 3. Resolve active rate snapshot
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: activeRate } = await supabase
      .from("utility_rates")
      .select("rate_per_unit, treatment_rate_per_unit")
      .eq("property_id", cycle.property_id)
      .eq("utility_type", cycle.utility_type)
      .eq("is_active", true)
      .lte("effective_from", todayStr)
      .or(`effective_to.gte.${todayStr},effective_to.is.null`)
      .limit(1)
      .maybeSingle();

    const rateSnapshot = activeRate ? Number(activeRate.rate_per_unit) : 0.00;
    const globalTreatmentRateSnapshot = (activeRate && cycle.utility_type === "WATER") ? Number(activeRate.treatment_rate_per_unit) : 0.00;

    // 4. Fetch all active stays for unit occupancy check (used in zero usage anomaly detection)
    const { data: activeStays } = await supabase
      .from("reservations")
      .select("unit_id")
      .eq("status", "CHECKED_IN");

    const occupiedUnitIds = new Set(activeStays?.map(s => s.unit_id) || []);

    // 5. Server-side validation run (All-or-nothing check before any updates)
    const validatedUpdates = [];
    const processedMeterIds = new Set<string>();
    const processedReadingIds = new Set<string>();

    for (const row of readings) {
      const { reading_id, current_reading, technician_note } = row;

      if (!reading_id || current_reading === undefined || current_reading === null || String(current_reading).trim() === "") {
        return NextResponse.json({ success: false, message: "Each row must contain a reading_id and current_reading" }, { status: 400 });
      }

      const currReading = Number(current_reading);
      if (isNaN(currReading) || currReading < 0) {
        return NextResponse.json({ success: false, message: `Reading value ${current_reading} is not valid` }, { status: 400 });
      }

      const existing = readingsMap.get(reading_id);
      if (!existing) {
        return NextResponse.json({ success: false, message: `Reading ID ${reading_id} does not exist in this cycle` }, { status: 404 });
      }

      if (processedReadingIds.has(reading_id)) {
        return NextResponse.json({ success: false, message: `Duplicate Reading ID ${reading_id} detected in import file` }, { status: 400 });
      }
      processedReadingIds.add(reading_id);

      if (processedMeterIds.has(existing.meter_id)) {
        return NextResponse.json({ success: false, message: `Duplicate meter record for ID ${existing.meter_id} in import file` }, { status: 400 });
      }
      processedMeterIds.add(existing.meter_id);

      if (existing.status === "APPROVED") {
        return NextResponse.json({ success: false, message: `Reading ID ${reading_id} has already been APPROVED and cannot be modified` }, { status: 400 });
      }

      const prevReading = Number(existing.previous_reading);
      if (currReading < prevReading) {
        return NextResponse.json({
          success: false,
          message: `เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน (ห้อง: ${existing.unit_id}, ครั้งก่อน: ${prevReading}, ที่กรอก: ${currReading})`
        }, { status: 400 });
      }

      const usage = currReading - prevReading;
      const amount = usage * rateSnapshot;
      const treatmentRateSnapshot = existing.utility_type === "WATER" ? globalTreatmentRateSnapshot : 0.00;
      const treatmentAmount = existing.utility_type === "WATER" ? (usage * treatmentRateSnapshot) : 0.00;

      // Anomaly detection
      let anomalyStatus: string = "NORMAL";
      let anomalyReason: string | null = null;

      // Fetch past readings for this unit (done in-loop for simplicity or we could optimize, but since it's a few rows, standard API handles it cleanly)
      const { data: pastReadings } = await supabase
        .from("meter_readings")
        .select("usage_units")
        .eq("unit_id", existing.unit_id)
        .eq("utility_type", existing.utility_type)
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);

      if (pastReadings && pastReadings.length > 0) {
        const sum = pastReadings.reduce((acc, r) => acc + Number(r.usage_units), 0);
        const avg = sum / pastReadings.length;
        if (usage > 50 && usage > avg * 1.85) {
          anomalyStatus = "HIGH_USAGE";
          const pct = Math.round((usage / (avg || 1)) * 100);
          const typeLabel = existing.utility_type === "WATER" ? "น้ำ" : "ไฟ";
          anomalyReason = `การใช้${typeLabel}สูงกว่าค่าเฉลี่ยย้อนหลัง 3 รอบ ${pct}%`;
        }
      }

      if (usage === 0 && occupiedUnitIds.has(existing.unit_id)) {
        anomalyStatus = "ZERO_USAGE";
        anomalyReason = "ไม่มีการใช้บริการทั้งที่มีผู้พักอาศัย";
      }

      validatedUpdates.push({
        id: reading_id,
        before: existing,
        data: {
          current_reading: currReading,
          usage_units: usage,
          rate_per_unit_snapshot: rateSnapshot,
          calculated_amount: amount,
          treatment_rate_snapshot: treatmentRateSnapshot,
          treatment_amount: treatmentAmount,
          status: "REVIEW", // Submits to Review state
          anomaly_status: anomalyStatus,
          anomaly_reason: anomalyReason,
          technician_note: technician_note || null,
          recorded_by: user.id,
          recorded_at: new Date().toISOString()
        }
      });
    }

    // 6. Perform the updates (All-or-nothing validation passed)
    let successCount = 0;
    let warningCount = 0;

    for (const update of validatedUpdates) {
      const { data: updatedReading, error: updateErr } = await supabase
        .from("meter_readings")
        .update(update.data)
        .eq("id", update.id)
        .select("*")
        .single();

      if (updateErr) {
        throw new Error(`Failed to update reading ID ${update.id}: ${updateErr.message}`);
      }

      if (update.data.anomaly_status !== "NORMAL") {
        warningCount++;
      }
      successCount++;

      // Log audit trail
      await supabase.rpc("log_entity_change", {
        p_entity_type: "meter_readings",
        p_entity_id: update.id,
        p_action_type: "EDIT",
        p_changed_fields: { before: update.before, after: updatedReading, source: "EXCEL_IMPORT" },
        p_reason: "Import meter reading from Excel template"
      });
    }

    return NextResponse.json({
      success: true,
      total: validatedUpdates.length,
      imported: successCount,
      warnings: warningCount,
      failed: 0
    });
  } catch (error: unknown) {
    console.error("Batch import error:", error);
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
