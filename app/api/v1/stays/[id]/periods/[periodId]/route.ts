import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string; periodId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { periodId } = await params;
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

    // Fetch existing period to verify property scoping
    const { data: currentPeriod } = await supabase
      .from("stay_charge_periods")
      .select("*")
      .eq("id", periodId)
      .single();

    if (!currentPeriod) {
      return NextResponse.json({ success: false, message: "Stay period record not found" }, { status: 404 });
    }

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id || currentPeriod.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // Map fields
    if (body.water_amount !== undefined) updateData.water_amount = body.water_amount ? parseFloat(body.water_amount) : null;
    if (body.water_status !== undefined) updateData.water_status = body.water_status;
    
    if (body.electricity_amount !== undefined) updateData.electricity_amount = body.electricity_amount ? parseFloat(body.electricity_amount) : null;
    if (body.electricity_status !== undefined) updateData.electricity_status = body.electricity_status;
    
    if (body.rent_status !== undefined) updateData.rent_status = body.rent_status;
    if (body.overall_status !== undefined) {
      updateData.overall_status = body.overall_status;
      updateData.status_changed_by = user.id;
      updateData.status_changed_at = new Date().toISOString();
    }
    
    if (body.other_amount !== undefined) updateData.other_amount = parseFloat(body.other_amount) || 0;
    if (body.discount_amount !== undefined) updateData.discount_amount = parseFloat(body.discount_amount) || 0;
    
    if (body.paid_amount !== undefined) updateData.paid_amount = parseFloat(body.paid_amount) || 0;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.approved_total !== undefined) updateData.approved_total = body.approved_total ? parseFloat(body.approved_total) : null;

    // Recalculate totals
    const rent = currentPeriod.rent_amount;
    const water = updateData.water_amount !== undefined ? updateData.water_amount : (currentPeriod.water_amount || 0);
    const electricity = updateData.electricity_amount !== undefined ? updateData.electricity_amount : (currentPeriod.electricity_amount || 0);
    const other = updateData.other_amount !== undefined ? updateData.other_amount : currentPeriod.other_amount;
    const disc = updateData.discount_amount !== undefined ? updateData.discount_amount : currentPeriod.discount_amount;
    const paid = updateData.paid_amount !== undefined ? updateData.paid_amount : currentPeriod.paid_amount;

    const expected = Math.max(0, rent + water + electricity + other - disc);
    if (paid > expected) {
      return NextResponse.json({ success: false, message: "Payment amount cannot exceed expected total amount" }, { status: 400 });
    }
    updateData.expected_total = expected;
    updateData.outstanding_amount = expected - paid;

    const { data: updated, error: updateErr } = await supabase
      .from("stay_charge_periods")
      .update(updateData)
      .eq("id", periodId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: "Stay period charge updated successfully",
      data: updated
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
