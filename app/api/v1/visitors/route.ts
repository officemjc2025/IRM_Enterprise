import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";
import { Visitor } from "@/features/visitor/types/visitor.types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get("filter") || "today"; // 'today', 'queue', 'history'

    let visitors: Visitor[] = [];
    if (filterType === "queue") {
      visitors = await visitorService.getQueueVisitors();
    } else if (filterType === "history") {
      visitors = await visitorService.getHistoryVisitors();
    } else {
      visitors = await visitorService.getTodayVisitors();
    }

    // Security check: Non-admins can only view their authorized visitor requests
    if (!scope.isFullScope) {
      if (!scope.assignmentIds || scope.assignmentIds.length === 0) {
        visitors = [];
      } else {
        visitors = visitors.filter((v) =>
          (v.resident_assignment_id && scope.assignmentIds.includes(v.resident_assignment_id)) ||
          (v.resident_assignment?.unit_id && scope.authorizedUnitIds.includes(v.resident_assignment.unit_id))
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Visitors retrieved successfully",
      data: visitors,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve visitors";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const body = await request.json();

    // Security check: Resident can only request for their authorized assignment
    if (!scope.isFullScope) {
      const isAssignmentValid = body.resident_assignment_id && scope.assignmentIds.includes(body.resident_assignment_id);

      if (!isAssignmentValid) {
        return NextResponse.json(
          { success: false, message: "Forbidden: Invalid or unauthorized resident assignment specified" },
          { status: 403 }
        );
      }
    }

    const visitor = await visitorService.createVisitor({
      ...body,
      created_by: scope.profileId,
    });

    return NextResponse.json({
      success: true,
      message: "Visitor request created successfully",
      data: visitor,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create visitor request";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
