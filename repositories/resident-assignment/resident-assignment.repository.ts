import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ResidentAssignment, CreateResidentAssignmentDto, UpdateResidentAssignmentDto } from "@/features/resident-assignment/types/resident-assignment.types";
import { Status } from "@/shared/enums/status";
import { Person } from "@/features/person/types/person.types";
import { Unit } from "@/features/unit/types/unit.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface ResidentAssignmentDbRow {
  id: string;
  person_id: string;
  unit_id: string;
  resident_type: string;
  is_primary: boolean;
  move_in_date: string;
  move_out_date: string | null;
  status: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  person?: Partial<Person> | null;
  unit?: Partial<Unit> | null;
}

function mapToResidentAssignment(row: ResidentAssignmentDbRow): ResidentAssignment {
  return {
    id: row.id,
    person_id: row.person_id,
    unit_id: row.unit_id,
    occupancy_type: row.resident_type,
    primary_resident: row.is_primary,
    move_in_date: row.move_in_date,
    move_out_date: row.move_out_date,
    status: (row.status || "ACTIVE").toUpperCase() as Status,
    remark: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    person: row.person ? {
      ...row.person,
      status: (row.person.status || "ACTIVE").toUpperCase() as Status,
    } as Person : null,
    unit: row.unit ? {
      ...row.unit,
      status: (row.unit.status || "ACTIVE").toUpperCase() as Status,
    } as Unit : null,
  };
}

export async function findAll(): Promise<ResidentAssignment[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("resident_assignments")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding resident assignments:", error);
    return [];
  }

  return (data as ResidentAssignmentDbRow[] || []).map(mapToResidentAssignment);
}

export async function findById(id: string): Promise<ResidentAssignment | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("resident_assignments")
    .select(`
      *,
      unit:unit_id (id, unit_number, building_code, floor, property_id, properties(*)),
      person:person_id (id, first_name, last_name, display_name)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error finding resident assignment by id ${id}:`, error);
    return null;
  }

  return data ? mapToResidentAssignment(data as ResidentAssignmentDbRow) : null;
}

export async function create(dto: CreateResidentAssignmentDto): Promise<ResidentAssignment> {
  const supabase = await getSupabase();
  const payload = {
    person_id: dto.person_id,
    unit_id: dto.unit_id,
    resident_type: dto.occupancy_type,
    is_primary: dto.primary_resident,
    move_in_date: dto.move_in_date,
    move_out_date: dto.move_out_date || null,
    status: dto.status || Status.ACTIVE,
    remarks: dto.remark || null,
  };

  const { data, error } = await supabase
    .from("resident_assignments")
    .insert([payload])
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create resident assignment: ${error.message}`);
  }

  return mapToResidentAssignment(data as ResidentAssignmentDbRow);
}

export async function update(id: string, dto: UpdateResidentAssignmentDto): Promise<ResidentAssignment | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    person_id: string;
    unit_id: string;
    resident_type: string;
    is_primary: boolean;
    move_in_date: string;
    move_out_date: string | null;
    status: Status;
    remarks: string | null;
    updated_at: string;
  }> = {};

  if (dto.person_id !== undefined) payload.person_id = dto.person_id;
  if (dto.unit_id !== undefined) payload.unit_id = dto.unit_id;
  if (dto.occupancy_type !== undefined) payload.resident_type = dto.occupancy_type;
  if (dto.primary_resident !== undefined) payload.is_primary = dto.primary_resident;
  if (dto.move_in_date !== undefined) payload.move_in_date = dto.move_in_date;
  if (dto.move_out_date !== undefined) payload.move_out_date = dto.move_out_date;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.remark !== undefined) payload.remarks = dto.remark;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("resident_assignments")
    .update(payload)
    .eq("id", id)
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .single();

  if (error) {
    console.error(`Error updating resident assignment ${id}:`, error);
    return null;
  }

  return mapToResidentAssignment(data as ResidentAssignmentDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("resident_assignments")
    .update({
      deleted_at: new Date().toISOString(),
      status: "INACTIVE"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving resident assignment ${id}:`, error);
    return false;
  }

  return true;
}

export async function findByPersonId(personId: string): Promise<ResidentAssignment[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("resident_assignments")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .eq("person_id", personId)
    .is("deleted_at", null);

  if (error) {
    console.error(`Error finding resident assignments by person id ${personId}:`, error);
    return [];
  }

  return (data as ResidentAssignmentDbRow[] || []).map(mapToResidentAssignment);
}

export async function findByUnitId(unitId: string): Promise<ResidentAssignment[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("resident_assignments")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .eq("unit_id", unitId)
    .is("deleted_at", null);

  if (error) {
    console.error(`Error finding resident assignments by unit id ${unitId}:`, error);
    return [];
  }

  return (data as ResidentAssignmentDbRow[] || []).map(mapToResidentAssignment);
}

export async function findDuplicateActive(personId: string, unitId: string): Promise<ResidentAssignment | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("resident_assignments")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .eq("person_id", personId)
    .eq("unit_id", unitId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error finding duplicate active resident assignment:", error);
    return null;
  }

  return data ? mapToResidentAssignment(data as ResidentAssignmentDbRow) : null;
}
