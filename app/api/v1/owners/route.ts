import { NextResponse } from "next/server";
import { ownerService } from "@/services/owner/owner.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    if (!scope.isFullScope) {
      return NextResponse.json({
        success: true,
        message: "Owners retrieved successfully",
        data: [],
      });
    }

    const owners = await ownerService.getOwners();
    return NextResponse.json({
      success: true,
      message: "Owners retrieved successfully",
      data: owners,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve owners";
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
    const owner = await ownerService.createOwner(body);
    return NextResponse.json({
      success: true,
      message: "Owner created successfully",
      data: owner,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create owner";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
