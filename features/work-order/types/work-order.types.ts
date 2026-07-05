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
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;

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
  schedule_changes?: WorkOrderScheduleChange[] | null;
}

export interface WorkOrderScheduleChange {
  id: string;
  work_order_id: string;
  old_scheduled_at: string | null;
  requested_scheduled_at: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requested_by: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_remark: string | null;
  created_at: string;
  updated_at: string;
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
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
}

export type AttentionStatus =
  | "PENDING_RESCHEDULE_APPROVAL"
  | "RESCHEDULE_REJECTED"
  | "RESCHEDULE_APPROVED"
  | "NORMAL"
  | "CANCELLED";

export function deriveAttentionStatus(order: WorkOrder): AttentionStatus {
  if (order.schedule_changes && order.schedule_changes.length > 0) {
    const sorted = [...order.schedule_changes].sort(
      (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    );

    const hasPending = sorted.some((sc) => sc.status === "PENDING");
    if (hasPending) {
      return "PENDING_RESCHEDULE_APPROVAL";
    }

    const latest = sorted[0];
    if (latest.status === "APPROVED") {
      return "RESCHEDULE_APPROVED";
    } else if (latest.status === "REJECTED") {
      return "RESCHEDULE_REJECTED";
    } else if (latest.status === "CANCELLED") {
      return "CANCELLED";
    }
  }

  return "NORMAL";
}
