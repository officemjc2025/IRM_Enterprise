import * as personRepository from "@/repositories/person/person.repository";
import { Person, CreatePersonDto, UpdatePersonDto } from "@/features/person/types/person.types";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const personService = {
  async getPersons(): Promise<Person[]> {
    return personRepository.findAll();
  },

  async getPerson(id: string): Promise<Person | null> {
    if (!id) throw new Error("Person ID is required");
    return personRepository.findById(id);
  },

  async createPerson(dto: CreatePersonDto): Promise<Person> {
    if (!dto.first_name || dto.first_name.trim() === "") {
      throw new Error("First name is required");
    }
    if (!dto.last_name || dto.last_name.trim() === "") {
      throw new Error("Last name is required");
    }
    if (dto.email && dto.email.trim() !== "" && !isValidEmail(dto.email)) {
      throw new Error("Invalid email format");
    }
    if (dto.phone && dto.phone.trim() !== "") {
      const digitsOnly = dto.phone.replace(/\D/g, "");
      if (digitsOnly.length < 8) {
        throw new Error("Phone number must have at least 8 digits");
      }
    }

    if (dto.person_code && dto.person_code.trim() !== "") {
      const supabase = await getSupabase();
      const { data } = await supabase
        .from("person")
        .select("id")
        .eq("person_code", dto.person_code.trim())
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        throw new Error("Person code must be unique");
      }
    }

    return personRepository.create({
      ...dto,
      first_name: dto.first_name.trim(),
      last_name: dto.last_name.trim(),
      person_code: dto.person_code ? dto.person_code.trim() : null,
      email: dto.email ? dto.email.trim().toLowerCase() : null,
      phone: dto.phone ? dto.phone.trim() : null,
      display_name: dto.display_name ? dto.display_name.trim() : `${dto.first_name.trim()} ${dto.last_name.trim()}`,
    });
  },

  async updatePerson(id: string, dto: UpdatePersonDto): Promise<Person | null> {
    if (!id) throw new Error("Person ID is required");

    if (dto.first_name !== undefined && dto.first_name.trim() === "") {
      throw new Error("First name cannot be empty");
    }
    if (dto.last_name !== undefined && dto.last_name.trim() === "") {
      throw new Error("Last name cannot be empty");
    }
    if (dto.email && dto.email.trim() !== "" && !isValidEmail(dto.email)) {
      throw new Error("Invalid email format");
    }
    if (dto.phone && dto.phone.trim() !== "") {
      const digitsOnly = dto.phone.replace(/\D/g, "");
      if (digitsOnly.length < 8) {
        throw new Error("Phone number must have at least 8 digits");
      }
    }

    if (dto.person_code && dto.person_code.trim() !== "") {
      const supabase = await getSupabase();
      const { data } = await supabase
        .from("person")
        .select("id")
        .eq("person_code", dto.person_code.trim())
        .neq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (data) {
        throw new Error("Person code must be unique");
      }
    }

    const payload: UpdatePersonDto = { ...dto };
    if (dto.first_name !== undefined) payload.first_name = dto.first_name.trim();
    if (dto.last_name !== undefined) payload.last_name = dto.last_name.trim();
    if (dto.person_code !== undefined) payload.person_code = dto.person_code ? dto.person_code.trim() : null;
    if (dto.email !== undefined) payload.email = dto.email ? dto.email.trim().toLowerCase() : null;
    if (dto.phone !== undefined) payload.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.display_name !== undefined) payload.display_name = dto.display_name ? dto.display_name.trim() : null;

    return personRepository.update(id, payload);
  },

  async archivePerson(id: string): Promise<boolean> {
    if (!id) throw new Error("Person ID is required");
    return personRepository.archive(id);
  },

  async searchPersons(query: string): Promise<Person[]> {
    if (!query || query.trim() === "") {
      return personRepository.findAll();
    }
    return personRepository.search(query.trim());
  }
};
