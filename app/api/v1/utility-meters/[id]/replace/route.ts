import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: oldMeterId } = await params;
    const body = await request.json();
    const { new_meter_number, starting_reading, final_reading, replacement_reason, replacement_date } = body;

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

    // 1. Fetch old meter
    const { data: oldMeter, error: oldErr } = await supabase
      .from("utility_meters")
      .select("*")
      .eq("id", oldMeterId)
      .single();

    if (oldErr || !oldMeter) {
      return NextResponse.json({ success: false, message: "Old meter not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || oldMeter.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property meter replacement denied" }, { status: 403 });
      }
    }

    const repDate = replacement_date || new Date().toISOString().split("T")[0];

    // 2. Perform replacement in db.
    // Step A: Retire old meter
    const { error: retireErr } = await supabase
      .from("utility_meters")
      .update({
        meter_status: "INACTIVE",
        retired_at: repDate
      })
      .eq("id", oldMeterId);

    if (retireErr) throw retireErr;

    // Step B: Insert new meter
    const { data: newMeter, error: insertErr } = await supabase
      .from("utility_meters")
      .insert({
        property_id: oldMeter.property_id,
        unit_id: oldMeter.unit_id,
        utility_type: oldMeter.utility_type,
        meter_number: new_meter_number,
        installed_at: repDate,
        meter_status: "ACTIVE"
      })
      .select("*")
      .single();

    if (insertErr) {
      // Rollback old meter
      await supabase.from("utility_meters").update({ meter_status: "ACTIVE", retired_at: null }).eq("id", oldMeterId);
      return NextResponse.json({ success: false, message: insertErr.message }, { status: 400 });
    }

    // Step C: Log history
    const { error: histErr } = await supabase
      .from("meter_replacement_history")
      .insert({
        property_id: oldMeter.property_id,
        unit_id: oldMeter.unit_id,
        utility_type: oldMeter.utility_type,
        old_meter_id: oldMeterId,
        old_meter_number: oldMeter.meter_number,
        final_reading: final_reading || null,
        new_meter_id: newMeter.id,
        new_meter_number: new_meter_number,
        starting_reading: starting_reading || 0.00,
        replacement_reason: replacement_reason || "Meter replacement",
        replaced_by: user.id,
        replaced_at: new Date().toISOString()
      });

    if (histErr) throw histErr;

    // Step D: Log Audit History
    await supabase.rpc("log_entity_change", {
      p_entity_type: "units",
      p_entity_id: oldMeter.unit_id,
      p_action_type: "EDIT",
      p_changed_fields: {
        action: "METER_REPLACEMENT",
        utility_type: oldMeter.utility_type,
        old_meter_number: oldMeter.meter_number,
        new_meter_number: new_meter_number,
        reason: replacement_reason
      },
      p_reason: `Replaced ${oldMeter.utility_type} meter in Unit`
    });

    return NextResponse.json({
      success: true,
      message: "Meter replaced successfully",
      data: { old_meter: oldMeterId, new_meter: newMeter.id }
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
