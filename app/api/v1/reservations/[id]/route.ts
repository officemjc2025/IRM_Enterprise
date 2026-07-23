import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workflowService, WorkflowEvent } from "@/services/workflow/workflow.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: resId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: reservation, error: dbErr } = await supabase
      .from("reservations")
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
        work_orders:work_orders!work_orders_stay_id_fkey (*),
        stay_charge_periods:stay_charge_periods (*)
      `)
      .eq("id", resId)
      .single();

    if (dbErr || !reservation) {
      return NextResponse.json({ success: false, message: "Reservation not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || reservation.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: reservation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: resId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Fetch current reservation to verify scoping and status
    const { data: currentRes } = await supabase
      .from("reservations")
      .select("property_id, status, unit_id, check_in_at, check_out_at")
      .eq("id", resId)
      .single();

    if (!currentRes) {
      return NextResponse.json({ success: false, message: "Reservation not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || currentRes.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    
    // Explicitly reject mixed lifecycle + unrelated edit payloads
    if (body.status === "CHECKED_IN" || body.status === "CHECKED_OUT") {
      const otherKeys = Object.keys(body).filter(k => k !== "status");
      if (otherKeys.length > 0) {
        return NextResponse.json({ success: false, message: "Cannot mix lifecycle status change with other edit fields" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};

    // Map editable fields
    if (body.internal_note !== undefined) updateData.internal_note = body.internal_note;
    if (body.guest_note !== undefined) updateData.guest_note = body.guest_note;
    if (body.adult_count !== undefined) updateData.adult_count = body.adult_count;
    if (body.child_count !== undefined) updateData.child_count = body.child_count;
    if (body.discount_amount !== undefined) updateData.discount_amount = body.discount_amount ? parseFloat(body.discount_amount) : null;
    if (body.deposit_amount !== undefined) updateData.deposit_amount = body.deposit_amount ? parseFloat(body.deposit_amount) : null;

    if (body.check_in_at !== undefined) updateData.check_in_at = body.check_in_at;
    if (body.check_out_at !== undefined) updateData.check_out_at = body.check_out_at;
    if (body.unit_id !== undefined) updateData.unit_id = body.unit_id;
    if (body.primary_guest_person_id !== undefined) updateData.primary_guest_person_id = body.primary_guest_person_id;
    if (body.reservation_type !== undefined) updateData.reservation_type = body.reservation_type;
    if (body.billing_basis !== undefined) updateData.billing_basis = body.billing_basis;
    if (body.monthly_rate !== undefined) updateData.monthly_rate = body.monthly_rate ? parseFloat(body.monthly_rate) : null;
    if (body.daily_rate !== undefined) updateData.daily_rate = body.daily_rate ? parseFloat(body.daily_rate) : null;
    if (body.base_rental_amount !== undefined) updateData.base_rental_amount = body.base_rental_amount ? parseFloat(body.base_rental_amount) : null;
    if (body.calculated_total_amount !== undefined) updateData.calculated_total_amount = body.calculated_total_amount ? parseFloat(body.calculated_total_amount) : null;
    if (body.approved_total_amount !== undefined) updateData.approved_total_amount = body.approved_total_amount ? parseFloat(body.approved_total_amount) : null;

    // Status transition & audit fields
    if (body.status !== undefined) {
      const nowStr = new Date().toISOString();
      const currentStatus = currentRes.status;

      if (body.status !== currentStatus) {
        if (body.status === "CONFIRMED") {
          if (!["DRAFT", "PENDING_CONFIRMATION"].includes(currentStatus)) {
            return NextResponse.json({ success: false, message: `Cannot transition status from ${currentStatus} to CONFIRMED` }, { status: 400 });
          }
          updateData.confirmed_by = user.id;
          updateData.confirmed_at = nowStr;
        } else if (body.status === "CANCELLED") {
          if (!["DRAFT", "PENDING_CONFIRMATION", "CONFIRMED"].includes(currentStatus)) {
            return NextResponse.json({ success: false, message: "Only draft, pending confirmation, or confirmed reservations can be cancelled" }, { status: 400 });
          }
          updateData.cancelled_by = user.id;
          updateData.cancelled_at = nowStr;
          updateData.cancellation_reason = body.cancellation_reason || "Cancelled by admin";
        } else if (body.status === "CHECKED_IN") {
          if (currentStatus !== "CONFIRMED") {
            return NextResponse.json({ success: false, message: "Only confirmed reservations can be checked in" }, { status: 400 });
          }
          updateData.checked_in_by = user.id;
          updateData.actual_check_in_at = nowStr;
        } else if (body.status === "CHECKED_OUT") {
          if (currentStatus !== "CHECKED_IN") {
            return NextResponse.json({ success: false, message: "Only active checked-in stays can be checked out" }, { status: 400 });
          }
          updateData.checked_out_by = user.id;
          updateData.actual_check_out_at = nowStr;
        } else if (body.status === "PENDING_CONFIRMATION") {
          if (currentStatus !== "DRAFT") {
            return NextResponse.json({ success: false, message: "Only draft reservations can be submitted for confirmation" }, { status: 400 });
          }
        } else {
          return NextResponse.json({ success: false, message: `Invalid target status transition: ${body.status}` }, { status: 400 });
        }
        updateData.status = body.status;
      }
    }

    // Edit policy matrix validation
    const status = currentRes.status;
    if (status === "CHECKED_OUT" || status === "CANCELLED") {
      const keys = Object.keys(updateData);
      if (keys.length > 1 || (keys.length === 1 && keys[0] !== "internal_note")) {
        return NextResponse.json({ success: false, message: "Completed or cancelled stays are read-only" }, { status: 400 });
      }
    }

    if (status === "CHECKED_IN") {
      const historicalFields = ["check_in_at", "check_out_at", "unit_id", "primary_guest_person_id", "monthly_rate", "base_rental_amount"];
      for (const field of historicalFields) {
        if (updateData[field] !== undefined) {
          return NextResponse.json({ success: false, message: `Cannot modify '${field}' for an active checked-in stay` }, { status: 400 });
        }
      }
    }

    // Date/Unit change overlap re-validation
    const targetUnit = (updateData.unit_id as string) || currentRes.unit_id;
    const targetCheckIn = (updateData.check_in_at as string) || currentRes.check_in_at;
    const targetCheckOut = (updateData.check_out_at as string) || currentRes.check_out_at;

    if (updateData.unit_id || updateData.check_in_at || updateData.check_out_at) {
      const { data: overlaps } = await supabase
        .from("reservations")
        .select("id, check_in_at, check_out_at")
        .eq("unit_id", targetUnit)
        .in("status", ["CONFIRMED", "CHECKED_IN"])
        .neq("id", resId);

      const hasOverlap = (overlaps || []).some(o => {
        const s1 = new Date(o.check_in_at).getTime();
        const e1 = new Date(o.check_out_at).getTime();
        const s2 = new Date(targetCheckIn).getTime();
        const e2 = new Date(targetCheckOut).getTime();
        return s1 < e2 && s2 < e1;
      });

      if (hasOverlap) {
        return NextResponse.json({ success: false, message: "Room conflict detected: dates overlap with another stay" }, { status: 400 });
      }
    }

    if (body.status === "CHECKED_IN") {
      const { error: rpcErr } = await supabase.rpc("check_in_reservation", {
        p_reservation_id: resId
      });
      if (rpcErr) {
        const { status, message } = mapRpcError(rpcErr);
        return NextResponse.json({ success: false, message }, { status });
      }

      const { data: updated, error: fetchErr } = await supabase
        .from("reservations")
        .select(`
          *,
          property:property_id (id, property_name_th, property_name_en),
          unit:unit_id (id, unit_number),
          primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
          work_orders:work_orders!work_orders_stay_id_fkey (*),
          stay_charge_periods:stay_charge_periods (*)
        `)
        .eq("id", resId)
        .single();
      if (fetchErr) throw fetchErr;

      return NextResponse.json({ success: true, data: updated });
    }

    if (body.status === "CHECKED_OUT") {
      const { error: rpcErr } = await supabase.rpc("check_out_reservation", {
        p_reservation_id: resId
      });
      if (rpcErr) {
        const { status, message } = mapRpcError(rpcErr);
        return NextResponse.json({ success: false, message }, { status });
      }

      const { data: updated, error: fetchErr } = await supabase
        .from("reservations")
        .select(`
          *,
          property:property_id (id, property_name_th, property_name_en),
          unit:unit_id (id, unit_number),
          primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
          work_orders:work_orders!work_orders_stay_id_fkey (*),
          stay_charge_periods:stay_charge_periods (*)
        `)
        .eq("id", resId)
        .single();
      if (fetchErr) throw fetchErr;

      // Trigger Checkout Workflow Event
      await workflowService.handleEvent(WorkflowEvent.CHECK_OUT, {
        unitId: updated.unit_id,
        propertyId: updated.property_id,
        actorId: user.id,
        stayId: updated.id,
        occupancyId: null, // this was a reservation stay, not an active owner/tenant resident assignment occupancy
      });

      return NextResponse.json({ success: true, data: updated });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", resId)
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
        work_orders:work_orders!work_orders_stay_id_fkey (*),
        stay_charge_periods:stay_charge_periods (*)
      `)
      .single();

    if (updateErr) throw updateErr;

    // Log edit to history using log_entity_change RPC
    const { error: rpcError } = await supabase.rpc("log_entity_change", {
      p_entity_type: "reservations",
      p_entity_id: resId,
      p_action_type: "EDIT",
      p_changed_fields: body,
      p_reason: null,
    });

    if (rpcError) {
      console.error("Audit log error:", rpcError);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id: resId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: currentRes } = await supabase
      .from("reservations")
      .select("property_id, status")
      .eq("id", resId)
      .single();

    if (!currentRes) {
      return NextResponse.json({ success: false, message: "Reservation not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || currentRes.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    if (currentRes.status === "CHECKED_IN") {
      return NextResponse.json({ success: false, message: "Cannot cancel an active stay; please perform check-out instead" }, { status: 400 });
    }

    if (currentRes.status === "CHECKED_OUT" || currentRes.status === "CANCELLED") {
      return NextResponse.json({ success: false, message: "Reservation is already completed or cancelled" }, { status: 400 });
    }

    let cancellationReason = "";
    try {
      const body = await request.json();
      if (body && body.cancellation_reason) {
        cancellationReason = body.cancellation_reason;
      }
    } catch {
      // Ignore
    }

    // Cancellation reason must be non-empty after trimming
    if (!cancellationReason || !cancellationReason.trim()) {
      return NextResponse.json({ success: false, message: "Cancellation reason must be non-empty" }, { status: 400 });
    }

    const nowStr = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
      .from("reservations")
      .update({
        status: "CANCELLED",
        cancelled_by: user.id,
        cancelled_at: nowStr,
        cancellation_reason: cancellationReason.trim()
      })
      .eq("id", resId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Log cancellation to history using log_entity_change RPC
    const { error: rpcError } = await supabase.rpc("log_entity_change", {
      p_entity_type: "reservations",
      p_entity_id: resId,
      p_action_type: "CANCEL",
      p_changed_fields: { status: "CANCELLED" },
      p_reason: cancellationReason.trim(),
    });

    if (rpcError) {
      console.error("Audit log error:", rpcError);
    }

    return NextResponse.json({ success: true, message: "Reservation cancelled successfully", data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

function mapRpcError(err: { message: string }) {
  const msg = err.message || "";
  
  if (msg.includes("Unauthenticated")) {
    return { status: 401, message: "Authentication required" };
  }
  if (msg.includes("Forbidden") || msg.includes("cross-property")) {
    return { status: 403, message: "Forbidden: You are not authorized to perform this action" };
  }
  if (msg.includes("Reservation not found")) {
    return { status: 404, message: "Reservation not found" };
  }
  if (msg.includes("Occupancy conflict")) {
    return { status: 409, message: "Occupancy conflict: Another reservation is already checked-in for this unit during this period" };
  }
  if (msg.includes("Only confirmed reservations") || msg.includes("Only active checked-in stays")) {
    return { status: 409, message: msg };
  }
  
  return { status: 400, message: "Transaction failed: validation error" };
}
