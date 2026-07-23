import { NextResponse } from "next/server";
import { unitService } from "@/services/unit/unit.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const units = await unitService.getUnitsByScope(scope);
    return NextResponse.json({
      success: true,
      message: "Units retrieved successfully",
      data: units,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve units";
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
    const unit = await unitService.createUnit(body);
    return NextResponse.json({
      success: true,
      message: "Unit created successfully",
      data: unit,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create unit";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
