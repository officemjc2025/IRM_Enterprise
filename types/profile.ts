import { Role } from "@/shared/auth";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  property_id: string | null;
  person_id: string | null;
  language: "th" | "en";
  theme: "light" | "dark" | "system";
  status: "active" | "inactive" | "suspended";
  account_status: "PENDING" | "ACTIVE" | "LOCKED" | "DISABLED";
  force_password_change: boolean;
  accepted_terms_at: string | null;
  accepted_privacy_at: string | null;
  department?: string | null;
  team?: string | null;
  created_at: string;
  updated_at: string;
};