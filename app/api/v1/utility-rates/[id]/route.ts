import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: rateId } = await params;
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

    if (!profile) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: rate, error } = await supabase
      .from("utility_rates")
      .select("*")
      .eq("id", rateId)
      .single();

    if (error || !rate) {
      return NextResponse.json({ success: false, message: "Utility rate not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || rate.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: rate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id: rateId } = await params;
    const body = await request.json();
    const { effective_to, is_active, rate_per_unit } = body;

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

    const isAuthorized = profile && ["super_admin", "admin", "property_admin"].includes(profile.role);
    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { data: existingRate } = await supabase
      .from("utility_rates")
      .select("*")
      .eq("id", rateId)
      .single();

    if (!existingRate) {
      return NextResponse.json({ success: false, message: "Utility rate not found" }, { status: 404 });
    }

    if (profile.role === "property_admin") {
      if (!profile.property_id || existingRate.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property rates update denied" }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (effective_to !== undefined) updateData.effective_to = effective_to || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (rate_per_unit !== undefined) updateData.rate_per_unit = rate_per_unit;

    const { data: rate, error } = await supabase
      .from("utility_rates")
      .update(updateData)
      .eq("id", rateId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    // Audit Log
    await supabase.rpc("log_entity_change", {
      p_entity_type: "utility_rates",
      p_entity_id: rate.id,
      p_action_type: "EDIT",
      p_changed_fields: { before: existingRate, after: rate },
      p_reason: "Edit utility rate configuration"
    });

    return NextResponse.json({ success: true, data: rate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
