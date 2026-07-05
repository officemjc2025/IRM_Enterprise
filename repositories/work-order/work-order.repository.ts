import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { WorkOrder, WorkOrderPriority, WorkOrderStatus, CreateWorkOrderDto, UpdateWorkOrderDto } from "@/features/work-order/types/work-order.types";
import { Person } from "@/features/person/types/person.types";
import { Status } from "@/shared/enums/status";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface WorkOrderDbRow {
  id: string;
  work_order_code: string;
  property_id: string;
  unit_id: string;
  resident_assignment_id: string | null;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  service_team: string;
  assigned_to: string | null;
  requested_at: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;

  // Joined relations
  properties?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
    address: string | null;
  } | null;

  units?: {
    id: string;
    unit_number: string;
    building_code: string | null;
    floor: string | null;
    status: string;
  } | null;

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
      status: string;
    } | null;
  } | null;

  assignees?: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    email: string;
    phone: string | null;
  } | null;
}

function mapToWorkOrder(row: WorkOrderDbRow): WorkOrder {
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
        photo: null,
        status: (ra.persons.status || "ACTIVE").toUpperCase() as Status,
      } as Person : null,
    };
  }

  return {
    id: row.id,
    work_order_code: row.work_order_code,
    property_id: row.property_id,
    unit_id: row.unit_id,
    resident_assignment_id: row.resident_assignment_id,
    category: row.category,
    title: row.title,
    description: row.description,
    priority: row.priority as WorkOrderPriority,
    status: row.status as WorkOrderStatus,
    service_team: row.service_team as "TECHNICIAN" | "HOUSEKEEPING",
    assigned_to: row.assigned_to,
    requested_at: row.requested_at,
    scheduled_at: row.scheduled_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    closed_at: row.closed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    deleted_at: row.deleted_at,

    property: row.properties ? {
      id: row.properties.id,
      code: "",
      name_th: row.properties.property_name_th,
      name_en: row.properties.property_name_en || "",
      status: Status.ACTIVE,
      created_at: "",
      updated_at: "",
      created_by: null,
      updated_by: null,
    } : null,

    unit: row.units ? {
      id: row.units.id,
      unit_number: row.units.unit_number,
      building_code: row.units.building_code || "",
      floor: row.units.floor || "",
      property_id: row.property_id,
      status: (row.units.status || "ACTIVE").toUpperCase() as Status,
      area: 0,
      ownership_ratio: 0,
      created_at: "",
      updated_at: "",
    } : null,

    resident_assignment: mappedResidentAssignment,

    assignee: row.assignees ? {
      id: row.assignees.id,
      first_name: row.assignees.full_name || row.assignees.display_name || "Technician",
      last_name: "",
      email: row.assignees.email,
      phone: row.assignees.phone,
    } : null,
  };
}

const SELECT_QUERY = `
  *,
  properties:property_id (*),
  units:unit_id (*),
  resident_assignments:resident_assignment_id (
    *,
    persons:person_id (*)
  ),
  assignees:assigned_to (id, full_name, display_name, email, phone)
`;

export async function findAll(): Promise<WorkOrder[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("work_orders")
    .select(SELECT_QUERY)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error finding all work orders:", error);
    return [];
  }

  return (data as WorkOrderDbRow[] || []).map(mapToWorkOrder);
}

export async function findOpen(): Promise<WorkOrder[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("work_orders")
    .select(SELECT_QUERY)
    .in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error finding open work orders:", error);
    return [];
  }

  return (data as WorkOrderDbRow[] || []).map(mapToWorkOrder);
}

export async function findAssigned(technicianId: string): Promise<WorkOrder[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("work_orders")
    .select(SELECT_QUERY)
    .eq("assigned_to", technicianId)
    .in("status", ["ASSIGNED", "IN_PROGRESS", "ON_HOLD"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`Error finding assigned work orders for ${technicianId}:`, error);
    return [];
  }

  return (data as WorkOrderDbRow[] || []).map(mapToWorkOrder);
}

export async function findHistory(): Promise<WorkOrder[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("work_orders")
    .select(SELECT_QUERY)
    .in("status", ["COMPLETED", "CLOSED", "CANCELLED"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error finding historical work orders:", error);
    return [];
  }

  return (data as WorkOrderDbRow[] || []).map(mapToWorkOrder);
}

export async function findById(id: string): Promise<WorkOrder | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("work_orders")
    .select(SELECT_QUERY)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error finding work order by id ${id}:`, error);
    return null;
  }

  return data ? mapToWorkOrder(data as WorkOrderDbRow) : null;
}

export async function create(dto: CreateWorkOrderDto): Promise<WorkOrder> {
  const supabase = await getSupabase();
  
  // Generate random work order code (e.g. WO-12345678)
  const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
  const workOrderCode = `WO-${randomSuffix}`;

  const payload = {
    work_order_code: workOrderCode,
    property_id: dto.property_id,
    unit_id: dto.unit_id,
    resident_assignment_id: dto.resident_assignment_id || null,
    category: dto.category,
    title: dto.title,
    description: dto.description || null,
    priority: dto.priority || "NORMAL",
    status: dto.status || "NEW",
    service_team: dto.service_team || "TECHNICIAN",
    assigned_to: dto.assigned_to || null,
    scheduled_at: dto.scheduled_at || null,
    created_by: dto.created_by || null,
  };

  const { data, error } = await supabase
    .from("work_orders")
    .insert([payload])
    .select(SELECT_QUERY)
    .single();

  if (error) {
    throw new Error(`Failed to create work order: ${error.message}`);
  }

  return mapToWorkOrder(data as WorkOrderDbRow);
}

export async function update(id: string, dto: UpdateWorkOrderDto): Promise<WorkOrder | null> {
  const supabase = await getSupabase();
  const payload: Record<string, unknown> = {};

  if (dto.category !== undefined) payload.category = dto.category;
  if (dto.title !== undefined) payload.title = dto.title;
  if (dto.description !== undefined) payload.description = dto.description;
  if (dto.priority !== undefined) payload.priority = dto.priority;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.service_team !== undefined) payload.service_team = dto.service_team;
  if (dto.assigned_to !== undefined) payload.assigned_to = dto.assigned_to;
  if (dto.scheduled_at !== undefined) payload.scheduled_at = dto.scheduled_at;
  if (dto.started_at !== undefined) payload.started_at = dto.started_at;
  if (dto.completed_at !== undefined) payload.completed_at = dto.completed_at;
  if (dto.closed_at !== undefined) payload.closed_at = dto.closed_at;
  if (dto.updated_by !== undefined) payload.updated_by = dto.updated_by;

  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("work_orders")
    .update(payload)
    .eq("id", id)
    .select(SELECT_QUERY)
    .single();

  if (error) {
    console.error(`Error updating work order ${id}:`, error);
    return null;
  }

  return mapToWorkOrder(data as WorkOrderDbRow);
}

export async function close(id: string, updatedBy?: string | null): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("work_orders")
    .update({
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`Error closing work order ${id}:`, error);
    return false;
  }

  return true;
}
