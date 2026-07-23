import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 }
      );
    }

    const settings = await registrationService.getSettings(propertyId);
    return NextResponse.json({
      success: true,
      message: "Registration settings retrieved successfully",
      data: settings
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve settings";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { property_id, ...settingsDto } = body;

    if (!property_id) {
      return NextResponse.json({ success: false, message: "Property ID is required" }, { status: 400 });
    }

    // Property Admin and Office can edit only own property settings
    if ((role === "property_admin" || role === "office") && property_id !== profile.property_id) {
      return NextResponse.json({ success: false, message: "Forbidden: Property mismatch" }, { status: 403 });
    }

    const settings = await registrationService.updateSettings(property_id, settingsDto, user.id);
    return NextResponse.json({
      success: true,
      message: "Registration settings updated successfully",
      data: settings
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
