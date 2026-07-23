import { NextResponse } from "next/server";
import { occupancyService } from "@/services/occupancy/occupancy.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    if (!scope.isUnitAuthorized(id)) {
      return NextResponse.json(
        { success: false, message: "Forbidden: You are not authorized to view occupancies for this unit." },
        { status: 403 }
      );
    }

    const occupancies = await occupancyService.getOccupanciesByUnitAndScope(id, scope);
    return NextResponse.json({
      success: true,
      message: "Unit occupancies retrieved successfully",
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
