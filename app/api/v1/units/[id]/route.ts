import { NextResponse } from "next/server";
import { unitService } from "@/services/unit/unit.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const unit = await unitService.getUnit(id);
    if (!unit) {
      return NextResponse.json(
        { success: false, message: "Unit not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Unit retrieved successfully",
      data: unit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve unit";
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
    const unit = await unitService.updateUnit(id, body);
    if (!unit) {
      return NextResponse.json(
        { success: false, message: "Unit not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Unit updated successfully",
      data: unit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update unit";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await unitService.archiveUnit(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Unit not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Unit archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive unit";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
