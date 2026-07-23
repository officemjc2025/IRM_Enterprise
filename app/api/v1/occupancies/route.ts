import { NextResponse } from "next/server";
import { occupancyService } from "@/services/occupancy/occupancy.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const occupancies = await occupancyService.getOccupanciesByScope(scope);
    return NextResponse.json({
      success: true,
      message: "Occupancies retrieved successfully",
      data: occupancies,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve occupancies";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const body = await request.json();

    if (!scope.isFullScope && !scope.isUnitAuthorized(body.unit_id)) {
      return NextResponse.json({ success: false, message: "Forbidden: You are not authorized to create occupancy for this unit." }, { status: 403 });
    }

    const occupancy = await occupancyService.createOccupancy(body);
    return NextResponse.json({
      success: true,
      message: "Occupancy created successfully",
      data: occupancy,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create occupancy";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
