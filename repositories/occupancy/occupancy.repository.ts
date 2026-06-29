import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Occupancy, CreateOccupancyDto, UpdateOccupancyDto, OccupancyType } from "@/features/occupancy/types/occupancy.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface OccupancyDbRow {
  id: string;
  unit_id: string;
  person_id: string;
  occupancy_type: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  unit?: {
    unit_number: string;
    building_code: string;
    floor: string;
  } | null;
  person?: {
    first_name: string;
    last_name: string | null;
  } | null;
}

function mapToOccupancy(row: OccupancyDbRow): Occupancy {
  return {
    id: row.id,
    unit_id: row.unit_id,
    person_id: row.person_id,
    occupancy_type: row.occupancy_type as OccupancyType,
    start_date: row.start_date,
    end_date: row.end_date,
    status: (row.status || "active").toLowerCase() as Status,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    unit: row.unit || null,
    person: row.person || null,
  };
}

export async function findAll(): Promise<Occupancy[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("occupancy")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name)
    `)
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding occupancies:", error);
    return [];
  }

  return (data as OccupancyDbRow[] || []).map(mapToOccupancy);
}

export async function findById(id: string): Promise<Occupancy | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("occupancy")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding occupancy by id: ${id}`, error);
    return null;
  }

  return mapToOccupancy(data as OccupancyDbRow);
}

export async function create(dto: CreateOccupancyDto): Promise<Occupancy> {
  const supabase = await getSupabase();
  const payload = {
    unit_id: dto.unit_id,
    person_id: dto.person_id,
    occupancy_type: dto.occupancy_type,
    start_date: dto.start_date,
    end_date: dto.end_date || null,
    status: dto.status || Status.ACTIVE,
    remarks: dto.remarks || null,
  };

  const { data, error } = await supabase
    .from("occupancy")
    .insert([payload])
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create occupancy: ${error.message}`);
  }

  return mapToOccupancy(data as OccupancyDbRow);
}

export async function update(id: string, dto: UpdateOccupancyDto): Promise<Occupancy | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    unit_id: string;
    person_id: string;
    occupancy_type: string;
    start_date: string;
    end_date: string | null;
    status: Status;
    remarks: string | null;
    updated_at: string;
  }> = {};

  if (dto.unit_id !== undefined) payload.unit_id = dto.unit_id;
  if (dto.person_id !== undefined) payload.person_id = dto.person_id;
  if (dto.occupancy_type !== undefined) payload.occupancy_type = dto.occupancy_type;
  if (dto.start_date !== undefined) payload.start_date = dto.start_date;
  if (dto.end_date !== undefined) payload.end_date = dto.end_date;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.remarks !== undefined) payload.remarks = dto.remarks;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("occupancy")
    .update(payload)
    .eq("id", id)
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name)
    `)
    .single();

  if (error) {
    console.error(`Error updating occupancy ${id}:`, error);
    return null;
  }

  return mapToOccupancy(data as OccupancyDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("occupancy")
    .update({
      deleted_at: new Date().toISOString(),
      status: "inactive"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving occupancy ${id}:`, error);
    return false;
  }

  return true;
}

export async function findByPersonId(personId: string): Promise<Occupancy[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("occupancy")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name)
    `)
    .eq("person_id", personId)
    .is("deleted_at", null);

  if (error) {
    console.error(`Error finding occupancies by person id ${personId}:`, error);
    return [];
  }

  return (data as OccupancyDbRow[] || []).map(mapToOccupancy);
}

export async function findByUnitId(unitId: string): Promise<Occupancy[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("occupancy")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name)
    `)
    .eq("unit_id", unitId)
    .is("deleted_at", null);

  if (error) {
    console.error(`Error finding occupancies by unit id ${unitId}:`, error);
    return [];
  }

  return (data as OccupancyDbRow[] || []).map(mapToOccupancy);
}

