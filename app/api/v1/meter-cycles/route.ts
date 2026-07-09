import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const utilityType = searchParams.get("utility_type");

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

    let query = supabase.from("meter_reading_cycles").select("*").order("created_at", { ascending: false });

    if (profile.role === "property_admin") {
      if (!profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: property admin has no property" }, { status: 403 });
      }
      query = query.eq("property_id", profile.property_id);
    } else if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    if (utilityType) {
      query = query.eq("utility_type", utilityType);
    }

    const { data: cycles, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: cycles });
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
    const { property_id, utility_type, cycle_code, cycle_name, billing_month, reading_start_date, reading_due_date } = body;

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
        return NextResponse.json({ success: false, message: "Forbidden: cross-property cycle creation denied" }, { status: 403 });
      }
    }

    const { data: cycle, error } = await supabase
      .from("meter_reading_cycles")
      .insert({
        property_id,
        utility_type,
        cycle_code,
        cycle_name,
        billing_month,
        reading_start_date,
        reading_due_date,
        status: "DRAFT",
        created_by: user.id
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    // Audit Log
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_reading_cycles",
      p_entity_id: cycle.id,
      p_action_type: "CREATE",
      p_changed_fields: cycle,
      p_reason: "Create meter reading cycle"
    });

    return NextResponse.json({ success: true, data: cycle });
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
