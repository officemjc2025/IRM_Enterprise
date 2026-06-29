import { Status } from "@/shared/enums/status";

export interface Unit {
  id: string;
  property_id: string;
  building_code: string;
  floor: string;
  unit_number: string;
  area: number;
  ownership_ratio: number;
  status: Status;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CreateUnitDto {
  property_id: string;
  building_code: string;
  floor: string;
  unit_number: string;
  area: number;
  ownership_ratio: number;
  status?: Status;
}

export interface UpdateUnitDto {
  property_id?: string;
  building_code?: string;
  floor?: string;
  unit_number?: string;
  area?: number;
  ownership_ratio?: number;
  status?: Status;
}
