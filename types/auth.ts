import { Role } from "@/shared/auth/roles";

export interface AuthUser {

  id: string;

  email: string;

  role: Role;

}