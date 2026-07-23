import { NextResponse } from "next/server";
import { staffService } from "@/features/staff/services/staff.service";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin", "office"].includes(profile.role);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const targetStaff = await staffService.getStaffById(id);
    if (!targetStaff) {
      return NextResponse.json(
        { success: false, message: "Staff member not found" },
        { status: 444 }
      );
    }

    // Property Admins and Office are restricted to their own property's staff
    if (["property_admin", "office"].includes(profile.role) && targetStaff.property_id && targetStaff.property_id !== profile.property_id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    await staffService.resetPassword(id, user.id);

    return NextResponse.json({
      success: true,
      message: "Password reset instructions sent successfully."
    });

  } catch (error: unknown) {
    console.error("POST /api/v1/staff/[id]/reset-password error:", error);
    const message = error instanceof Error ? error.message : "Failed to reset password.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
