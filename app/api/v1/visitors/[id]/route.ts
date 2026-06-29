import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const visitor = await visitorService.getVisitor(id);
    if (!visitor) {
      return NextResponse.json(
        { success: false, message: "Visitor not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Visitor details retrieved successfully",
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

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const visitor = await visitorService.checkOutVisitor(id);
    if (!visitor) {
      return NextResponse.json(
        { success: false, message: "Visitor not found or failed to check out" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Visitor checked out successfully",
      data: visitor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check out visitor";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
