import { NextResponse } from "next/server";
import { workOrderService } from "@/services/work-order/work-order.service";
import { createClient } from "@/lib/supabase/server";
import { WorkOrder } from "@/features/work-order/types/work-order.types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await workOrderService.getWorkOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found" },
        { status: 404 }
      );
    }

    // Role scoping check
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
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }
      } else if (isHousekeeper) {
        if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }
      } else {
        const { data: person } = await supabase
          .from("persons")
          .select("id")
          .eq("email", user.email)
          .is("deleted_at", null)
          .maybeSingle();

        const { data: assignments } = person
          ? await supabase.from("resident_assignments").select("id").eq("person_id", person.id)
          : { data: null };

        const assignmentIds = (assignments || []).map((a) => a.id);
        const isCreator = order.created_by === user.id;
        const matchesAssignment = order.resident_assignment_id && assignmentIds.includes(order.resident_assignment_id);

        if (!isCreator && !matchesAssignment) {
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }
      }
    }

    if (!isAdmin && order) {
      order.actual_cost = null;
      if (!isTechnician && !isHousekeeper) {
        order.charge_amount = null;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Work order retrieved successfully",
      data: order,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve work order";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await workOrderService.getWorkOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found" },
        { status: 404 }
      );
    }

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
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }
      } else if (isHousekeeper) {
        if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
          return NextResponse.json(
            { success: false, message: "Forbidden" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    if (!isAdmin) {
      delete body.charge_amount;
      delete body.actual_cost;
    }

    // Edit policy matrix validation
    if (order.status === "COMPLETED" || order.status === "CLOSED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "Completed, closed, or cancelled work orders are read-only" },
        { status: 400 }
      );
    }

    if (order.status !== "NEW" && order.status !== "ASSIGNED") {
      const identityCriticalFields: Array<keyof WorkOrder> = ["property_id", "unit_id", "service_team", "category"];
      for (const field of identityCriticalFields) {
        if (body[field] !== undefined && body[field] !== order[field]) {
          return NextResponse.json(
            { success: false, message: `Cannot modify '${field}' after work has started` },
            { status: 400 }
          );
        }
      }
    }

    const isStatusUpdate = body.status !== undefined && body.status !== order.status;

    let updated: WorkOrder | null = null;

    if (isStatusUpdate) {
      // -------------------------------------------------------
      // ATOMIC OPERATIONAL TRANSITION (FAIL-CLOSED)
      // Call transition_work_order_status RPC which handles locking,
      // authorization, status update, derivation, and audit logs.
      // -------------------------------------------------------
      const { error: transitionError } = await supabase.rpc(
        "transition_work_order_status",
        {
          p_work_order_id: id,
          p_new_status: body.status,
          p_reason: body.remark || `Work order status changed to ${body.status}`,
        }
      );

      if (transitionError) {
        return NextResponse.json(
          { success: false, message: `Atomic transition failed: ${transitionError.message}` },
          { status: 400 }
        );
      }

      // If there are other fields in the body, update them now
      const otherFields = { ...body };
      delete otherFields.status;
      if (Object.keys(otherFields).length > 0) {
        await workOrderService.updateWorkOrder(id, {
          ...otherFields,
          updated_by: user.id,
        });
      }

      updated = await workOrderService.getWorkOrderById(id);
    } else {
      // Standard non-status update
      updated = await workOrderService.updateWorkOrder(id, {
        ...body,
        updated_by: user.id,
      });

      if (!updated) {
        return NextResponse.json(
          { success: false, message: "Work order not found or update failed" },
          { status: 404 }
        );
      }

      // Log to entity_change_history using database RPC
      const { error: rpcError } = await supabase.rpc("log_entity_change", {
        p_entity_type: "work_orders",
        p_entity_id: id,
        p_action_type: "EDIT",
        p_changed_fields: body,
        p_reason: null,
      });

      if (rpcError) {
        console.error("Audit log error:", rpcError);
      }
    }

    if (!isAdmin && updated) {
      updated.actual_cost = null;
    }

    return NextResponse.json({
      success: true,
      message: "Work order updated successfully",
      data: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update work order";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await workOrderService.getWorkOrderById(id);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Only administrators can cancel work orders" },
        { status: 403 }
      );
    }

    // Cancellation transition must verify eligible current status
    if (["COMPLETED", "CLOSED", "CANCELLED"].includes(order.status)) {
      return NextResponse.json(
        { success: false, message: "Completed, closed, or already cancelled work orders cannot be cancelled" },
        { status: 400 }
      );
    }

    let cancellationReason = "";
    try {
      const body = await request.json();
      if (body && body.cancellation_reason) {
        cancellationReason = body.cancellation_reason;
      }
    } catch {
      // Ignore body parsing issues (e.g. no body sent)
    }

    // Cancellation reason must be non-empty after trimming
    if (!cancellationReason || !cancellationReason.trim()) {
      return NextResponse.json(
        { success: false, message: "Cancellation reason must be non-empty" },
        { status: 400 }
      );
    }

    const updated = await workOrderService.updateWorkOrder(id, {
      status: "CANCELLED",
      updated_by: user.id,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancellation_reason: cancellationReason.trim(),
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Work order not found or cancellation failed" },
        { status: 404 }
      );
    }

    // Log to entity_change_history using database RPC
    const { error: rpcError } = await supabase.rpc("log_entity_change", {
      p_entity_type: "work_orders",
      p_entity_id: id,
      p_action_type: "CANCEL",
      p_changed_fields: { status: "CANCELLED" },
      p_reason: cancellationReason.trim(),
    });

    if (rpcError) {
      console.error("Audit log error:", rpcError);
    }

    return NextResponse.json({
      success: true,
      message: "Work order cancelled successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel work order";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
