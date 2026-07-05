import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string; extId: string }>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { extId } = await params;
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
    const { approved_amount } = body;

    if (approved_amount === undefined || parseFloat(approved_amount) < 0) {
      return NextResponse.json({ success: false, message: "A valid approved_amount is required" }, { status: 400 });
    }

    // Call atomic approve RPC function
    const { data: reservation, error: rpcErr } = await supabase.rpc(
      "approve_reservation_extension",
      {
        p_extension_id: extId,
        p_approved_amount: parseFloat(approved_amount)
      }
    );

    if (rpcErr) {
      return NextResponse.json({ success: false, message: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Stay extension approved and room inventory updated successfully",
      data: reservation
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
