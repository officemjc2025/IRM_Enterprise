import { Status } from "@/shared/enums/status";
import { Person } from "@/features/person/types/person.types";
import { Unit } from "@/features/unit/types/unit.types";

export interface ResidentAssignment {
  id: string;
  person_id: string;
  unit_id: string;
  occupancy_type: string;
  primary_resident: boolean;
  move_in_date: string;
  move_out_date: string | null;
  status: Status;
  remark: string | null;
  created_at: string;
  updated_at: string;
  person?: Person | null;
  unit?: Unit | null;
}

export interface CreateResidentAssignmentDto {
  person_id: string;
  unit_id: string;
  occupancy_type: string;
  primary_resident: boolean;
  move_in_date: string;
  move_out_date?: string | null;
  status?: Status;
  remark?: string | null;
}

export interface UpdateResidentAssignmentDto {
  person_id?: string;
  unit_id?: string;
  occupancy_type?: string;
  primary_resident?: boolean;
  move_in_date?: string;
  move_out_date?: string | null;
  status?: Status;
  remark?: string | null;
}

export const RESIDENT_OCCUPANCY_TYPES = ["OWNER", "TENANT", "CO_OWNER", "RESIDENT"];
