import { NextResponse } from "next/server";
import { workOrderService } from "@/services/work-order/work-order.service";
import { createClient } from "@/lib/supabase/server";
import { WorkOrder } from "@/features/work-order/types/work-order.types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

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

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isTechnician = profile && profile.role === "technician";
    const isHousekeeper = profile && profile.role === "housekeeping";

    // Security check:
    if (isAdmin) {
      // Admins see all work orders
    } else if (isTechnician) {
      // Technicians only see technician jobs assigned to them
      orders = orders.filter((o) => o.service_team === "TECHNICIAN" && o.assigned_to === user.id);
    } else if (isHousekeeper) {
      // Housekeepers only see housekeeping jobs assigned to them
      orders = orders.filter((o) => o.service_team === "HOUSEKEEPING" && o.assigned_to === user.id);
    } else {
      // Residents can only view work orders created by them or matching their assignments
      // Find person
      const { data: person } = await supabase
        .from("persons")
        .select("id")
        .eq("email", user.email)
        .is("deleted_at", null)
        .maybeSingle();

      if (!person) {
        orders = [];
      } else {
        const { data: assignments } = await supabase
          .from("resident_assignments")
          .select("id")
          .eq("person_id", person.id);

        const assignmentIds = (assignments || []).map((a) => a.id);

        orders = orders.filter((o) =>
          o.created_by === user.id ||
          (o.resident_assignment_id && assignmentIds.includes(o.resident_assignment_id))
        );
      }
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
    const message = error instanceof Error ? error.message : "Failed to retrieve work orders";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Security check: Resident can only request for their own property/unit/assignment
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);

    if (!isAdmin) {
      const { data: person } = await supabase
        .from("persons")
        .select("id")
        .eq("email", user.email)
        .is("deleted_at", null)
        .maybeSingle();

      if (!person) {
        return NextResponse.json(
          { success: false, message: "Resident profile not found" },
          { status: 400 }
        );
      }

      interface AssignmentUnitRow {
        id: string;
        unit_id: string;
        units: {
          property_id: string;
        } | null;
      }

      const { data: assignment } = await supabase
        .from("resident_assignments")
        .select("id, unit_id, units (property_id)")
        .eq("person_id", person.id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!assignment) {
        return NextResponse.json(
          { success: false, message: "No active resident assignment found" },
          { status: 403 }
        );
      }

      const activeAssignment = assignment as unknown as AssignmentUnitRow;

      // Inject resident's active assignment, property, and unit
      body.resident_assignment_id = activeAssignment.id;
      body.unit_id = activeAssignment.unit_id;
      body.property_id = activeAssignment.units?.property_id;
    }

    const order = await workOrderService.createWorkOrder({
      ...body,
      created_by: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Work order created successfully",
      data: order,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create work order";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
