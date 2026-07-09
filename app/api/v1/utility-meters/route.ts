import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { property_id, unit_id, utility_type, meter_number, installed_at, initial_reading } = body;

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

    const { data: meter, error } = await supabase
      .from("utility_meters")
      .insert({
        property_id,
        unit_id,
        utility_type,
        meter_number,
        installed_at: installed_at || new Date().toISOString().split("T")[0],
        meter_status: "ACTIVE",
        initial_reading: initial_reading !== undefined ? Number(initial_reading) : 0.00
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

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
