import { NextResponse } from "next/server";
import { ownershipService } from "@/services/ownership/ownership.service";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedUnitScope } from "@/lib/auth/scope";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    let ownerships = await ownershipService.getOwnerships();

    if (!scope.isFullScope) {
      if (!scope.authorizedUnitIds || scope.authorizedUnitIds.length === 0) {
        ownerships = [];
      } else {
        ownerships = ownerships.filter((o) => o.unit_id && scope.authorizedUnitIds.includes(o.unit_id));
      }
    }

    return NextResponse.json({
      success: true,
      message: "Ownerships retrieved successfully",
      data: ownerships,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve ownerships";
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
    const ownership = await ownershipService.createOwnership(body);
    return NextResponse.json({
      success: true,
      message: "Ownership created successfully",
      data: ownership,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to create ownership";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
