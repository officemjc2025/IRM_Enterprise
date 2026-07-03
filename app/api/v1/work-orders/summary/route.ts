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

    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();

    const openCount = allOrders.filter((o) =>
      ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"].includes(o.status)
    ).length;

    const inProgressCount = allOrders.filter((o) => o.status === "IN_PROGRESS").length;

    const completedTodayCount = allOrders.filter((o) => {
      if (o.status !== "COMPLETED" && o.status !== "CLOSED") return false;
      const completedDate = o.completed_at || o.updated_at;
      return completedDate ? completedDate.startsWith(todayStr) : false;
    }).length;

    const overdueCount = allOrders.filter((o) => {
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
