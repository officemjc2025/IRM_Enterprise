import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Ownership, CreateOwnershipDto, UpdateOwnershipDto } from "@/features/ownership/types/ownership.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface OwnershipDbRow {
  id: string;
  person_id: string;
  unit_id: string;
  ownership_percentage: number;
  ownership_type: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  person?: any;
  unit?: any;
}

function mapToOwnership(row: OwnershipDbRow): Ownership {
  return {
    id: row.id,
    person_id: row.person_id,
    unit_id: row.unit_id,
    ownership_percentage: Number(row.ownership_percentage),
    ownership_type: row.ownership_type,
    start_date: row.start_date,
    end_date: row.end_date,
    status: (row.status || "ACTIVE").toUpperCase() as Status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    person: row.person ? {
      ...row.person,
      status: (row.person.status || "ACTIVE").toUpperCase() as Status,
    } : null,
    unit: row.unit ? {
      ...row.unit,
      status: (row.unit.status || "ACTIVE").toUpperCase() as Status,
    } : null,
  };
}

export async function findAll(): Promise<Ownership[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("ownership")
    .select("*, person:persons(*), unit:units(*)")
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding ownerships:", error);
    return [];
  }

  return (data as OwnershipDbRow[] || []).map(mapToOwnership);
}

export async function findById(id: string): Promise<Ownership | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("ownership")
    .select("*, person:persons(*), unit:units(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding ownership by id: ${id}`, error);
    return null;
  }

  return mapToOwnership(data as OwnershipDbRow);
}

export async function create(dto: CreateOwnershipDto): Promise<Ownership> {
  const supabase = await getSupabase();
  const payload = {
    person_id: dto.person_id,
    unit_id: dto.unit_id,
    ownership_percentage: dto.ownership_percentage,
    ownership_type: dto.ownership_type,
    start_date: dto.start_date,
    end_date: dto.end_date || null,
    status: dto.status || Status.ACTIVE,
  };

  const { data, error } = await supabase
    .from("ownership")
    .insert([payload])
    .select("*, person:persons(*), unit:units(*)")
    .single();

  if (error) {
    throw new Error(`Failed to create ownership: ${error.message}`);
  }

  return mapToOwnership(data as OwnershipDbRow);
}

export async function update(id: string, dto: UpdateOwnershipDto): Promise<Ownership | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    person_id: string;
    unit_id: string;
    ownership_percentage: number;
    ownership_type: string;
    start_date: string;
    end_date: string | null;
    status: Status;
    updated_at: string;
  }> = {};

  if (dto.person_id !== undefined) payload.person_id = dto.person_id;
  if (dto.unit_id !== undefined) payload.unit_id = dto.unit_id;
  if (dto.ownership_percentage !== undefined) payload.ownership_percentage = dto.ownership_percentage;
  if (dto.ownership_type !== undefined) payload.ownership_type = dto.ownership_type;
  if (dto.start_date !== undefined) payload.start_date = dto.start_date;
  if (dto.end_date !== undefined) payload.end_date = dto.end_date;
  if (dto.status !== undefined) payload.status = dto.status;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("ownership")
    .update(payload)
    .eq("id", id)
    .select("*, person:persons(*), unit:units(*)")
    .single();

  if (error) {
    console.error(`Error updating ownership ${id}:`, error);
    return null;
  }

  return mapToOwnership(data as OwnershipDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("ownership")
    .update({
      deleted_at: new Date().toISOString(),
      status: "INACTIVE"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving ownership ${id}:`, error);
    return false;
  }

  return true;
}

export async function findDuplicate(personId: string, unitId: string): Promise<Ownership | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("ownership")
    .select("*, person:persons(*), unit:units(*)")
    .eq("person_id", personId)
    .eq("unit_id", unitId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error checking duplicate ownership:", error);
    return null;
  }

  return data ? mapToOwnership(data as OwnershipDbRow) : null;
}
