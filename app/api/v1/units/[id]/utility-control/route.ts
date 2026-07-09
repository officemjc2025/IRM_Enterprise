import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: unitId } = await params;
    const body = await request.json();
    const { utility_type, status, reason } = body;

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

    const { data: unit, error: fetchErr } = await supabase
      .from("units")
      .select("*")
      .eq("id", unitId)
      .single();

    if (fetchErr || !unit) {
      return NextResponse.json({ success: false, message: "Unit not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || unit.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property unit access denied" }, { status: 403 });
      }
    }

    // Role restriction: Technician cannot modify utility control status, they require manager/admin auth
    const isManagerOrAdmin = ["super_admin", "admin", "property_admin"].includes(profile.role);
    if (profile.role === "technician") {
      return NextResponse.json({
        success: false,
        message: "Forbidden: Technicians are not authorized to modify utility control status"
      }, { status: 403 });
    }

    if (!isManagerOrAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (utility_type === "WATER") {
      updateData.water_control_status = status;
    } else if (utility_type === "ELECTRICITY") {
      updateData.electricity_control_status = status;
    } else {
      return NextResponse.json({ success: false, message: "Invalid utility type" }, { status: 400 });
    }

    const { data: updatedUnit, error: updateErr } = await supabase
      .from("units")
      .update(updateData)
      .eq("id", unitId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // Log entity change
    await supabase.rpc("log_entity_change", {
      p_entity_type: "units",
      p_entity_id: unitId,
      p_action_type: "EDIT",
      p_changed_fields: { before: unit, after: updatedUnit, reason },
      p_reason: `Change ${utility_type} utility control status to ${status}`
    });

    return NextResponse.json({ success: true, data: updatedUnit });
  } catch (error: unknown) {
    const err = error as Record<string, unknown> | null;
    const code = err?.code;
    const msg = err?.message;
    if (
      code === "42P01" ||
      code === "42703" ||
      (typeof msg === "string" && (msg.includes("relation") || msg.includes("column")) && msg.includes("does not exist"))
    ) {
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
