import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";
import { createClient } from "@/lib/supabase/server";

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

    const { visitor_id } = await request.json();

    if (!visitor_id) {
      return NextResponse.json(
        { success: false, message: "visitor_id is required" },
        { status: 400 }
      );
    }

    // Phase 1: INSIDE -> CHECKED_OUT
    await visitorService.updateVisitor(visitor_id, {
      status: "CHECKED_OUT",
      updated_by: user.id,
      actual_checkout_time: new Date().toISOString(),
    });

    // Phase 2: CHECKED_OUT -> CLOSED
    const updatedVisitor = await visitorService.updateVisitor(visitor_id, {
      status: "CLOSED",
      updated_by: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Visitor checked out successfully",
      data: updatedVisitor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check out visitor";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
