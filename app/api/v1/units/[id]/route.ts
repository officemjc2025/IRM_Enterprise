/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { unitService } from "@/services/unit/unit.service";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const unit = await unitService.getUnit(id);
    if (!unit) {
      return NextResponse.json(
        { success: false, message: "Unit not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Unit retrieved successfully",
      data: unit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve unit";
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

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isSuperAdmin = profile?.role === "super_admin";

    const currentUnit = await unitService.getUnit(id);
    if (!currentUnit) {
      return NextResponse.json({ success: false, message: "Unit not found" }, { status: 404 });
    }

    const triesToModifyProperty = body.property_id !== undefined && body.property_id !== currentUnit.property_id;
    const triesToModifyUnitNumber = body.unit_number !== undefined && body.unit_number !== currentUnit.unit_number;
    const triesToModifyRatio = body.ownership_ratio !== undefined && Number(body.ownership_ratio) !== Number(currentUnit.ownership_ratio);

    if (!isSuperAdmin && (triesToModifyProperty || triesToModifyUnitNumber || triesToModifyRatio)) {
      return NextResponse.json({
        success: false,
        message: "Forbidden: Only Super Admins can modify immutable Unit Master properties (Property, Unit Number, Ownership Ratio)."
      }, { status: 403 });
    }

    if (isSuperAdmin && (triesToModifyProperty || triesToModifyUnitNumber || triesToModifyRatio)) {
      const changedFields: Record<string, any> = {};
      if (triesToModifyProperty) changedFields.property_id = { from: currentUnit.property_id, to: body.property_id };
      if (triesToModifyUnitNumber) changedFields.unit_number = { from: currentUnit.unit_number, to: body.unit_number };
      if (triesToModifyRatio) changedFields.ownership_ratio = { from: currentUnit.ownership_ratio, to: body.ownership_ratio };

      await supabase.from("entity_change_history").insert({
        entity_type: "units",
        entity_id: id,
        action_type: "EDIT",
        changed_fields: changedFields,
        reason: "Super Admin override of immutable Master Data in Room Editor",
        actor_id: user.id
      });
    }

    const unit = await unitService.updateUnit(id, body);
    if (!unit) {
      return NextResponse.json(
        { success: false, message: "Unit not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Unit updated successfully",
      data: unit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update unit";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await unitService.archiveUnit(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Unit not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Unit archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive unit";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
