import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Property, CreatePropertyDto, UpdatePropertyDto } from "@/features/property/types/property.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface PropertyDbRow {
  id: string;
  property_code: string;
  property_name_th: string;
  property_name_en: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

function mapToProperty(row: PropertyDbRow): Property {
  return {
    id: row.id,
    code: row.property_code,
    name_th: row.property_name_th,
    name_en: row.property_name_en || "",
    status: (row.status || "active").toLowerCase() as Status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}

export async function findAll(): Promise<Property[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("property")
    .select("*")
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding properties:", error);
    return [];
  }

  return (data as PropertyDbRow[] || []).map(mapToProperty);
}

export async function findById(id: string): Promise<Property | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("property")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding property by id: ${id}`, error);
    return null;
  }

  return mapToProperty(data as PropertyDbRow);
}

export async function create(dto: CreatePropertyDto): Promise<Property> {
  const supabase = await getSupabase();
  const payload = {
    property_code: dto.code,
    property_name_th: dto.name_th,
    property_name_en: dto.name_en,
    property_type: "condominium",
    status: dto.status || Status.ACTIVE,
  };

  const { data, error } = await supabase
    .from("property")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create property: ${error.message}`);
  }

  return mapToProperty(data as PropertyDbRow);
}

export async function update(id: string, dto: UpdatePropertyDto): Promise<Property | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    property_code: string;
    property_name_th: string;
    property_name_en: string;
    status: Status;
    updated_at: string;
  }> = {};
  
  if (dto.code !== undefined) payload.property_code = dto.code;
  if (dto.name_th !== undefined) payload.property_name_th = dto.name_th;
  if (dto.name_en !== undefined) payload.property_name_en = dto.name_en;
  if (dto.status !== undefined) payload.status = dto.status;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("property")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating property ${id}:`, error);
    return null;
  }

  return mapToProperty(data as PropertyDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("property")
    .update({ 
      deleted_at: new Date().toISOString(),
      status: "inactive"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving property ${id}:`, error);
    return false;
  }

  return true;
}
