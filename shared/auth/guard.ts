import { Role } from "./roles";

export function hasPermission(
  role: Role,
  allow: readonly string[]
) {
  return allow.includes(role);
}