import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";
import { Unit } from "@/features/unit/types/unit.types";

export type VisitorStatus =
  | "CREATED"
  | "APPROVED"
  | "CHECKED_IN"
  | "INSIDE"
  | "CHECKED_OUT"
  | "CLOSED"
  | "CANCELLED";

export interface Visitor {
  id: string;
  visitor_code: string;
  resident_assignment_id: string | null;
  visitor_name: string;
  phone: string | null;
  vehicle_plate: string | null;
  visit_date: string;
  expected_arrival: string | null;
  purpose: string | null;
  status: VisitorStatus;
  remark: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  
  // Backward compatibility fields for old check-in screens
  check_in_time?: string | null;
  expected_checkout_time?: string | null;
  actual_checkout_time?: string | null;
  company?: string | null;
  security_user?: string | null;

  // Relations
  resident_assignment?: ResidentAssignment | null;
  unit?: Unit | null;
}

export interface CreateVisitorDto {
  resident_assignment_id: string;
  visitor_name: string;
  phone?: string | null;
  vehicle_plate?: string | null;
  visit_date: string;
  expected_arrival?: string | null;
  purpose?: string | null;
  status?: VisitorStatus;
  remark?: string | null;
  created_by?: string | null;

  // Backward compatibility
  company?: string | null;
  security_user?: string | null;
  expected_checkout_time?: string | null;
}

export interface UpdateVisitorDto {
  visitor_name?: string;
  phone?: string | null;
  vehicle_plate?: string | null;
  visit_date?: string;
  expected_arrival?: string | null;
  purpose?: string | null;
  status?: VisitorStatus;
  remark?: string | null;
  updated_by?: string | null;

  // Backward compatibility
  actual_checkout_time?: string | null;
  check_in_time?: string | null;
  security_user?: string | null;
}
