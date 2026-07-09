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
      return NextResponse.json({ success: false, message: "Forbidden: Technicians are not allowed to reject/return readings" }, { status: 403 });
    }

    const { data: reading, error: fetchErr } = await supabase
      .from("meter_readings")
      .select("*")
      .eq("id", readingId)
      .single();

    if (fetchErr || !reading) {
      return NextResponse.json({ success: false, message: "Reading record not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || reading.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property rejection denied" }, { status: 403 });
      }
    }

    if (reading.status !== "REVIEW") {
      return NextResponse.json({ success: false, message: "Reading is not in REVIEW state" }, { status: 400 });
    }
    const { data: updatedReading, error: updateErr } = await supabase
      .from("meter_readings")
      .update({
        status: "REJECTED",
        recheck_requested: true,
        recheck_reason: manager_note || "Returned for correction by manager",
        manager_note: manager_note || "Returned for correction by manager",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", readingId)
      .eq("status", "REVIEW")
      .select("*")
      .single();

    if (updateErr || !updatedReading) {
      return NextResponse.json({
        success: false,
        message: "Reading task is no longer in a reviewable state or has been modified by another user"
      }, { status: 409 });
    }

    // Insert history attempt 1
    const { data: existingAttempts } = await supabase
      .from("meter_reading_attempts")
      .select("attempt_number")
      .eq("meter_reading_id", readingId)
      .order("attempt_number", { ascending: false })
      .limit(1);

    const nextAttemptNum = existingAttempts && existingAttempts.length > 0
      ? existingAttempts[0].attempt_number + 1
      : 1;

    if (nextAttemptNum === 1) {
      await supabase
        .from("meter_reading_attempts")
        .insert({
          meter_reading_id: readingId,
          attempt_number: 1,
          reading_value: reading.current_reading,
          photo_url: reading.photo_url,
          technician_note: reading.technician_note,
          recorded_by: reading.recorded_by,
          recorded_at: reading.recorded_at || reading.created_at,
          recheck_reason: manager_note || "Returned for correction by manager"
        });
    }    // Log entity change
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_readings",
      p_entity_id: readingId,
      p_action_type: "EDIT",
      p_changed_fields: { before: reading, after: updatedReading },
      p_reason: "Return meter reading to technician for correction"
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
