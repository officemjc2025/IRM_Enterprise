import { WorkOrder } from "@/features/work-order/types/work-order.types";

export type ReservationType = "RENTAL_GUEST" | "OWNER_STAY" | "MANAGEMENT_USE" | "OTHER";

export type BillingBasis = "MONTHLY" | "DAILY" | "CUSTOM";

export type ReservationStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export type ReservationAttentionStatus =
  | "PENDING_CONFIRMATION"
  | "UPCOMING_CHECK_IN"
  | "CURRENTLY_IN_HOUSE"
  | "UPCOMING_CHECK_OUT"
  | "CANCELLED"
  | "NO_SHOW"
  | "NORMAL";

export type PricingMethod = "HALF_MONTH" | "DAILY_PRORATE" | "FULL_MONTH" | "CUSTOM";

export interface ReservationExtension {
  id: string;
  reservation_id: string;
  previous_check_out_at: string;
  requested_check_out_at: string;
  approved_check_out_at: string | null;
  pricing_method: PricingMethod;
  calculated_amount: number | null;
  approved_amount: number | null;
  reason: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  requested_by: string | null;
  approved_by: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface Reservation {
  id: string;
  reservation_number: string;
  property_id: string;
  unit_id: string;
  primary_guest_person_id: string | null;
  reservation_type: ReservationType;
  status: ReservationStatus;
  billing_basis: BillingBasis;
  check_in_at: string;
  check_out_at: string;
  adult_count: number;
  child_count: number;

  // Commercial pricing fields
  monthly_rate: number | null;
  daily_rate: number | null;
  base_rental_amount: number | null;
  extension_amount: number | null;
  discount_amount: number | null;
  deposit_amount: number | null;
  calculated_total_amount: number | null;
  approved_total_amount: number | null;
  currency: string;

  booking_channel: string | null;
  external_reference: string | null;
  guest_note: string | null;
  internal_note: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  checked_in_by: string | null;
  actual_check_in_at: string | null;
  checked_out_by: string | null;
  actual_check_out_at: string | null;
  created_at: string;
  updated_at: string;

  // Relations
  property?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
  };
  unit?: {
    id: string;
    unit_number: string;
  };
  primary_guest?: {
    id: string;
    first_name: string;
    last_name: string | null;
    display_name: string | null;
  };
  work_orders?: WorkOrder[];
  extensions?: ReservationExtension[];
  stay_charge_periods?: import("./stay.types").StayChargePeriod[];
}

export function deriveReservationAttention(res: Reservation): ReservationAttentionStatus {
  if (res.status === "PENDING_CONFIRMATION") {
    return "PENDING_CONFIRMATION";
  }
  if (res.status === "CANCELLED") {
    return "CANCELLED";
  }
  if (res.status === "NO_SHOW") {
    return "NO_SHOW";
  }
  if (res.status === "CHECKED_IN") {
    return "CURRENTLY_IN_HOUSE";
  }
  
  // Calculate relative to current Bangkok day
  const today = new Date();
  const checkIn = new Date(res.check_in_at);

  if (res.status === "CONFIRMED") {
    const diffTime = checkIn.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 3 && diffDays >= -1) {
      return "UPCOMING_CHECK_IN";
    }
  }

  return "NORMAL";
}
