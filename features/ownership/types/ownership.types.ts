import { Status } from "@/shared/enums/status";
import { Person } from "@/features/person/types/person.types";
import { Unit } from "@/features/unit/types/unit.types";

export interface Ownership {
  id: string;
  person_id: string;
  unit_id: string;
  ownership_percentage: number;
  ownership_type: string;
  start_date: string;
  end_date: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
  person?: Person | null;
  unit?: Unit | null;
}

export interface CreateOwnershipDto {
  person_id: string;
  unit_id: string;
  ownership_percentage: number;
  ownership_type: string;
  start_date: string;
  end_date?: string | null;
  status?: Status;
}

export interface UpdateOwnershipDto {
  person_id?: string;
  unit_id?: string;
  ownership_percentage?: number;
  ownership_type?: string;
  start_date?: string;
  end_date?: string | null;
  status?: Status;
}
