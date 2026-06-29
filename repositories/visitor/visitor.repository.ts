import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Visitor, CheckInVisitorDto } from "@/features/visitor/types/visitor.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface VisitorDbRow {
  id: string;
  visitor_number: string;
  visitor_name: string;
  phone: string | null;
  purpose: string;
  vehicle_plate: string | null;
  company: string | null;
  unit_id: string;
  occupancy_id: string | null;
  security_user: string | null;
  check_in_time: string;
  expected_checkout_time: string | null;
  actual_checkout_time: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  unit?: {
    unit_number: string;
    building_code: string | null;
    floor: string | null;
  };
}

function mapToVisitor(row: VisitorDbRow): Visitor {
  return {
    id: row.id,
    visitor_number: row.visitor_number,
    visitor_name: row.visitor_name,
    phone: row.phone,
    purpose: row.purpose,
    vehicle_plate: row.vehicle_plate,
    company: row.company,
    unit_id: row.unit_id,
    occupancy_id: row.occupancy_id,
    security_user: row.security_user,
    check_in_time: row.check_in_time,
    expected_checkout_time: row.expected_checkout_time,
    actual_checkout_time: row.actual_checkout_time,
    status: row.status as "CHECKED_IN" | "CHECKED_OUT",
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    unit: row.unit ? {
      unit_number: row.unit.unit_number,
      building_code: row.unit.building_code,
      floor: row.unit.floor
    } : undefined
  };
}

export async function findAll(): Promise<Visitor[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("visitor")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor)
    `)
    .is("deleted_at", null)
    .order("check_in_time", { ascending: false });

  if (error) {
    console.error("Error finding visitors:", error);
    return [];
  }

  return (data as VisitorDbRow[] || []).map(mapToVisitor);
}

export async function findById(id: string): Promise<Visitor | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("visitor")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error(`Error finding visitor by id ${id}:`, error);
    return null;
  }

  return mapToVisitor(data as VisitorDbRow);
}

export async function create(dto: CheckInVisitorDto, visitorNumber: string): Promise<Visitor> {
  const supabase = await getSupabase();
  const payload = {
    visitor_number: visitorNumber,
    visitor_name: dto.visitor_name,
    phone: dto.phone || null,
    purpose: dto.purpose,
    vehicle_plate: dto.vehicle_plate || null,
    company: dto.company || null,
    unit_id: dto.unit_id,
    occupancy_id: dto.occupancy_id || null,
    security_user: dto.security_user || null,
    expected_checkout_time: dto.expected_checkout_time || null,
    remarks: dto.remarks || null,
    status: "CHECKED_IN",
    check_in_time: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("visitor")
    .insert([payload])
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to check in visitor: ${error.message}`);
  }

  return mapToVisitor(data as VisitorDbRow);
}

export async function checkOut(id: string): Promise<Visitor | null> {
  const supabase = await getSupabase();
  const payload = {
    status: "CHECKED_OUT",
    actual_checkout_time: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("visitor")
    .update(payload)
    .eq("id", id)
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor)
    `)
    .single();

  if (error) {
    console.error(`Error checking out visitor ${id}:`, error);
    return null;
  }

  return mapToVisitor(data as VisitorDbRow);
}

export async function findDuplicateActive(
  visitorName: string,
  unitId: string,
  timeWindowSeconds: number = 300
): Promise<Visitor | null> {
  const supabase = await getSupabase();
  const cutoff = new Date(Date.now() - timeWindowSeconds * 1000).toISOString();

  const { data, error } = await supabase
    .from("visitor")
    .select(`
      *,
      unit:unit_id (unit_number, building_code, floor)
    `)
    .eq("unit_id", unitId)
    .eq("status", "CHECKED_IN")
    .ilike("visitor_name", visitorName)
    .gte("check_in_time", cutoff)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error finding duplicate active visitor:", error);
    return null;
  }
  return data ? mapToVisitor(data as VisitorDbRow) : null;
}
