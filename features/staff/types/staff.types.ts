import { Role } from "@/shared/auth";

export interface Staff {
  id: string; // matches profiles.id (auth.users.id)
  person_id: string | null;
  property_id: string | null;
  email: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  role: Role;
  department: string | null;
  status: "active" | "inactive" | "suspended";
  account_status: "PENDING" | "ACTIVE" | "LOCKED" | "DISABLED";
  force_password_change: boolean;
  created_at: string;
  updated_at: string;
  
  // joined from persons table
  employee_code?: string | null; // maps to person_code
  first_name?: string;
  last_name?: string;
  
  // joined from properties table
  property_name_th?: string | null;
  property_name_en?: string | null;

  // New hardened fields
  prefix?: string | null;
  nickname?: string | null;
  team?: string | null;
  invitation_status?: "NOT_SENT" | "INVITED" | "ACCEPTED" | "EXPIRED";
  language?: string | null;
  photo_url?: string | null;
  last_login?: string | null;
  auth_status?: string | null;
}

export interface CreateStaffDto {
  employee_code?: string | null;
  prefix?: string | null;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  display_name?: string | null;
  email: string;
  phone?: string | null;
  role: Role;
  department?: string | null;
  team?: string | null;
  property_id?: string | null;
  language?: string | null;
  photo_url?: string | null;
  send_invitation?: boolean;
}

export interface UpdateStaffDto {
  employee_code?: string | null;
  prefix?: string | null;
  first_name?: string;
  last_name?: string;
  nickname?: string | null;
  display_name?: string | null;
  phone?: string | null;
  role?: Role;
  department?: string | null;
  team?: string | null;
  property_id?: string | null;
  status?: "active" | "inactive" | "suspended";
  account_status?: "PENDING" | "ACTIVE" | "LOCKED" | "DISABLED";
  language?: string | null;
  photo_url?: string | null;
  invitation_status?: "NOT_SENT" | "INVITED" | "ACCEPTED" | "EXPIRED" | null;
}

export interface StaffStats {
  total: number;
  active: number;
  disabled: number;
  byRole: Record<string, number>;
}
