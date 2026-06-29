import { Status } from "@/shared/enums/status";

export type OccupancyType =
  | "OWNER"
  | "CO_OWNER"
  | "TENANT"
  | "RESIDENT"
  | "COMPANY"
  | "VACANT";

export const OCCUPANCY_TYPES: OccupancyType[] = [
  "OWNER",
  "CO_OWNER",
  "TENANT",
  "RESIDENT",
  "COMPANY",
  "VACANT",
];

export interface Occupancy {
  id: string;
  unit_id: string;
  person_id: string;
  occupancy_type: OccupancyType;
  start_date: string;
  end_date: string | null;
  status: Status;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;

  unit?: {
    unit_number: string;
    building_code: string;
    floor: string;
  } | null;
  person?: {
    first_name: string;
    last_name: string | null;
  } | null;
}

export interface CreateOccupancyDto {
  unit_id: string;
  person_id: string;
  occupancy_type: OccupancyType;
  start_date: string;
  end_date?: string | null;
  status?: Status;
  remarks?: string | null;
}

export interface UpdateOccupancyDto {
  unit_id?: string;
  person_id?: string;
  occupancy_type?: OccupancyType;
  start_date?: string;
  end_date?: string | null;
  status?: Status;
  remarks?: string | null;
}
