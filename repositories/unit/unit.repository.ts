import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Unit, CreateUnitDto, UpdateUnitDto } from "@/features/unit/types/unit.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface UnitDbRow {
  id: string;
  property_id: string;
  building_code: string;
  floor: string;
  unit_number: string;
  area: number;
  ownership_ratio: number;
  status: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

function mapToUnit(row: UnitDbRow): Unit {
  return {
    id: row.id,
    property_id: row.property_id,
    building_code: row.building_code,
    floor: row.floor,
    unit_number: row.unit_number,
    area: Number(row.area),
    ownership_ratio: Number(row.ownership_ratio),
    status: (row.status || "active").toLowerCase() as Status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}

export async function findAll(): Promise<Unit[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("unit")
    .select("*")
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding units:", error);
    return [];
  }

  return (data as UnitDbRow[] || []).map(mapToUnit);
}

export async function findById(id: string): Promise<Unit | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("unit")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding unit by id: ${id}`, error);
    return null;
  }

  return mapToUnit(data as UnitDbRow);
}

export async function create(dto: CreateUnitDto): Promise<Unit> {
  const supabase = await getSupabase();
  const payload = {
    property_id: dto.property_id,
    building_code: dto.building_code,
    floor: dto.floor,
    unit_number: dto.unit_number,
    area: dto.area,
    ownership_ratio: dto.ownership_ratio,
    status: dto.status || Status.ACTIVE,
  };

  const { data, error } = await supabase
    .from("unit")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create unit: ${error.message}`);
  }

  return mapToUnit(data as UnitDbRow);
}

export async function update(id: string, dto: UpdateUnitDto): Promise<Unit | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    property_id: string;
    building_code: string;
    floor: string;
    unit_number: string;
    area: number;
    ownership_ratio: number;
    status: Status;
    updated_at: string;
  }> = {};

  if (dto.property_id !== undefined) payload.property_id = dto.property_id;
  if (dto.building_code !== undefined) payload.building_code = dto.building_code;
  if (dto.floor !== undefined) payload.floor = dto.floor;
  if (dto.unit_number !== undefined) payload.unit_number = dto.unit_number;
  if (dto.area !== undefined) payload.area = dto.area;
  if (dto.ownership_ratio !== undefined) payload.ownership_ratio = dto.ownership_ratio;
  if (dto.status !== undefined) payload.status = dto.status;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("unit")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating unit ${id}:`, error);
    return null;
  }

  return mapToUnit(data as UnitDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("unit")
    .update({
      deleted_at: new Date().toISOString(),
      status: "inactive"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving unit ${id}:`, error);
    return false;
  }

  return true;
}
