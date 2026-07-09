import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: cycleId } = await params;

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

    const { data: cycle, error: cycleErr } = await supabase
      .from("meter_reading_cycles")
      .select("*")
      .eq("id", cycleId)
      .single();

    if (cycleErr || !cycle) {
      return NextResponse.json({ success: false, message: "Meter reading cycle not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || cycle.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: cycle });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: cycleId } = await params;
    const body = await request.json();
    const { status, cycle_code, cycle_name, billing_month, reading_start_date, reading_due_date, utility_type } = body;

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

    const { data: cycle } = await supabase
      .from("meter_reading_cycles")
      .select("*")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ success: false, message: "Meter reading cycle not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || cycle.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    // Fetch readings progress for this cycle
    const { data: readingsData } = await supabase
      .from("meter_readings")
      .select("status")
      .eq("cycle_id", cycleId);

    const hasProgressedReadings = readingsData && readingsData.some(r => ["SUBMITTED", "REVIEW", "APPROVED"].includes(r.status));

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === "CLOSED") {
        updateData.closed_at = new Date().toISOString();
      }
    }

    if (cycle.status === "CLOSED" || cycle.status === "CANCELLED") {
      if (cycle_code !== undefined || cycle_name !== undefined || billing_month !== undefined || reading_start_date !== undefined || reading_due_date !== undefined || utility_type !== undefined) {
        return NextResponse.json({ success: false, message: "Closed or cancelled cycles are read-only" }, { status: 400 });
      }
    } else if (cycle.status === "DRAFT") {
      if (cycle_code !== undefined) updateData.cycle_code = cycle_code;
      if (cycle_name !== undefined) updateData.cycle_name = cycle_name;
      if (billing_month !== undefined) updateData.billing_month = billing_month;
      if (reading_start_date !== undefined) updateData.reading_start_date = reading_start_date;
      if (reading_due_date !== undefined) updateData.reading_due_date = reading_due_date;
      if (utility_type !== undefined) updateData.utility_type = utility_type;
    } else { // OPEN or IN_PROGRESS
      if (hasProgressedReadings) {
        if (cycle_code !== undefined || billing_month !== undefined || reading_start_date !== undefined || utility_type !== undefined) {
          return NextResponse.json({ success: false, message: "Cannot edit identity fields after readings have progressed" }, { status: 400 });
        }
      } else {
        if (cycle_code !== undefined || utility_type !== undefined) {
          return NextResponse.json({ success: false, message: "Cannot edit cycle code or utility type on an open cycle" }, { status: 400 });
        }
        if (billing_month !== undefined) updateData.billing_month = billing_month;
        if (reading_start_date !== undefined) updateData.reading_start_date = reading_start_date;
      }
      if (cycle_name !== undefined) updateData.cycle_name = cycle_name;
      if (reading_due_date !== undefined) updateData.reading_due_date = reading_due_date;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, data: cycle });
    }

    const { data: updated, error } = await supabase
      .from("meter_reading_cycles")
      .update(updateData)
      .eq("id", cycleId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    // Audit Log
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_reading_cycles",
      p_entity_id: cycleId,
      p_action_type: "EDIT",
      p_changed_fields: { before: cycle, after: updated },
      p_reason: `Edit cycle fields`
    });    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id: cycleId } = await params;

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

    const { data: cycle } = await supabase
      .from("meter_reading_cycles")
      .select("*")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ success: false, message: "Meter reading cycle not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || cycle.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    // Query readings to check if any have progress
    const { data: readings, error: readingsErr } = await supabase
      .from("meter_readings")
      .select("*")
      .eq("cycle_id", cycleId);

    if (readingsErr) {
      return NextResponse.json({ success: false, message: readingsErr.message }, { status: 400 });
    }

    const hasProgress = readings && readings.some(r => 
      r.status !== "PENDING" || 
      r.current_reading !== null || 
      r.photo_url !== null || 
      r.technician_note !== null ||
      r.recorded_by !== null
    );

    if (hasProgress) {
      return NextResponse.json({
        success: false,
        code: "CYCLE_HAS_PROGRESS",
        message: "รอบจดมิเตอร์นี้มีการจดเลขมิเตอร์แล้ว ไม่สามารถลบข้อมูลได้ กรุณาใช้คำสั่งยกเลิกรอบจดมิเตอร์แทน"
      }, { status: 400 });
    }

    // Safely delete empty generated readings atomically
    if (readings && readings.length > 0) {
      const { error: delReadingsErr } = await supabase
        .from("meter_readings")
        .delete()
        .eq("cycle_id", cycleId);

      if (delReadingsErr) {
        return NextResponse.json({ success: false, message: delReadingsErr.message }, { status: 400 });
      }
    }

    // Delete cycle row itself
    const { error: delCycleErr } = await supabase
      .from("meter_reading_cycles")
      .delete()
      .eq("id", cycleId);

    if (delCycleErr) {
      return NextResponse.json({ success: false, message: delCycleErr.message }, { status: 400 });
    }

    // Audit Log
    await supabase.rpc("log_entity_change", {
      p_entity_type: "meter_reading_cycles",
      p_entity_id: cycleId,
      p_action_type: "DELETE",
      p_changed_fields: { before: cycle, after: null },
      p_reason: "Safe delete cycle with no progressed readings"
    });

    return NextResponse.json({ success: true, message: "ลบรอบจดมิเตอร์สำเร็จ" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
