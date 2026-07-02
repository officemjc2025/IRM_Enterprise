import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Visitor, VisitorStatus, CreateVisitorDto, UpdateVisitorDto } from "@/features/visitor/types/visitor.types";
import { Person } from "@/features/person/types/person.types";
import { Unit } from "@/features/unit/types/unit.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface VisitorDbRow {
  id: string;
  visitor_code: string;
  resident_assignment_id: string | null;
  visitor_name: string;
  phone: string | null;
  vehicle_plate: string | null;
  visit_date: string;
  expected_arrival: string | null;
  purpose: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  check_in_time?: string | null;
  expected_checkout_time?: string | null;
  actual_checkout_time?: string | null;
  company?: string | null;
  security_user?: string | null;

  // Joined relations
  resident_assignments?: {
    id: string;
    person_id: string;
    unit_id: string;
    occupancy_type: string;
    primary_resident: boolean;
    move_in_date: string;
    move_out_date: string | null;
    status: string;
    remarks: string | null;
    created_at: string;
    updated_at: string;
    
    // Nested
    persons?: {
      id: string;
      person_code: string | null;
      first_name: string;
      last_name: string;
      display_name: string | null;
      email: string | null;
      phone: string | null;
      photo: string | null;
      status: string;
    } | null;

    units?: {
      id: string;
      unit_number: string;
      building_code: string | null;
      floor: string | null;
      property_id: string;
      status: string;
      
      // Properties
      properties?: {
        id: string;
        property_name_th: string;
        property_name_en: string | null;
      } | null;
    } | null;
  } | null;
}

import { Status } from "@/shared/enums/status";

interface UnitWithProperties extends Unit {
  properties?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
  } | null;
}

function mapToVisitor(row: VisitorDbRow): Visitor {
  // Map nested objects to match expected TypeScript types in UI
  let mappedResidentAssignment = null;
  
  if (row.resident_assignments) {
    const ra = row.resident_assignments;
    mappedResidentAssignment = {
      id: ra.id,
      person_id: ra.person_id,
      unit_id: ra.unit_id,
      occupancy_type: ra.occupancy_type,
      primary_resident: ra.primary_resident,
      move_in_date: ra.move_in_date,
      move_out_date: ra.move_out_date,
      status: (ra.status || "ACTIVE").toUpperCase() as Status,
      remark: ra.remarks,
      created_at: ra.created_at,
      updated_at: ra.updated_at,
      
      person: ra.persons ? {
        id: ra.persons.id,
        person_code: ra.persons.person_code,
        first_name: ra.persons.first_name,
        last_name: ra.persons.last_name,
        display_name: ra.persons.display_name,
        email: ra.persons.email,
        phone: ra.persons.phone,
        photo: ra.persons.photo,
        status: (ra.persons.status || "ACTIVE").toUpperCase() as Status,
      } as Person : null,
      
      unit: ra.units ? {
        id: ra.units.id,
        unit_number: ra.units.unit_number,
        building_code: ra.units.building_code,
        floor: ra.units.floor,
        property_id: ra.units.property_id,
        status: (ra.units.status || "ACTIVE").toUpperCase() as Status,
        properties: ra.units.properties ? {
          id: ra.units.properties.id,
          property_name_th: ra.units.properties.property_name_th,
          property_name_en: ra.units.properties.property_name_en,
        } : null,
      } as UnitWithProperties : null,
    };
  }

  return {
    id: row.id,
    visitor_code: row.visitor_code,
    resident_assignment_id: row.resident_assignment_id,
    visitor_name: row.visitor_name,
    phone: row.phone,
    vehicle_plate: row.vehicle_plate,
    visit_date: row.visit_date,
    expected_arrival: row.expected_arrival,
    purpose: row.purpose,
    status: row.status as VisitorStatus,
    remark: row.remarks,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    deleted_at: row.deleted_at,
    check_in_time: row.check_in_time,
    expected_checkout_time: row.expected_checkout_time,
    actual_checkout_time: row.actual_checkout_time,
    company: row.company,
    security_user: row.security_user,
    resident_assignment: mappedResidentAssignment,
  };
}

// Select query structure to load all relations
const SELECT_QUERY = `
  *,
  resident_assignments:resident_assignment_id (
    *,
    persons:person_id (*),
    units:unit_id (
      *,
      properties:property_id (id, property_name_th, property_name_en)
    )
  )
`;

export async function findToday(): Promise<Visitor[]> {
  const supabase = await getSupabase();
  const todayStr = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("visitors")
    .select(SELECT_QUERY)
    .eq("visit_date", todayStr)
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding today's visitors:", error);
    return [];
  }

  return (data as VisitorDbRow[] || []).map(mapToVisitor);
}

