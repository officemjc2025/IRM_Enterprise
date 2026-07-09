import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { utilityMeterService } from "@/services/utility-meter/utility-meter.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const unitId = searchParams.get("unit_id");
    const status = searchParams.get("meter_status");

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

    let query = supabase.from("utility_meters").select(`
      *,
      unit:unit_id (id, unit_number, water_control_status, electricity_control_status)
    `).order("created_at", { ascending: false });

    if (profile.role === "property_admin") {
      if (!profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property admin has no property" }, { status: 403 });
      }
      query = query.eq("property_id", profile.property_id);
    } else if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    if (unitId) {
      query = query.eq("unit_id", unitId);
    }

    if (status) {
      query = query.eq("meter_status", status);
    }

    const { data: meters, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: meters });
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      property_id,
      unit_id,
      utility_type,
      meter_classification,
      manufacturer_serial_number,
      installed_at,
      initial_reading,
      note
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

    if (profile.role === "property_admin") {
      if (!profile.property_id || property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property meter creation denied" }, { status: 403 });
      }
    }

    // 1. Fetch unit number for code generation
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("unit_number")
      .eq("id", unit_id)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ success: false, message: "Unit not found" }, { status: 404 });
    }

    const unitNum = unit.unit_number;
    const utLabel = utility_type === "WATER" ? "น้ำ" : "ไฟ";

    // 2. Active meter invariant check (at most one ACTIVE meter per Unit + Utility Type)
    const { data: activeMeter } = await supabase
      .from("utility_meters")
      .select("id")
      .eq("unit_id", unit_id)
      .eq("utility_type", utility_type)
      .eq("meter_status", "ACTIVE")
      .maybeSingle();

    if (activeMeter) {
      return NextResponse.json({
        success: false,
        message: `ห้อง ${unitNum} มีมิเตอร์${utLabel}ที่ใช้งานอยู่แล้ว กรุณาใช้กระบวนการเปลี่ยนมิเตอร์`
      }, { status: 400 });
    }

    // 3. Duplicate manufacturer serial check when supplied
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

    // 4. Resolve sequence & generate Internal Meter Code
    const seq = await utilityMeterService.resolveNextMeterSequence(supabase, unit_id, utility_type);
    let internalMeterCode = "";
    let installationDateKnown = true;
    let finalInstalledAt: string | null = null;

    if (meter_classification === "LEGACY") {
      internalMeterCode = utilityMeterService.generateLegacyMeterCode(unitNum, utility_type, seq);
      if (installed_at) {
        finalInstalledAt = installed_at;
      } else {
        installationDateKnown = false;
        finalInstalledAt = null;
      }
    } else if (meter_classification === "NEW") {
      if (!installed_at) {
        return NextResponse.json({
          success: false,
          message: "Installed date is required for new/replacement meters"
        }, { status: 400 });
      }
      internalMeterCode = utilityMeterService.generateInstalledMeterCode(unitNum, utility_type, installed_at, seq);
      finalInstalledAt = installed_at;
    } else {
      return NextResponse.json({
        success: false,
        message: "Invalid meter classification. Must be LEGACY or NEW"
      }, { status: 400 });
    }

    // 5. Insert meter record
    const { data: meter, error } = await supabase
      .from("utility_meters")
      .insert({
        property_id,
        unit_id,
        utility_type,
        meter_number: internalMeterCode,
        manufacturer_serial_number: trimmedSerial !== "" ? trimmedSerial : null,
        installed_at: finalInstalledAt,
        installation_date_known: installationDateKnown,
        meter_status: "ACTIVE",
        initial_reading: initial_reading !== undefined ? Number(initial_reading) : 0.00
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    // 6. Write Audit Log (actor derived from user token)
    await supabase.rpc("log_entity_change", {
      p_entity_type: "units",
      p_entity_id: unit_id,
      p_action_type: "EDIT",
      p_changed_fields: {
        action: "METER_REGISTRATION",
        utility_type,
        meter_number: internalMeterCode,
        manufacturer_serial_number: trimmedSerial !== "" ? trimmedSerial : null,
        classification: meter_classification,
        note: note || ""
      },
      p_reason: `Registered ${utility_type} meter ${internalMeterCode} for unit ${unitNum}`
    });

    return NextResponse.json({ success: true, data: meter });
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
