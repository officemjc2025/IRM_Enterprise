import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get("cycle_id");
    const propertyId = searchParams.get("property_id");
    const unitId = searchParams.get("unit_id");
    const status = searchParams.get("status");

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

    let query = supabase.from("meter_readings").select(`
      *,
      unit:unit_id (id, unit_number, water_control_status, electricity_control_status),
      meter:meter_id (id, meter_number, meter_status),
      cycle:cycle_id (id, cycle_code, cycle_name, billing_month, reading_due_date, status)
    `).order("created_at", { ascending: false });

    if (profile.role === "property_admin" || profile.role === "technician") {
      if (!profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property scope mismatch" }, { status: 403 });
      }
      query = query.eq("property_id", profile.property_id);
    } else if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    if (cycleId) {
      query = query.eq("cycle_id", cycleId);
    }

    if (unitId) {
      query = query.eq("unit_id", unitId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: readings, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: readings });
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
