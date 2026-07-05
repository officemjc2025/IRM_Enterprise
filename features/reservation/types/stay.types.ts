import { Reservation } from "./reservation.types";

export type RentStatus = "PENDING" | "PAID" | "OVERDUE" | "WAIVED";
export type UtilityStatus = "PENDING" | "READY" | "PAID";
export type OverallStatus =
  | "NOT_READY"
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "WAIVED"
  | "CANCELLED";

export type StayAttentionStatus =
  | "RENT_DUE_SOON"
  | "RENT_DUE_TODAY"
  | "RENT_OVERDUE"
  | "PARTIAL_PAYMENT"
  | "WATER_PENDING"
  | "ELECTRICITY_PENDING"
  | "UTILITIES_INCOMPLETE"
  | "EXTENSION_PENDING"
  | "UPCOMING_CHECKOUT"
  | "CHECKOUT_OVERDUE"
  | "NORMAL";

export interface StayChargePeriod {
  id: string;
  reservation_id: string;
  property_id: string;
  unit_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  
  rent_amount: number;
  water_amount: number | null;
  electricity_amount: number | null;
  other_amount: number;
  discount_amount: number;
  
  expected_total: number;
  approved_total: number | null;
  
  rent_status: RentStatus;
  water_status: UtilityStatus;
  electricity_status: UtilityStatus;
  overall_status: OverallStatus;
  
  paid_amount: number;
  outstanding_amount: number;
  
  note: string | null;
  status_changed_by: string | null;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  reservation?: Reservation;
}

export function deriveStayAttention(stay: Reservation, currentPeriod: StayChargePeriod | null): StayAttentionStatus {
  const today = new Date();
  
  // Checkout alerts
  const checkOut = new Date(stay.check_out_at);
  if (stay.status === "CHECKED_IN") {
    const diffTime = checkOut.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return "CHECKOUT_OVERDUE";
    }
    if (diffDays <= 3) {
      return "UPCOMING_CHECKOUT";
    }
  }

  // Extension pending alerts
  if (stay.extensions && stay.extensions.some((ext) => ext.status === "PENDING_APPROVAL")) {
    return "EXTENSION_PENDING";
  }

  if (currentPeriod) {
    // Utility completeness checks
    if (currentPeriod.water_status === "PENDING") {
      return "WATER_PENDING";
    }
    if (currentPeriod.electricity_status === "PENDING") {
      return "ELECTRICITY_PENDING";
    }
    if (currentPeriod.overall_status === "NOT_READY") {
      return "UTILITIES_INCOMPLETE";
    }

    // Payment due date checks
    const dueDate = new Date(currentPeriod.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (currentPeriod.overall_status === "OVERDUE" || (currentPeriod.overall_status === "PENDING" && diffDays < 0)) {
      return "RENT_OVERDUE";
    }
    if (currentPeriod.overall_status === "PARTIALLY_PAID") {
      return "PARTIAL_PAYMENT";
    }
    if (diffDays === 0) {
      return "RENT_DUE_TODAY";
    }
    if (diffDays <= 3 && diffDays > 0) {
      return "RENT_DUE_SOON";
    }
  }

  return "NORMAL";
}
