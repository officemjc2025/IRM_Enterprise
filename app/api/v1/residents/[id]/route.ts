import { NextResponse } from "next/server";
import { residentAssignmentService } from "@/services/resident-assignment/resident-assignment.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const assignment = await residentAssignmentService.getAssignment(id);
    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Resident assignment not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Resident assignment retrieved successfully",
      data: assignment,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve resident assignment";
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
    const assignment = await residentAssignmentService.updateAssignment(id, body);
    if (!assignment) {
      return NextResponse.json(
        { success: false, message: "Resident assignment not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Resident assignment updated successfully",
      data: assignment,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update resident assignment";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await residentAssignmentService.archiveAssignment(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Resident assignment not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Resident assignment archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive resident assignment";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
