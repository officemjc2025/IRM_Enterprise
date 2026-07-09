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

export type UtilityControlType = "NORMAL" | "SHUTOFF_REQUESTED" | "SHUT_OFF" | "RECONNECT_REQUESTED" | "RESTRICTED_NO_RECONNECT";

export interface UtilityMeter {
  id: string;
  property_id: string;
  unit_id: string;
  utility_type: "WATER" | "ELECTRICITY";
  meter_number: string;
  manufacturer_serial_number?: string | null;
  installation_date_known?: boolean;
  meter_status: "ACTIVE" | "INACTIVE" | "RETIRED";
  initial_reading: number;
  installed_at: string | null;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations
  unit?: {
    id: string;
    unit_number: string;
  };
}

export interface UtilityRate {
  id: string;
  property_id: string;
  utility_type: "WATER" | "ELECTRICITY";
  rate_per_unit: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
}

export type ReadingCycleStatus = "DRAFT" | "OPEN" | "IN_PROGRESS" | "REVIEW" | "CLOSED" | "CANCELLED";

export interface MeterReadingCycle {
  id: string;
  property_id: string;
  utility_type: "WATER" | "ELECTRICITY";
  cycle_code: string;
  cycle_name: string;
  billing_month: string;
  reading_start_date: string;
  reading_due_date: string;
  status: ReadingCycleStatus;
  created_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReadingStatus = "PENDING" | "SUBMITTED" | "REVIEW" | "APPROVED" | "REJECTED";
export type AnomalyStatus = "NORMAL" | "HIGH_USAGE" | "ZERO_USAGE" | "TECHNICIAN_FLAGGED" | "METER_SUSPECTED" | "REVIEW_REQUIRED";
export type ReadingSyncStatus = "NOT_APPLICABLE" | "PENDING_PERIOD" | "SYNCED" | "SYNC_FAILED";

export interface MeterReading {
  id: string;
  cycle_id: string;
  meter_id: string;
  property_id: string;
  unit_id: string;
  utility_type: "WATER" | "ELECTRICITY";
  previous_reading: number;
  current_reading: number | null;
  usage_units: number | null;
  rate_per_unit_snapshot: number | null;
  calculated_amount: number | null;
  status: ReadingStatus;
  anomaly_status: AnomalyStatus;
  anomaly_reason: string | null;
  technician_note: string | null;
  manager_note: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  photo_url: string | null;
  linked_stay_charge_period_id: string | null;
  sync_status: ReadingSyncStatus;
  created_at: string;
  updated_at: string;
  recheck_requested?: boolean;
  recheck_reason?: string | null;
  treatment_rate_snapshot?: number | null;
  treatment_amount?: number | null;

  // Joint relations
  unit?: {
    id: string;
    unit_number: string;
    water_control_status: UtilityControlType;
    electricity_control_status: UtilityControlType;
  };
  meter?: UtilityMeter;
  cycle?: MeterReadingCycle;
}

export interface MeterReplacementHistory {
  id: string;
  property_id: string;
  unit_id: string;
  utility_type: "WATER" | "ELECTRICITY";
  old_meter_id: string | null;
  old_meter_number: string | null;
  final_reading: number | null;
  new_meter_id: string | null;
  new_meter_number: string;
  starting_reading: number;
  replacement_reason: string;
  replaced_by: string | null;
  replaced_at: string;
}

