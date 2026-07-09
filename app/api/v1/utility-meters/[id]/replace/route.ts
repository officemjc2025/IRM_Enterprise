import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { utilityMeterService } from "@/services/utility-meter/utility-meter.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: oldMeterId } = await params;
    const body = await request.json();
    const {
      manufacturer_serial_number,
      starting_reading,
      final_reading,
      replacement_reason,
      replacement_date
    } = body;

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

    // 1. Fetch old meter details
    const { data: oldMeter, error: oldErr } = await supabase
      .from("utility_meters")
      .select("*")
      .eq("id", oldMeterId)
      .single();

    if (oldErr || !oldMeter) {
      return NextResponse.json({ success: false, message: "Old meter not found" }, { status: 404 });
    }

    // 2. Validate property scope
    if (profile.role === "property_admin") {
      if (!profile.property_id || oldMeter.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property meter replacement denied" }, { status: 403 });
      }
    }

    if (oldMeter.meter_status !== "ACTIVE") {
      return NextResponse.json({ success: false, message: "Old meter is not active" }, { status: 400 });
    }

    const repDate = replacement_date || new Date().toISOString().split("T")[0];

    // 3. Fetch unit number for code generation
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("unit_number")
      .eq("id", oldMeter.unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ success: false, message: "Unit not found" }, { status: 404 });
    }

    const unitNum = unit.unit_number;

    // 4. Check duplicate manufacturer serial check when supplied
    const trimmedSerial = manufacturer_serial_number ? String(manufacturer_serial_number).trim() : "";
    if (trimmedSerial !== "") {
      const { count } = await supabase
        .from("utility_meters")
        .select("id", { count: "exact", head: true })
        .eq("manufacturer_serial_number", trimmedSerial);

      if (count && count > 0) {
        return NextResponse.json({
          success: false,
          message: `เลข Serial ผู้ผลิต "${trimmedSerial}" ถูกใช้งานแล้วในระบบ`
        }, { status: 400 });
      }
    }

    // 5. Resolve sequence & generate Internal Meter Code
    const seq = await utilityMeterService.resolveNextMeterSequence(supabase, oldMeter.unit_id, oldMeter.utility_type);
    const newInternalCode = utilityMeterService.generateInstalledMeterCode(
      unitNum,
      oldMeter.utility_type,
      repDate,
      seq
    );

    // 6. Execute atomic replacement in DB
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("replace_utility_meter", {
      p_old_meter_id: oldMeterId,
      p_new_internal_code: newInternalCode,
      p_manufacturer_serial_number: trimmedSerial !== "" ? trimmedSerial : null,
      p_starting_reading: starting_reading !== undefined ? Number(starting_reading) : 0.00,
      p_final_reading: final_reading !== undefined && final_reading !== null ? Number(final_reading) : null,
      p_replacement_reason: replacement_reason || "Meter replacement",
      p_replacement_date: repDate,
      p_actor_id: user.id
    });

    if (rpcErr || !rpcResult?.success) {
      return NextResponse.json({
        success: false,
        message: rpcErr?.message || "Failed to execute meter replacement transaction"
      }, { status: 400 });
    }

    // 7. Write Audit Log
    await supabase.rpc("log_entity_change", {
      p_entity_type: "units",
      p_entity_id: oldMeter.unit_id,
      p_action_type: "EDIT",
      p_changed_fields: {
        action: "METER_REPLACEMENT",
        utility_type: oldMeter.utility_type,
        old_meter_number: oldMeter.meter_number,
        new_meter_number: rpcResult.new_internal_code,
        manufacturer_serial_number: trimmedSerial !== "" ? trimmedSerial : null,
        reason: replacement_reason
      },
      p_reason: `Replaced ${oldMeter.utility_type} meter in Unit ${unitNum}`
    });

    return NextResponse.json({
      success: true,
      message: "Meter replaced successfully",
      data: {
        old_meter: oldMeterId,
        new_meter: rpcResult.new_meter_id,
        new_internal_code: rpcResult.new_internal_code
      }
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
