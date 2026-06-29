import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { GroupedSearchResults, SearchResultItem } from "../types/search.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface UnitRow {
  id: string;
  unit_number: string;
  building_code: string | null;
  floor: string | null;
}

interface PersonRow {
  id: string;
  person_code: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
}

interface OccupancyRow {
  id: string;
  occupancy_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  unit: {
    unit_number: string;
    building_code: string | null;
    floor: string | null;
  } | null;
  person: {
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null;
}

export async function searchAll(query: string): Promise<GroupedSearchResults> {
  const term = query.trim();
  if (!term) {
    return { units: [], persons: [], occupancies: [] };
  }

  const supabase = await getSupabase();
  const lowerTerm = term.toLowerCase();

  // 1. Search Units
  const { data: unitsData, error: unitsError } = await supabase
    .from("unit")
    .select("id, unit_number, building_code, floor")
    .is("deleted_at", null)
    .or(`unit_number.ilike.%${term}%,building_code.ilike.%${term}%,floor.ilike.%${term}%`);

  if (unitsError) {
    console.error("Error searching units:", unitsError);
  }

  const units: SearchResultItem[] = (unitsData as UnitRow[] || []).map((u) => ({
    id: u.id,
    type: "unit",
    title: `Unit ${u.unit_number}`,
    subtitle: `Building: ${u.building_code || "Main"} | Floor: ${u.floor || "-"}`,
    url: `/units/${u.id}`,
  }));

  // 2. Search Persons
  const { data: personsData, error: personsError } = await supabase
    .from("person")
    .select("id, person_code, first_name, last_name, display_name, phone, email")
    .is("deleted_at", null)
    .or(`person_code.ilike.%${term}%,display_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);

  if (personsError) {
    console.error("Error searching persons:", personsError);
  }

  const persons: SearchResultItem[] = (personsData as PersonRow[] || []).map((p) => ({
    id: p.id,
    type: "person",
    title: p.display_name || `${p.first_name} ${p.last_name}`,
    subtitle: `Code: ${p.person_code || "-"} | Email: ${p.email || "-"} | Phone: ${p.phone || "-"}`,
    url: `/persons/${p.id}`,
  }));

  // 3. Search Occupancies
  const { data: occsData, error: occsError } = await supabase
    .from("occupancy")
    .select(`
      id,
      occupancy_type,
      status,
      start_date,
      end_date,
      unit:unit_id (unit_number, building_code, floor),
      person:person_id (first_name, last_name, display_name)
    `)
    .is("deleted_at", null);

  if (occsError) {
    console.error("Error searching occupancies:", occsError);
  }

  const occupancies: SearchResultItem[] = (occsData as unknown as OccupancyRow[] || [])
    .filter((o) => {
      const typeMatch = o.occupancy_type?.toLowerCase().includes(lowerTerm);
      const statusMatch = o.status?.toLowerCase().includes(lowerTerm);
      const unitMatch = o.unit?.unit_number?.toLowerCase().includes(lowerTerm);
      const personName = o.person
        ? `${o.person.first_name} ${o.person.last_name || ""}`.toLowerCase()
        : "";
      const personMatch =
        personName.includes(lowerTerm) ||
        o.person?.display_name?.toLowerCase().includes(lowerTerm);

      return typeMatch || statusMatch || unitMatch || personMatch;
    })
    .map((o) => ({
      id: o.id,
      type: "occupancy",
      title: `${o.occupancy_type} in Unit ${o.unit?.unit_number || "-"}`,
      subtitle: `Occupant: ${
        o.person ? o.person.display_name || `${o.person.first_name} ${o.person.last_name}` : "-"
      } | Status: ${o.status}`,
      url: `/occupancies/${o.id}`,
    }));

  return {
    units,
    persons,
    occupancies,
  };
}
