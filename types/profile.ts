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
  language: "th" | "en";
  theme: "light" | "dark" | "system";
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
};