import { NextResponse } from "next/server";
import { occupancyService } from "@/services/occupancy/occupancy.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const occupancy = await occupancyService.getOccupancy(id);
    if (!occupancy) {
      return NextResponse.json(
        { success: false, message: "Occupancy not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Occupancy retrieved successfully",
      data: occupancy,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve occupancy";
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
    const occupancy = await occupancyService.updateOccupancy(id, body);
    if (!occupancy) {
      return NextResponse.json(
        { success: false, message: "Occupancy not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Occupancy updated successfully",
      data: occupancy,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update occupancy";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await occupancyService.archiveOccupancy(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Occupancy not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Occupancy archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive occupancy";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
