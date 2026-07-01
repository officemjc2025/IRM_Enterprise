import { NextResponse } from "next/server";
import { residentAssignmentService } from "@/services/resident-assignment/resident-assignment.service";

export async function GET() {
  try {
    const assignments = await residentAssignmentService.getAssignments();
    return NextResponse.json({
      success: true,
      message: "Resident assignments retrieved successfully",
      data: assignments,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve resident assignments";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const assignment = await residentAssignmentService.createAssignment(body);
    return NextResponse.json({
      success: true,
      message: "Resident assigned successfully",
      data: assignment,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to assign resident";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
