import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
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

    const body = await request.json();
    const { service_team, assigned_to } = body;

    if (!service_team || !["TECHNICIAN", "HOUSEKEEPING"].includes(service_team)) {
      return NextResponse.json({ success: false, message: "A valid execution service_team (TECHNICIAN/HOUSEKEEPING) is required" }, { status: 400 });
    }

    // Call atomic convert RPC function
    const { data: workOrder, error: rpcErr } = await supabase.rpc(
      "convert_booking_to_work_order",
      {
        p_booking_id: bookingId,
        p_service_team: service_team,
        p_assigned_to: assigned_to || null
      }
    );

    if (rpcErr) {
      return NextResponse.json({ success: false, message: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Work order generated and dispatched successfully",
      data: workOrder
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
