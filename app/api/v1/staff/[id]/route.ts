import { NextResponse } from "next/server";
import { staffService } from "@/features/staff/services/staff.service";
import { createClient } from "@/lib/supabase/server";
import { updateStaffSchema } from "@/features/staff/schemas/staff.schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
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

    const staff = await staffService.getStaffById(id);
    if (!staff) {
      return NextResponse.json(
        { success: false, message: "Staff member not found" },
        { status: 444 }
      );
    }

    // Property Admins can only view staff of their own property (or global staff)
    if (profile.role === "property_admin" && staff.property_id && staff.property_id !== profile.property_id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: staff });

  } catch (error: unknown) {
    console.error("GET /api/v1/staff/[id] error:", error);
    const message = error instanceof Error ? error.message : "Failed to retrieve staff details.";
    return NextResponse.json({ success: false, message }, { status: 550 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

    const currentStaff = await staffService.getStaffById(id);
    if (!currentStaff) {
      return NextResponse.json(
        { success: false, message: "Staff member not found" },
        { status: 444 }
      );
    }

    // Property Admins and Office are restricted to their own property's staff
    if (["property_admin", "office"].includes(profile.role) && currentStaff.property_id && currentStaff.property_id !== profile.property_id) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const updatedStaff = await staffService.updateStaff(id, parsed.data, user.id);
    return NextResponse.json({
      success: true,
      message: "Staff updated successfully",
      data: updatedStaff
    });

  } catch (error: unknown) {
    console.error("PATCH /api/v1/staff/[id] error:", error);
    const message = error instanceof Error ? error.message : "Failed to update staff.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

    // Check permissions (soft delete is super_admin or admin only, property_admin cannot hard delete staff)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isSuperAdmin = profile && ["super_admin", "admin"].includes(profile.role);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    await staffService.deleteStaff(id, user.id);
    return NextResponse.json({ success: true, message: "Staff archived successfully" });

  } catch (error: unknown) {
    console.error("DELETE /api/v1/staff/[id] error:", error);
    const message = error instanceof Error ? error.message : "Failed to archive staff.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
