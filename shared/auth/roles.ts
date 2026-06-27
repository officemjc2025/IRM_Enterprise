export const Roles = {
  SUPER_ADMIN: "super_admin",

  ADMIN: "admin",

  COMMITTEE: "committee",

  SECURITY: "security",

  TECHNICIAN: "technician",

  OWNER: "owner",

  CO_OWNER: "co_owner",

  TENANT: "tenant",

  RESIDENT: "resident",
} as const;

export type Role =
  (typeof Roles)[keyof typeof Roles];