export interface Visitor {
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
  status: "CHECKED_IN" | "CHECKED_OUT";
  remarks: string | null;
  created_at: string;
  updated_at: string;
  unit?: {
    unit_number: string;
    building_code: string | null;
    floor: string | null;
  };
}

export interface CheckInVisitorDto {
  unit_id: string;
  visitor_name: string;
  phone?: string | null;
  purpose: string;
  vehicle_plate?: string | null;
  company?: string | null;
  occupancy_id?: string | null;
  security_user?: string | null;
  expected_checkout_time?: string | null;
  remarks?: string | null;
}
