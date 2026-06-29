import { NextResponse } from "next/server";
import { ownerService } from "@/services/owner/owner.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const owner = await ownerService.getOwner(id);
    if (!owner) {
      return NextResponse.json(
        { success: false, message: "Owner not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Owner retrieved successfully",
      data: owner,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve owner";
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
    const owner = await ownerService.updateOwner(id, body);
    if (!owner) {
      return NextResponse.json(
        { success: false, message: "Owner not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Owner updated successfully",
      data: owner,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update owner";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await ownerService.archiveOwner(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Owner not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Owner archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive owner";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
