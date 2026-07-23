import { NextResponse } from "next/server";
import { residentAssignmentService } from "@/services/resident-assignment/resident-assignment.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get("unit_id");

    if (unitId && !scope.isUnitAuthorized(unitId)) {
      return NextResponse.json({ success: false, message: "Forbidden: You are not authorized to view assignments for this unit." }, { status: 403 });
    }

    const assignments = unitId
      ? await residentAssignmentService.getAssignmentsByUnitAndScope(unitId, scope)
      : await residentAssignmentService.getAssignmentsByScope(scope);

    return NextResponse.json({
      success: true,
      message: "Resident assignments retrieved successfully",
      data: assignments,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve resident assignments";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    if (!scope.isFullScope) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const assignment = await residentAssignmentService.createAssignment(body);
    return NextResponse.json({
      success: true,
      message: "Resident assigned successfully",
      data: assignment,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to assign resident";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
