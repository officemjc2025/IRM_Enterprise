import { NextResponse } from "next/server";
import { ownershipService } from "@/services/ownership/ownership.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const ownership = await ownershipService.getOwnership(id);
    if (!ownership) {
      return NextResponse.json(
        { success: false, message: "Ownership not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Ownership retrieved successfully",
      data: ownership,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve ownership";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ownership = await ownershipService.updateOwnership(id, body);
    if (!ownership) {
      return NextResponse.json(
        { success: false, message: "Ownership not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Ownership updated successfully",
      data: ownership,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update ownership";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await ownershipService.archiveOwnership(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Ownership not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Ownership archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive ownership";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
