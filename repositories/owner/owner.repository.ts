import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Owner, CreateOwnerDto, UpdateOwnerDto } from "@/features/owner/types/owner.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface OwnerDbRow {
  id: string;
  owner_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  tax_id: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

function mapToOwner(row: OwnerDbRow): Owner {
  return {
    id: row.id,
    owner_code: row.owner_code,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    nationality: row.nationality,
    tax_id: row.tax_id,
    status: (row.status || "active").toLowerCase() as Status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}

export async function findAll(): Promise<Owner[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("owner")
    .select("*")
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding owners:", error);
    return [];
  }

  return (data as OwnerDbRow[] || []).map(mapToOwner);
}

export async function findById(id: string): Promise<Owner | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("owner")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding owner by id: ${id}`, error);
    return null;
  }

  return mapToOwner(data as OwnerDbRow);
}

export async function create(dto: CreateOwnerDto): Promise<Owner> {
  const supabase = await getSupabase();
  const payload = {
    owner_code: dto.owner_code,
    full_name: dto.full_name,
    phone: dto.phone || null,
    email: dto.email || null,
    nationality: dto.nationality || null,
    tax_id: dto.tax_id || null,
    status: dto.status || Status.ACTIVE,
  };

  const { data, error } = await supabase
    .from("owner")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create owner: ${error.message}`);
  }

  return mapToOwner(data as OwnerDbRow);
}

export async function update(id: string, dto: UpdateOwnerDto): Promise<Owner | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    owner_code: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    nationality: string | null;
    tax_id: string | null;
    status: Status;
    updated_at: string;
  }> = {};

  if (dto.owner_code !== undefined) payload.owner_code = dto.owner_code;
  if (dto.full_name !== undefined) payload.full_name = dto.full_name;
  if (dto.phone !== undefined) payload.phone = dto.phone;
  if (dto.email !== undefined) payload.email = dto.email;
  if (dto.nationality !== undefined) payload.nationality = dto.nationality;
  if (dto.tax_id !== undefined) payload.tax_id = dto.tax_id;
  if (dto.status !== undefined) payload.status = dto.status;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("owner")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating owner ${id}:`, error);
    return null;
  }

  return mapToOwner(data as OwnerDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("owner")
    .update({
      deleted_at: new Date().toISOString(),
      status: "inactive"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving owner ${id}:`, error);
    return false;
  }

  return true;
}
