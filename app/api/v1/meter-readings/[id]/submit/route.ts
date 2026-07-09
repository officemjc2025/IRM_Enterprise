import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: readingId } = await params;
    const body = await request.json();
    const { current_reading, photo_url, technician_note, is_anomaly_flagged } = body;

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

    if (!profile) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: reading, error: fetchErr } = await supabase
      .from("meter_readings")
      .select("*")
      .eq("id", readingId)
      .single();

    if (fetchErr || !reading) {
      return NextResponse.json({ success: false, message: "Reading task not found" }, { status: 404 });
    }

    // Property Scope Check
    if (profile.role === "property_admin" || profile.role === "technician") {
      if (!profile.property_id || reading.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property scope mismatch" }, { status: 403 });
      }
    }

    if (!["PENDING", "REJECTED"].includes(reading.status)) {
      return NextResponse.json({ success: false, message: "Reading is not in a submittable state" }, { status: 400 });
    }

    const prevReading = Number(reading.previous_reading);
    const currReading = Number(current_reading);

    if (currReading < prevReading) {
      return NextResponse.json({
        success: false,
        message: `เลขมิเตอร์ครั้งปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน (${prevReading.toLocaleString()})`
      }, { status: 400 });
    }

    const usage = currReading - prevReading;

    // Resolve active utility rate snapshot
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: activeRate } = await supabase
      .from("utility_rates")
      .select("rate_per_unit, treatment_rate_per_unit")
      .eq("property_id", reading.property_id)
      .eq("utility_type", reading.utility_type)
      .eq("is_active", true)
      .lte("effective_from", todayStr)
      .or(`effective_to.gte.${todayStr},effective_to.is.null`)
      .limit(1)
      .maybeSingle();

    const rateSnapshot = activeRate ? Number(activeRate.rate_per_unit) : 0.00;
    const treatmentRateSnapshot = (activeRate && reading.utility_type === "WATER") ? Number(activeRate.treatment_rate_per_unit) : 0.00;
    const amount = usage * rateSnapshot;
    const treatmentAmount = reading.utility_type === "WATER" ? (usage * treatmentRateSnapshot) : 0.00;

    // Anomaly Detection
    let anomalyStatus: string = "NORMAL";
    let anomalyReason: string | null = null;

    if (is_anomaly_flagged) {
      anomalyStatus = "TECHNICIAN_FLAGGED";
      anomalyReason = technician_note || "Technician manually flagged unit for inspection";
    } else {
      // High usage detection based on previous 3 readings
      const { data: pastReadings } = await supabase
        .from("meter_readings")
        .select("usage_units")
        .eq("unit_id", reading.unit_id)
        .eq("utility_type", reading.utility_type)
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);

      if (pastReadings && pastReadings.length > 0) {
        const sum = pastReadings.reduce((acc, r) => acc + Number(r.usage_units), 0);
        const avg = sum / pastReadings.length;
        if (usage > 50 && usage > avg * 1.85) {
          anomalyStatus = "HIGH_USAGE";
          const pct = Math.round((usage / (avg || 1)) * 100);
          const typeLabel = reading.utility_type === "WATER" ? "น้ำ" : "ไฟ";
          anomalyReason = `การใช้${typeLabel}สูงกว่าค่าเฉลี่ยย้อนหลัง 3 รอบ ${pct}%`;
        }
      }

      // Zero usage detection if room is occupied
      if (usage === 0) {
        const { data: activeStay } = await supabase
          .from("reservations")
          .select("id")
          .eq("unit_id", reading.unit_id)
          .eq("status", "CHECKED_IN")
          .limit(1)
          .maybeSingle();

        if (activeStay) {
          anomalyStatus = "ZERO_USAGE";
          anomalyReason = "ไม่มีการใช้บริการทั้งที่มีผู้พักอาศัย";
        }
      }
    }

    // Insert history attempt if it's a recheck
    if (reading.recheck_requested) {
      const { data: existingAttempts } = await supabase
        .from("meter_reading_attempts")
        .select("attempt_number")
        .eq("meter_reading_id", readingId)
        .order("attempt_number", { ascending: false })
        .limit(1);

      const nextAttemptNum = existingAttempts && existingAttempts.length > 0
        ? existingAttempts[0].attempt_number + 1
        : 2;

      await supabase
        .from("meter_reading_attempts")
        .insert({
          meter_reading_id: readingId,
          attempt_number: nextAttemptNum,
          reading_value: currReading,
          photo_url: photo_url || null,
          technician_note: technician_note || null,
          recorded_by: user.id,
          recorded_at: new Date().toISOString(),
          recheck_reason: reading.recheck_reason
        });
    }

    const { data: updatedReading, error: updateErr } = await supabase
      .from("meter_readings")
      .update({
        current_reading: currReading,
        usage_units: usage,
        rate_per_unit_snapshot: rateSnapshot,
        calculated_amount: amount,
        treatment_rate_snapshot: treatmentRateSnapshot,
        treatment_amount: treatmentAmount,
        status: "REVIEW",
        anomaly_status: anomalyStatus,
        anomaly_reason: anomalyReason,
        technician_note: technician_note || null,
        photo_url: photo_url || null,
        recorded_by: user.id,
        recorded_at: new Date().toISOString()
      })
      .eq("id", readingId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // Log entity change
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_readings",
      p_entity_id: readingId,
      p_action_type: "EDIT",
      p_changed_fields: { before: reading, after: updatedReading },
      p_reason: "Submit meter reading for review"
    });

    return NextResponse.json({ success: true, data: updatedReading });
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
