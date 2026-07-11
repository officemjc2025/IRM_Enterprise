import { SupabaseClient } from "@supabase/supabase-js";

export interface IdentityScope {
  profile: {
    id: string;
    email: string;
    role: string;
    status: string;
    property_id: string | null;
  };
  person: {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  assignments: Array<{
    id: string;
    unit_id: string;
    unit_number: string;
    building_code: string;
    floor: string;
    property_id: string;
    resident_type: string;
    is_primary: boolean;
  }>;
}

export async function resolveIdentity(supabase: SupabaseClient, userId: string): Promise<IdentityScope | null> {
  // 1. Get profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, role, status, property_id, person_id")
    .eq("id", userId)
    .single();

  if (profileErr || !profile) {
    return null; // fail closed
  }

  // 2. If no person_id, return profile only (onboarding/pending)
  if (!profile.person_id) {
    return {
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        property_id: profile.property_id
      },
      person: null,
      assignments: []
    };
  }

  // 3. Resolve Person
  const { data: person, error: personErr } = await supabase
    .from("persons")
    .select("id, first_name, last_name, display_name, email, phone")
    .eq("id", profile.person_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (personErr || !person) {
    // Linked person was deleted or not found
    return {
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        property_id: profile.property_id
      },
      person: null,
      assignments: []
    };
  }

  // 4. Resolve Active Unit Assignments
  // Temporal filters match irm_active_assignment_ids() SQL helper exactly:
  //   status = 'ACTIVE', deleted_at IS NULL,
  //   move_in_date <= today, move_out_date IS NULL OR >= today
  const today = new Date().toISOString().split("T")[0];
  const { data: assignments, error: assignmentsErr } = await supabase
    .from("resident_assignments")
    .select(`
      id,
      unit_id,
      resident_type,
      is_primary,
      status,
      move_in_date,
      move_out_date,
      unit:unit_id (
        unit_number,
        building_code,
        floor,
        property_id
      )
    `)
    .eq("person_id", person.id)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .lte("move_in_date", today)
    .or(`move_out_date.is.null,move_out_date.gte.${today}`);

  if (assignmentsErr) {
    throw new Error(`Failed to resolve resident assignments: ${assignmentsErr.message}`);
  }

  interface RawAssignmentRow {
    id: string;
    unit_id: string;
    resident_type: string;
    is_primary: boolean;
    status: string | null;
    move_in_date: string | null;
    move_out_date: string | null;
    unit: {
      unit_number: string;
      building_code: string;
      floor: string;
      property_id: string;
    } | null;
  }

  const mappedAssignments = ((assignments as unknown as RawAssignmentRow[]) || []).map((a) => ({
    id: a.id,
    unit_id: a.unit_id,
    unit_number: a.unit?.unit_number || "",
    building_code: a.unit?.building_code || "",
    floor: a.unit?.floor || "",
    property_id: a.unit?.property_id || "",
    resident_type: a.resident_type,
    is_primary: a.is_primary
  }));

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      property_id: profile.property_id
    },
    person,
    assignments: mappedAssignments
  };
}
