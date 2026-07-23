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

    const occupancy = await occupancyService.getOccupancy(id);
    if (!occupancy) {
      return NextResponse.json({ success: false, message: "Occupancy not found" }, { status: 404 });
    }

    if (!scope.isUnitAuthorized(occupancy.unit_id)) {
      return NextResponse.json({ success: false, message: "Forbidden: You are not authorized to view this occupancy." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      message: "Occupancy retrieved successfully",
      data: occupancy,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve occupancy";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const existing = await occupancyService.getOccupancy(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Occupancy not found" }, { status: 404 });
    }

    if (!scope.isUnitAuthorized(existing.unit_id)) {
      return NextResponse.json({ success: false, message: "Forbidden: You are not authorized to modify this occupancy." }, { status: 403 });
    }

    const body = await request.json();
    const occupancy = await occupancyService.updateOccupancy(id, body);
    return NextResponse.json({
      success: true,
      message: "Occupancy updated successfully",
      data: occupancy,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to update occupancy";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const scope = await getAuthorizedUnitScope(supabase, undefined, request);

    const existing = await occupancyService.getOccupancy(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Occupancy not found" }, { status: 404 });
    }

    if (!scope.isFullScope) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required to archive occupancies." }, { status: 403 });
    }

    const success = await occupancyService.archiveOccupancy(id);
    if (!success) {
      return NextResponse.json({ success: false, message: "Occupancy not found or archive failed" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Occupancy archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed to archive occupancy";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
