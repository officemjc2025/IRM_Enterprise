// PATCH /api/v1/units/:id/status
// Single authoritative endpoint for operational status transitions.
//
// Architecture rule:
//   Only this route may change units.operational_status.
//   Owner Assignment, Resident Assignment, and Meter modules
//   MUST NOT call this endpoint or write operational_status directly.
//   Only Work Order lifecycle (via work-orders route) may call this
//   indirectly for units whose WO has affects_operational_status = true.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unitService } from "@/services/unit/unit.service";
import {
  UnitOperationalStatus,
  UNIT_OPERATIONAL_STATUSES,
  STATUS_CHANGE_ALLOWED_ROLES,
} from "@/shared/enums/unit-operational-status";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // --- Auth ---
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // --- Role Guard: only property_admin, admin, super_admin ---
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    if (!(STATUS_CHANGE_ALLOWED_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Forbidden: Only Admin, Property Admin, and Super Admin may change Operational Status.",
        },
        { status: 403 }
      );
    }

    // --- Parse Body ---
    const body = await request.json();
    const { operational_status, reason } = body as {
      operational_status: UnitOperationalStatus;
      reason?: string;
    };

    if (!operational_status || !UNIT_OPERATIONAL_STATUSES.includes(operational_status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid operational_status. Must be one of: ${UNIT_OPERATIONAL_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // --- Fetch current unit ---
    const currentUnit = await unitService.getUnit(id);
    if (!currentUnit) {
      return NextResponse.json(
        { success: false, message: "Unit not found" },
        { status: 404 }
      );
    }

    const previousStatus = currentUnit.operational_status;

    // No-op check
    if (previousStatus === operational_status) {
      return NextResponse.json({
        success: true,
        message: "Operational status unchanged (already set to this value)",
        data: currentUnit,
      });
    }

    // --- Apply Status Change ---
    const updatedUnit = await unitService.changeOperationalStatus(id, operational_status);
    if (!updatedUnit) {
      return NextResponse.json(
        { success: false, message: "Unit update failed" },
        { status: 500 }
      );
    }

    // --- Audit Trail ---
    // Log to entity_change_history using the secure public.log_entity_change RPC.
    // This enforces RLS, validates actor authorization, and resolves actor_id server-side.
    const { error: rpcError } = await supabase.rpc("log_entity_change", {
      p_entity_type: "units",
      p_entity_id: id,
      p_action_type: "EDIT",
      p_changed_fields: {
        operational_status: {
          from: previousStatus,
          to: operational_status,
        },
      },
      p_reason: reason?.trim() || `Status changed from ${previousStatus} to ${operational_status}`,
    });

    if (rpcError) {
      console.error("Audit log error:", rpcError);
      throw new Error(`Audit logging failed: ${rpcError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Unit operational status changed: ${previousStatus} → ${operational_status}`,
      data: updatedUnit,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to change operational status";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// GET — returns the status history for a unit
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("entity_change_history")
      .select("*")
      .eq("entity_type", "units")
      .eq("entity_id", id)
      .eq("action_type", "STATUS_CHANGE")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve status history";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
