import { NextResponse } from "next/server";
import { workOrderService } from "@/services/work-order/work-order.service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const allOrders = await workOrderService.getAllWorkOrders();

    // Role-based filtering for summary counts
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isTechnician = profile && profile.role === "technician";
    const isHousekeeper = profile && profile.role === "housekeeping";

    let orders = allOrders;

    if (isAdmin) {
      // Admins see all work orders
    } else if (isTechnician) {
      // Technicians only see technician jobs assigned to them
      orders = allOrders.filter((o) => o.service_team === "TECHNICIAN" && o.assigned_to === user.id);
    } else if (isHousekeeper) {
      // Housekeepers only see housekeeping jobs assigned to them
      orders = allOrders.filter((o) => o.service_team === "HOUSEKEEPING" && o.assigned_to === user.id);
    } else {
      // Residents can only view work orders created by them or matching their assignments
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

        orders = allOrders.filter((o) =>
          o.created_by === user.id ||
          (o.resident_assignment_id && assignmentIds.includes(o.resident_assignment_id))
        );
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();

    const openCount = orders.filter((o) =>
      ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"].includes(o.status)
    ).length;

    const inProgressCount = orders.filter((o) => o.status === "IN_PROGRESS").length;

    const completedTodayCount = orders.filter((o) => {
      if (o.status !== "COMPLETED" && o.status !== "CLOSED") return false;
      const completedDate = o.completed_at || o.updated_at;
      return completedDate ? completedDate.startsWith(todayStr) : false;
    }).length;

    const overdueCount = orders.filter((o) => {
      const isOpen = ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"].includes(o.status);
      if (!isOpen) return false;

      const targetTime = o.scheduled_at || o.requested_at;
      if (!targetTime) return false;

      return new Date(targetTime) < now;
    }).length;

    return NextResponse.json({
      success: true,
      data: {
        open: openCount,
        inProgress: inProgressCount,
        completedToday: completedTodayCount,
        overdue: overdueCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve summary";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
