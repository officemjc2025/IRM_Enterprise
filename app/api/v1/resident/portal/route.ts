import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveIdentity } from "@/lib/identity/resolver";

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

    const { searchParams } = new URL(request.url);
    const impersonateEmail = searchParams.get("impersonate");

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);

    let targetUserId = user.id;

    if (isAdmin && impersonateEmail && impersonateEmail.trim() !== "") {
      // Find the profile of the user to impersonate
      const { data: impProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", impersonateEmail.trim())
        .maybeSingle();

      if (impProfile) {
        targetUserId = impProfile.id;
      } else {
        return NextResponse.json(
          { success: false, message: `Impersonation target profile '${impersonateEmail}' not found` },
          { status: 400 }
        );
      }
    }

    // Resolve Identity using canonical resolver
    const resolved = await resolveIdentity(supabase, targetUserId);

    if (!resolved) {
      return NextResponse.json(
        { success: false, message: "Failed to resolve account profile" },
        { status: 400 }
      );
    }

    // Map DB fields to the expected UI keys
    const mappedAssignments = resolved.assignments.map((assignment) => {
      return {
        id: assignment.id,
        person_id: resolved.person?.id || "",
        unit_id: assignment.unit_id,
        occupancy_type: assignment.resident_type,
        primary_resident: assignment.is_primary,
        move_in_date: "",
        move_out_date: null,
        status: "ACTIVE",
        remark: "",
        unit: {
          id: assignment.unit_id,
          unit_number: assignment.unit_number,
          building_code: assignment.building_code,
          floor: assignment.floor,
          property_id: assignment.property_id,
          properties: null // Properties object placeholder
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        person: resolved.person,
        assignment: mappedAssignments[0] || null, // Backward compatible singular
        assignments: mappedAssignments,            // Plural for multi-unit selection support
        role: resolved.profile.role
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve resident portal data";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
