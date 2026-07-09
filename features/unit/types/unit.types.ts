import { Status } from "@/shared/enums/status";
import { UnitOperationalStatus } from "@/shared/enums/unit-operational-status";

export interface Unit {
  id: string;
  property_id: string;
  building_code: string;
  floor: string;
  unit_number: string;
  area: number;
  ownership_ratio: number;
  status: Status;
  // Canonical operational state — authoritative single field
  operational_status: UnitOperationalStatus;
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
  operational_status?: UnitOperationalStatus;
}

export interface UpdateUnitDto {
  property_id?: string;
  building_code?: string;
  floor?: string;
  unit_number?: string;
  area?: number;
  ownership_ratio?: number;
  status?: Status;
  // May only be set via /api/v1/units/:id/status (lifecycle service)
  operational_status?: UnitOperationalStatus;
}

