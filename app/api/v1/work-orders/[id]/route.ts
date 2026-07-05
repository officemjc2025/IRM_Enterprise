import { NextResponse } from "next/server";
import { workOrderService } from "@/services/work-order/work-order.service";
import { createClient } from "@/lib/supabase/server";

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
    const updated = await workOrderService.updateWorkOrder(id, {
      ...body,
      updated_by: user.id,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Work order not found or update failed" },
        { status: 404 }
      );
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

    const updated = await workOrderService.updateWorkOrder(id, {
      status: "CANCELLED",
      updated_by: user.id,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Work order not found or cancellation failed" },
        { status: 404 }
      );
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
