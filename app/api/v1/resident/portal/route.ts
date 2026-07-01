import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    let targetEmail = user.email;

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile && (profile.role === "admin" || profile.role === "super_admin" || profile.role === "property_admin")) {
      if (impersonateEmail && impersonateEmail.trim() !== "") {
        targetEmail = impersonateEmail.trim();
      }
    }

    if (!targetEmail) {
      return NextResponse.json(
        { success: false, message: "No email address resolved for residency search" },
        { status: 400 }
      );
    }

    // Resolve Person
    const { data: person, error: personError } = await supabase
      .from("persons")
      .select("*")
      .eq("email", targetEmail)
      .is("deleted_at", null)
      .maybeSingle();

    if (personError) {
      throw new Error(`Failed to resolve person: ${personError.message}`);
    }

    if (!person) {
      return NextResponse.json({
        success: true,
        data: {
          person: null,
          assignment: null,
          role: profile?.role || "resident",
        },
      });
    }

    // Resolve Active Assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from("resident_assignments")
      .select(`
        *,
        unit:unit_id (
          id,
          unit_number,
          building_code,
          floor,
          property_id,
          properties (
            id,
            property_name_th,
            property_name_en,
            address
          )
        )
      `)
      .eq("person_id", person.id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .maybeSingle();

    if (assignmentError) {
      throw new Error(`Failed to resolve assignment: ${assignmentError.message}`);
    }

    // Map DB fields to the expected UI keys
    let mappedAssignment = null;
    if (assignment) {
      mappedAssignment = {
        id: assignment.id,
        person_id: assignment.person_id,
        unit_id: assignment.unit_id,
        occupancy_type: assignment.resident_type,
        primary_resident: assignment.is_primary,
        move_in_date: assignment.move_in_date,
        move_out_date: assignment.move_out_date,
        status: assignment.status,
        remark: assignment.remarks,
        unit: assignment.unit,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        person,
        assignment: mappedAssignment,
        role: profile?.role || "resident",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve resident portal data";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
