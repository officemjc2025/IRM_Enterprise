import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workOrderService } from "@/services/work-order/work-order.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: workOrderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const order = await workOrderService.getWorkOrderById(workOrderId);
    if (!order) {
      return NextResponse.json({ success: false, message: "Work order not found" }, { status: 404 });
    }

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isTechnician = profile && profile.role === "technician";
    const isHousekeeper = profile && profile.role === "housekeeping";

    if (!isAdmin) {
      if (isTechnician) {
        if (order.service_team !== "TECHNICIAN" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else if (isHousekeeper) {
        if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const { data: changes, error: dbErr } = await supabase
      .from("work_order_schedule_changes")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });

    if (dbErr) {
      throw dbErr;
    }

    return NextResponse.json({
      success: true,
      data: changes
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve schedule history";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: workOrderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const order = await workOrderService.getWorkOrderById(workOrderId);
    if (!order) {
      return NextResponse.json({ success: false, message: "Work order not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isTechnician = profile && profile.role === "technician";
    const isHousekeeper = profile && profile.role === "housekeeping";

    const body = await request.json();
    const { requested_scheduled_at, reason } = body;

    if (!requested_scheduled_at) {
      return NextResponse.json({ success: false, message: "New scheduled date/time is required" }, { status: 400 });
    }
    if (!reason || reason.trim() === "") {
      return NextResponse.json({ success: false, message: "Reason is required" }, { status: 400 });
    }

    // Verify scheduled_at is different
    const currentScheduledStr = order.scheduled_at ? new Date(order.scheduled_at).toISOString() : "";
    const requestedScheduledStr = new Date(requested_scheduled_at).toISOString();
    if (currentScheduledStr === requestedScheduledStr) {
      return NextResponse.json({ success: false, message: "New schedule must be different from current schedule" }, { status: 400 });
    }

    if (isAdmin) {
      // 1. Call atomic database RPC function for Admin direct reschedule
      const { data: history, error: rpcErr } = await supabase.rpc(
        "admin_direct_reschedule_work_order",
        {
          p_work_order_id: workOrderId,
          p_requested_scheduled_at: requestedScheduledStr,
          p_reason: reason.trim()
        }
      );

      if (rpcErr) {
        return NextResponse.json({ success: false, message: rpcErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Schedule updated directly by admin",
        data: history
      });
    }

    // Worker Flow: must be assigned to job, matching service team, and no other pending request
    if (isTechnician) {
      if (order.service_team !== "TECHNICIAN" || order.assigned_to !== user.id) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    } else if (isHousekeeper) {
      if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Check if a PENDING request already exists
    const { data: pending, error: checkErr } = await supabase
      .from("work_order_schedule_changes")
      .select("id")
      .eq("work_order_id", workOrderId)
      .eq("status", "PENDING")
      .maybeSingle();

    if (checkErr) {
      throw checkErr;
    }

    if (pending) {
      return NextResponse.json({ success: false, message: "A pending schedule change request already exists for this work order" }, { status: 400 });
    }

    // Insert pending request
    const { data: requestData, error: dbErr } = await supabase
      .from("work_order_schedule_changes")
      .insert({
        work_order_id: workOrderId,
        old_scheduled_at: order.scheduled_at,
        requested_scheduled_at: requestedScheduledStr,
        reason: reason.trim(),
        status: "PENDING",
        requested_by: user.id
      })
      .select()
      .single();

    if (dbErr) {
      throw dbErr;
    }

    return NextResponse.json({
      success: true,
      message: "Schedule change request submitted successfully",
      data: requestData
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create schedule request";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: workOrderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { change_id, status, review_remark } = body;

    if (!change_id || !status || !["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ success: false, message: "change_id and valid target status (APPROVED/REJECTED/CANCELLED) are required" }, { status: 400 });
    }

    if (status === "CANCELLED") {
      // Call atomic RPC cancel function (enforces worker ownership and assignment checks)
      const { data: updatedReq, error: cancelErr } = await supabase.rpc(
        "cancel_work_order_schedule_change",
        {
          p_work_order_id: workOrderId,
          p_change_id: change_id
        }
      );

      if (cancelErr) {
        return NextResponse.json({ success: false, message: cancelErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Schedule request cancelled successfully",
        data: updatedReq
      });
    }

    if (status === "APPROVED") {
      // Call atomic RPC approve function
      const { data: updatedReq, error: approveErr } = await supabase.rpc(
        "approve_work_order_schedule_change",
        {
          p_work_order_id: workOrderId,
          p_change_id: change_id,
          p_review_remark: review_remark || null
        }
      );

      if (approveErr) {
        return NextResponse.json({ success: false, message: approveErr.message }, { status: 400 });
      }

      if (updatedReq && updatedReq.status === "REJECTED") {
        return NextResponse.json({
          success: false,
          message: "This request is stale because the work order schedule has changed in the meantime.",
          data: updatedReq
        }, { status: 409 });
      }

      return NextResponse.json({
        success: true,
        message: "Schedule request approved successfully",
        data: updatedReq
      });
    }

    if (status === "REJECTED") {
      // Call atomic RPC reject function
      const { data: updatedReq, error: rejectErr } = await supabase.rpc(
        "reject_work_order_schedule_change",
        {
          p_work_order_id: workOrderId,
          p_change_id: change_id,
          p_review_remark: review_remark || null
        }
      );

      if (rejectErr) {
        return NextResponse.json({ success: false, message: rejectErr.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Schedule request rejected successfully",
        data: updatedReq
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review schedule request";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
