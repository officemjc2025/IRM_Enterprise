import { Status } from "@/shared/enums/status";

export interface Person {
  id: string;
  person_code: string | null;
  title: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  id_card: string | null;
  passport: string | null;
  photo: string | null;
  status: Status;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CreatePersonDto {
  person_code?: string | null;
  title?: string | null;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;
  id_card?: string | null;
  passport?: string | null;
  photo?: string | null;
  status?: Status;
  remarks?: string | null;
}

export interface UpdatePersonDto {
  person_code?: string | null;
  title?: string | null;
  first_name?: string;
  last_name?: string;
  display_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  phone?: string | null;
  email?: string | null;
  id_card?: string | null;
  passport?: string | null;
  photo?: string | null;
  status?: Status;
  remarks?: string | null;
}
