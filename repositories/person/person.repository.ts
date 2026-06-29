import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Person, CreatePersonDto, UpdatePersonDto } from "@/features/person/types/person.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface PersonDbRow {
  id: string;
  person_code: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  id_card: string | null;
  passport: string | null;
  photo: string | null;
  status: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

function mapToPerson(row: PersonDbRow): Person {
  return {
    id: row.id,
    person_code: row.person_code,
    title: row.title,
    first_name: row.first_name,
    last_name: row.last_name,
    display_name: row.display_name,
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    nationality: row.nationality,
    phone: row.phone,
    email: row.email,
    id_card: row.id_card,
    passport: row.passport,
    photo: row.photo,
    status: (row.status || "active").toLowerCase() as Status,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}

export async function findAll(): Promise<Person[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("person")
    .select("*")
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding people:", error);
    return [];
  }

  return (data as PersonDbRow[] || []).map(mapToPerson);
}

export async function findById(id: string): Promise<Person | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("person")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding person by id: ${id}`, error);
    return null;
  }

  return mapToPerson(data as PersonDbRow);
}

export async function create(dto: CreatePersonDto): Promise<Person> {
  const supabase = await getSupabase();
  const payload = {
    person_code: dto.person_code || null,
    title: dto.title || null,
    first_name: dto.first_name,
    last_name: dto.last_name,
    display_name: dto.display_name || null,
    gender: dto.gender || null,
    date_of_birth: dto.date_of_birth || null,
    nationality: dto.nationality || null,
    phone: dto.phone || null,
    email: dto.email || null,
    id_card: dto.id_card || null,
    passport: dto.passport || null,
    photo: dto.photo || null,
    status: dto.status || Status.ACTIVE,
    remarks: dto.remarks || null,
  };

  const { data, error } = await supabase
    .from("person")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create person: ${error.message}`);
  }

  return mapToPerson(data as PersonDbRow);
}

export async function update(id: string, dto: UpdatePersonDto): Promise<Person | null> {
  const supabase = await getSupabase();
  const payload: Partial<{
    person_code: string | null;
    title: string | null;
    first_name: string;
    last_name: string;
    display_name: string | null;
    gender: string | null;
    date_of_birth: string | null;
    nationality: string | null;
    phone: string | null;
    email: string | null;
    id_card: string | null;
    passport: string | null;
    photo: string | null;
    status: Status;
    remarks: string | null;
    updated_at: string;
  }> = {};

  if (dto.person_code !== undefined) payload.person_code = dto.person_code;
  if (dto.title !== undefined) payload.title = dto.title;
  if (dto.first_name !== undefined) payload.first_name = dto.first_name;
  if (dto.last_name !== undefined) payload.last_name = dto.last_name;
  if (dto.display_name !== undefined) payload.display_name = dto.display_name;
  if (dto.gender !== undefined) payload.gender = dto.gender;
  if (dto.date_of_birth !== undefined) payload.date_of_birth = dto.date_of_birth;
  if (dto.nationality !== undefined) payload.nationality = dto.nationality;
  if (dto.phone !== undefined) payload.phone = dto.phone;
  if (dto.email !== undefined) payload.email = dto.email;
  if (dto.id_card !== undefined) payload.id_card = dto.id_card;
  if (dto.passport !== undefined) payload.passport = dto.passport;
  if (dto.photo !== undefined) payload.photo = dto.photo;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.remarks !== undefined) payload.remarks = dto.remarks;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("person")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`Error updating person ${id}:`, error);
    return null;
  }

  return mapToPerson(data as PersonDbRow);
}

export async function archive(id: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("person")
    .update({
      deleted_at: new Date().toISOString(),
      status: "inactive"
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving person ${id}:`, error);
    return false;
  }

  return true;
}

export async function search(query: string): Promise<Person[]> {
  const supabase = await getSupabase();
  const ilikePattern = `%${query}%`;
  const { data, error } = await supabase
    .from("person")
    .select("*")
    .is("deleted_at", null)
    .or(`first_name.ilike.${ilikePattern},last_name.ilike.${ilikePattern},person_code.ilike.${ilikePattern},email.ilike.${ilikePattern},phone.ilike.${ilikePattern}`);

  if (error) {
    console.error("Error searching people:", error);
    return [];
  }

  return (data as PersonDbRow[] || []).map(mapToPerson);
}
