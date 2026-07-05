import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
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

    // 1. Fetch reservation
    const { data: reservation } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", resId)
      .single();

    if (!reservation) {
      return NextResponse.json({ success: false, message: "Reservation not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || reservation.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const {
      title,
      description,
      service_team,
      scheduled_at,
      assigned_to,
      priority,
      category
    } = body;

    if (!title || !service_team || !scheduled_at || !category) {
      return NextResponse.json({ success: false, message: "Missing required fields (title, service_team, scheduled_at, category)" }, { status: 400 });
    }

    // 2. Validate Assignee Role and Team
    if (assigned_to) {
      const { data: assigneeProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", assigned_to)
        .single();

      if (!assigneeProfile) {
        return NextResponse.json({ success: false, message: "Assignee profile not found" }, { status: 400 });
      }

      if (service_team === "HOUSEKEEPING" && assigneeProfile.role !== "housekeeping") {
        return NextResponse.json({ success: false, message: "Housekeeping jobs must be assigned to housekeeping staff only" }, { status: 400 });
      }

      if (service_team === "TECHNICIAN" && assigneeProfile.role !== "technician") {
        return NextResponse.json({ success: false, message: "Technician jobs must be assigned to technician staff only" }, { status: 400 });
      }
    }

    // 3. Generate concurrency-safe work order code
    const { data: woCode, error: codeErr } = await supabase.rpc("get_next_work_order_code");
    if (codeErr || !woCode) {
      return NextResponse.json({ success: false, message: "Failed to generate work order code: " + (codeErr?.message || "") }, { status: 500 });
    }

    // Find resident assignment id for guest if they exist
    let residentAssignmentId = null;
    if (reservation.primary_guest_person_id) {
      const { data: ra } = await supabase
        .from("resident_assignments")
        .select("id")
        .eq("person_id", reservation.primary_guest_person_id)
        .eq("unit_id", reservation.unit_id)
        .limit(1)
        .maybeSingle();

      if (ra) {
        residentAssignmentId = ra.id;
      }
    }

    // 4. Create Work Order
    const { data: workOrder, error: insertErr } = await supabase
      .from("work_orders")
      .insert({
        work_order_code: woCode,
        property_id: reservation.property_id,
        unit_id: reservation.unit_id,
        resident_assignment_id: residentAssignmentId,
        category,
        title,
        description: description || null,
        priority: priority || "NORMAL",
        status: assigned_to ? "ASSIGNED" : "NEW",
        assigned_to: assigned_to || null,
        scheduled_at,
        service_team,
        reservation_id: resId,
        created_by: user.id
      })
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, message: insertErr.message }, { status: 550 });
    }

    return NextResponse.json({
      success: true,
      message: "Work order created successfully from reservation",
      data: workOrder
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
