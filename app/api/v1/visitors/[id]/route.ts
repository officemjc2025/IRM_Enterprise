import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";
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

    const visitor = await visitorService.getVisitorById(id);
    if (!visitor) {
      return NextResponse.json(
        { success: false, message: "Visitor session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Visitor retrieved successfully",
      data: visitor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve visitor";
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
    const visitor = await visitorService.updateVisitor(id, {
      ...body,
      updated_by: user.id,
    });

    if (!visitor) {
      return NextResponse.json(
        { success: false, message: "Visitor not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Visitor request updated successfully",
      data: visitor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update visitor request";
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

    const success = await visitorService.updateVisitor(id, {
      status: "CANCELLED",
      updated_by: user.id,
    });

    if (!success) {
      return NextResponse.json(
        { success: false, message: "Visitor not found or cancel failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Visitor request cancelled successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to cancel visitor request";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
