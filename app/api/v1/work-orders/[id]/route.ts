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

    const body = await request.json();
    const order = await workOrderService.updateWorkOrder(id, {
      ...body,
      updated_by: user.id,
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Work order updated successfully",
      data: order,
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

    const order = await workOrderService.updateWorkOrder(id, {
      status: "CANCELLED",
      updated_by: user.id,
    });

    if (!order) {
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
