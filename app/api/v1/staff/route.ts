import { NextResponse } from "next/server";
import { staffService } from "@/features/staff/services/staff.service";
import { createClient } from "@/lib/supabase/server";
import { createStaffSchema } from "@/features/staff/schemas/staff.schema";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Retrieve user profile to check role
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

    const { searchParams } = new URL(request.url);

    // If stats requested
    if (searchParams.get("stats") === "true") {
      // property_admin and office are restricted to their own property's stats
      const targetPropertyId = ["property_admin", "office"].includes(profile.role)
        ? (profile.property_id || undefined)
        : (searchParams.get("propertyId") || undefined);

      const stats = await staffService.getStaffStats(targetPropertyId);
      return NextResponse.json({ success: true, data: stats });
    }

    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;
    const propertyId = ["property_admin", "office"].includes(profile.role)
      ? (profile.property_id || undefined)
      : (searchParams.get("propertyId") || undefined);
    const department = searchParams.get("department") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const result = await staffService.getStaffList({
      search,
      role,
      propertyId,
      department,
      status,
      page,
      limit
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total
    });

  } catch (error: unknown) {
    console.error("GET /api/v1/staff error:", error);
    const message = error instanceof Error ? error.message : "Failed to retrieve staff.";
    return NextResponse.json({ success: false, message }, { status: 550 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin", "office"].includes(profile.role);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request schema
    const parsed = createStaffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.format() },
        { status: 400 }
      );
    }

    const createdStaff = await staffService.createStaff(parsed.data, user.id);
    return NextResponse.json({
      success: true,
      message: "Staff created successfully",
      data: createdStaff,
      pin: (createdStaff as { pin?: string }).pin
    });

  } catch (error: unknown) {
    console.error("POST /api/v1/staff error:", error);
    const message = error instanceof Error ? error.message : "Failed to create staff.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
