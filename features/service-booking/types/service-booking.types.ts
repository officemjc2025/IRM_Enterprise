import { WorkOrder } from "@/features/work-order/types/work-order.types";

export type ServiceBookingType = "ROOM_CLEANING" | "ROOM_SERVICE" | "OTHER";

export type ServiceBookingStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "WORK_ORDER_CREATED"
  | "COMPLETED"
  | "CANCELLED";

export type BookingAttentionStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED_NOT_DISPATCHED"
  | "WORK_ORDER_CREATED"
  | "CANCELLED"
  | "NORMAL";

export interface ServiceBooking {
  id: string;
  booking_number: string;
  property_id: string;
  unit_id: string;
  customer_person_id: string | null;
  service_type: ServiceBookingType;
  status: ServiceBookingStatus;
  requested_start_at: string;
  requested_end_at: string | null;
  customer_note: string | null;
  admin_note: string | null;
  quoted_amount: number | null;
  confirmed_amount: number | null;
  currency: string;
  created_by: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  work_order_id: string | null;
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
  customer?: {
    id: string;
    first_name: string;
    last_name: string | null;
    display_name: string | null;
  };
  work_order?: WorkOrder;
}

export function deriveBookingAttention(booking: ServiceBooking): BookingAttentionStatus {
  if (booking.status === "PENDING_CONFIRMATION") {
    return "PENDING_CONFIRMATION";
  }
  if (booking.status === "CONFIRMED" && !booking.work_order_id) {
    return "CONFIRMED_NOT_DISPATCHED";
  }
  if (booking.status === "WORK_ORDER_CREATED") {
    return "WORK_ORDER_CREATED";
  }
  if (booking.status === "CANCELLED") {
    return "CANCELLED";
  }
  return "NORMAL";
}
