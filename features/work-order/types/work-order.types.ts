import { Property } from "@/features/property/types/property.types";
import { Unit } from "@/features/unit/types/unit.types";
import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";

export type WorkOrderPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type WorkOrderStatus =
  | "NEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

export interface WorkOrderPhoto {
  id: string;
  work_order_id: string;
  photo_stage: "BEFORE" | "AFTER";
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface WorkOrder {
  id: string;
  work_order_code: string;
  property_id: string;
  unit_id: string;
  resident_assignment_id: string | null;
  category: string;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  service_team: "TECHNICIAN" | "HOUSEKEEPING";
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

  // Mobile/Execution fields
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  work_performed?: string | null;
  additional_work?: string | null;
  worker_remark?: string | null;
  charge_amount?: number | null;
  actual_cost?: number | null;

  // Relations
  property?: Property | null;
  unit?: Unit | null;
  resident_assignment?: ResidentAssignment | null;
  assignee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  photos?: WorkOrderPhoto[] | null;
}

export interface CreateWorkOrderDto {
  property_id: string;
  unit_id: string;
  resident_assignment_id?: string | null;
  category: string;
  title: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  service_team?: "TECHNICIAN" | "HOUSEKEEPING";
  assigned_to?: string | null;
  scheduled_at?: string | null;
  created_by?: string | null;
}

export interface UpdateWorkOrderDto {
  category?: string;
  title?: string;
  description?: string | null;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  service_team?: "TECHNICIAN" | "HOUSEKEEPING";
  assigned_to?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  closed_at?: string | null;
  updated_by?: string | null;

  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  work_performed?: string | null;
  additional_work?: string | null;
  worker_remark?: string | null;
  charge_amount?: number | null;
  actual_cost?: number | null;
}
