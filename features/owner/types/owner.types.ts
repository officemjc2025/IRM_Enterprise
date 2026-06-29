import { Status } from "@/shared/enums/status";

export interface Owner {
  id: string;
  owner_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  tax_id: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CreateOwnerDto {
  owner_code: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  tax_id?: string | null;
  status?: Status;
}

export interface UpdateOwnerDto {
  owner_code?: string;
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  tax_id?: string | null;
  status?: Status;
}
