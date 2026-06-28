import { Status } from "@/shared/enums/status";

export interface Property {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  status: Status;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CreatePropertyDto {
  code: string;
  name_th: string;
  name_en: string;
  status?: Status;
}

export interface UpdatePropertyDto {
  code?: string;
  name_th?: string;
  name_en?: string;
  status?: Status;
}

export interface PropertySummary {
  totalBuildings: number;
  totalUnits: number;
  totalResidents: number;
}
