import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: bookingId } = await params;
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

    const { data: booking, error: dbErr } = await supabase
      .from("service_bookings")
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        customer:customer_person_id (id, first_name, last_name, display_name),
        work_order:work_order_id (*)
      `)
      .eq("id", bookingId)
      .single();

    if (dbErr || !booking) {
      return NextResponse.json({ success: false, message: "Service booking not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || booking.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: booking });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: bookingId } = await params;
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

    // 1. Fetch current booking to verify ownership/scoping
    const { data: currentBooking } = await supabase
      .from("service_bookings")
      .select("property_id, status, work_order_id")
      .eq("id", bookingId)
      .single();

    if (!currentBooking) {
      return NextResponse.json({ success: false, message: "Service booking not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || currentBooking.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Map editable fields
    if (body.admin_note !== undefined) updateData.admin_note = body.admin_note;
    if (body.customer_note !== undefined) updateData.customer_note = body.customer_note;
    if (body.requested_start_at !== undefined) updateData.requested_start_at = body.requested_start_at;
    if (body.requested_end_at !== undefined) updateData.requested_end_at = body.requested_end_at;
    if (body.quoted_amount !== undefined) updateData.quoted_amount = body.quoted_amount ? parseFloat(body.quoted_amount) : null;
    if (body.confirmed_amount !== undefined) updateData.confirmed_amount = body.confirmed_amount ? parseFloat(body.confirmed_amount) : null;

    // Status transition & audit fields
    if (body.status !== undefined) {
      if (body.status === "CANCELLED") {
        return NextResponse.json({ success: false, message: "Please use DELETE method to cancel service bookings" }, { status: 400 });
      }
      updateData.status = body.status;
      if (body.status === "CONFIRMED") {
        updateData.confirmed_by = user.id;
        updateData.confirmed_at = new Date().toISOString();
      }
    }

    // Edit policy matrix validation
    const status = currentBooking.status;
    if (status === "COMPLETED" || status === "CANCELLED") {
      const keys = Object.keys(updateData);
      if (keys.length > 1 || (keys.length === 1 && keys[0] !== "admin_note")) {
        return NextResponse.json({ success: false, message: "Completed or cancelled bookings are read-only" }, { status: 400 });
      }
    }

    if (currentBooking.work_order_id) {
      const restrictedFields = ["requested_start_at", "requested_end_at", "service_type"];
      for (const field of restrictedFields) {
        if (updateData[field] !== undefined) {
          return NextResponse.json({ success: false, message: `Cannot modify '${field}' once work order has been dispatched` }, { status: 400 });
        }
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from("service_bookings")
      .update(updateData)
      .eq("id", bookingId)
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        customer:customer_person_id (id, first_name, last_name, display_name),
        work_order:work_order_id (*)
      `)
      .single();

    if (updateErr) throw updateErr;

    // Log edit to history using database RPC
    const { error: rpcError } = await supabase.rpc("log_entity_change", {
      p_entity_type: "service_bookings",
      p_entity_id: bookingId,
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
    const { id: bookingId } = await params;
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

    // Call the database transaction RPC cancel_service_booking
    const { error: rpcError } = await supabase.rpc("cancel_service_booking", {
      p_booking_id: bookingId,
      p_cancellation_reason: cancellationReason.trim()
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Booking cancelled successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