export async function findQueue(): Promise<Visitor[]> {
  const supabase = await getSupabase();
  
  // Active queue includes CREATED, APPROVED, CHECKED_IN, INSIDE
  const { data, error } = await supabase
    .from("visitors")
    .select(SELECT_QUERY)
    .in("status", ["CREATED", "APPROVED", "CHECKED_IN", "INSIDE"])
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding queue visitors:", error);
    return [];
  }

  return (data as VisitorDbRow[] || []).map(mapToVisitor);
}

export async function findHistory(): Promise<Visitor[]> {
  const supabase = await getSupabase();
  
  // History includes CHECKED_OUT, CLOSED, CANCELLED
  const { data, error } = await supabase
    .from("visitors")
    .select(SELECT_QUERY)
    .in("status", ["CHECKED_OUT", "CLOSED", "CANCELLED"])
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding historical visitors:", error);
    return [];
  }

  return (data as VisitorDbRow[] || []).map(mapToVisitor);
}

export async function findByCode(visitorCode: string): Promise<Visitor | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("visitors")
    .select(SELECT_QUERY)
    .eq("visitor_code", visitorCode)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error finding visitor by code: ${visitorCode}`, error);
    return null;
  }

  return data ? mapToVisitor(data as VisitorDbRow) : null;
}

export async function findById(id: string): Promise<Visitor | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("visitors")
    .select(SELECT_QUERY)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error finding visitor by id: ${id}`, error);
    return null;
  }

  return data ? mapToVisitor(data as VisitorDbRow) : null;
}

export async function findActiveSession(
  residentAssignmentId: string,
  visitorName: string,
  visitDate: string
): Promise<Visitor | null> {
  const supabase = await getSupabase();
  
  // Find any active session (not CLOSED or CANCELLED) matching resident, name and date
  const { data, error } = await supabase
    .from("visitors")
    .select(SELECT_QUERY)
    .eq("resident_assignment_id", residentAssignmentId)
    .eq("visitor_name", visitorName)
    .eq("visit_date", visitDate)
    .not("status", "in", '("CLOSED","CANCELLED")')
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error finding active session:", error);
    return null;
  }

  return data ? mapToVisitor(data as VisitorDbRow) : null;
}

export async function create(dto: CreateVisitorDto): Promise<Visitor> {
  const supabase = await getSupabase();
  
  // Generate a random visitor code (e.g. VIS-12345678)
  const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
  const visitorCode = `VIS-${randomSuffix}`;

  const payload = {
    visitor_code: visitorCode,
    resident_assignment_id: dto.resident_assignment_id,
    visitor_name: dto.visitor_name,
    phone: dto.phone || null,
    vehicle_plate: dto.vehicle_plate || null,
    visit_date: dto.visit_date,
    expected_arrival: dto.expected_arrival || null,
    purpose: dto.purpose || null,
    status: dto.status || "CREATED",
    remarks: dto.remark || null,
    created_by: dto.created_by || null,
    company: dto.company || null,
    security_user: dto.security_user || null,
    expected_checkout_time: dto.expected_checkout_time || null,
  };

  const { data, error } = await supabase
    .from("visitors")
    .insert([payload])
    .select(SELECT_QUERY)
    .single();

  if (error) {
    throw new Error(`Failed to create visitor request: ${error.message}`);
  }

  return mapToVisitor(data as VisitorDbRow);
}

export async function update(id: string, dto: UpdateVisitorDto): Promise<Visitor | null> {
  const supabase = await getSupabase();
  const payload: Record<string, unknown> = {};

  if (dto.visitor_name !== undefined) payload.visitor_name = dto.visitor_name;
  if (dto.phone !== undefined) payload.phone = dto.phone;
  if (dto.vehicle_plate !== undefined) payload.vehicle_plate = dto.vehicle_plate;
  if (dto.visit_date !== undefined) payload.visit_date = dto.visit_date;
  if (dto.expected_arrival !== undefined) payload.expected_arrival = dto.expected_arrival;
  if (dto.purpose !== undefined) payload.purpose = dto.purpose;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.remark !== undefined) payload.remarks = dto.remark;
  if (dto.updated_by !== undefined) payload.updated_by = dto.updated_by;
  if (dto.actual_checkout_time !== undefined) payload.actual_checkout_time = dto.actual_checkout_time;
  if (dto.check_in_time !== undefined) payload.check_in_time = dto.check_in_time;
  if (dto.security_user !== undefined) payload.security_user = dto.security_user;
  
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("visitors")
    .update(payload)
    .eq("id", id)
    .select(SELECT_QUERY)
    .single();

  if (error) {
    console.error(`Error updating visitor ${id}:`, error);
    return null;
  }

  return mapToVisitor(data as VisitorDbRow);
}

export async function close(id: string, updatedBy?: string | null): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("visitors")
    .update({
      status: "CLOSED",
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`Error closing visitor session ${id}:`, error);
    return false;
  }

  return true;
}
