import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
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

    const role = profile?.role;
    const isAdmin = role && ["admin", "super_admin", "property_admin", "office"].includes(role);

    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let propertyId = searchParams.get("property_id") || undefined;

    // Enforce scoping for property_admin and office
    if (role === "property_admin" || role === "office") {
      if (propertyId && propertyId !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: Property mismatch" }, { status: 403 });
      }
      propertyId = profile.property_id || undefined;
    }

    const stats = await registrationService.getStats(propertyId);
    return NextResponse.json({
      success: true,
      message: "Registration statistics retrieved successfully",
      data: stats
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve statistics";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
