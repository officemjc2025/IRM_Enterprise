import { NextResponse } from "next/server";
import { workOrderService } from "@/services/work-order/work-order.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";
import { WorkOrder } from "@/features/work-order/types/work-order.types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("filter") || "all";
    const technicianId = searchParams.get("technician_id");

    let orders: WorkOrder[] = [];
    if (filterType === "open") {
      orders = await workOrderService.getOpenWorkOrders();
    } else if (filterType === "assigned" && technicianId) {
      orders = await workOrderService.getAssignedWorkOrders(technicianId);
    } else if (filterType === "history") {
      orders = await workOrderService.getHistoryWorkOrders();
    } else {
      orders = await workOrderService.getAllWorkOrders();
    }

    const isAdmin = scope.isFullScope;
    const isTechnician = scope.role === "technician";
    const isHousekeeper = scope.role === "housekeeping";

    // Security check:
    if (isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("property_id")
        .eq("id", scope.profileId)
        .single();

      if (scope.role === "property_admin" || scope.role === "office") {
        if (!profile?.property_id) {
          orders = [];
        } else {
          orders = orders.filter((o) => o.property_id === profile.property_id);
        }
      }
    } else if (isTechnician) {
      orders = orders.filter((o) => o.service_team === "TECHNICIAN" || o.assigned_to === scope.profileId);
    } else if (isHousekeeper) {
      orders = orders.filter((o) => o.service_team === "HOUSEKEEPING" || o.assigned_to === scope.profileId);
    } else {
      // Residents can only view work orders created by them or matching their authorized assignments/units
      if (!scope.assignmentIds || scope.assignmentIds.length === 0) {
        orders = orders.filter((o) => o.created_by === scope.profileId);
      } else {
        orders = orders.filter((o) =>
          o.created_by === scope.profileId ||
          (o.resident_assignment_id && scope.assignmentIds.includes(o.resident_assignment_id)) ||
          (o.unit_id && scope.authorizedUnitIds.includes(o.unit_id))
        );
      }
    }

    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const serviceTeam = searchParams.get("service_team");

    if (startStr || endStr) {
      const startDate = startStr ? new Date(startStr) : null;
      const endDate = endStr ? new Date(endStr) : null;

      orders = orders.filter((o) => {
        if (!o.scheduled_at) return false;
        const d = new Date(o.scheduled_at);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });
    }

    if (serviceTeam && serviceTeam !== "ALL") {
      orders = orders.filter((o) => o.service_team === serviceTeam);
    }

    if (!isAdmin) {
      orders.forEach((o) => {
        o.actual_cost = null;
        if (!isTechnician && !isHousekeeper) {
          o.charge_amount = null;
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: "Work orders retrieved successfully",
      data: orders,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve work orders";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const body = await request.json();
    const isAdmin = scope.isFullScope;

    if (!isAdmin) {
      const isAssignmentValid = body.resident_assignment_id && scope.assignmentIds.includes(body.resident_assignment_id);
      const isUnitValid = body.unit_id && scope.authorizedUnitIds.includes(body.unit_id);

      if (!isAssignmentValid && !isUnitValid) {
        return NextResponse.json({ success: false, message: "Forbidden: Unauthorized unit assignment specified." }, { status: 403 });
      }
    }

    const order = await workOrderService.createWorkOrder({
      ...body,
      created_by: scope.profileId,
    });

    return NextResponse.json({
      success: true,
      message: "Work order created successfully",
      data: order,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create work order";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
