export const ROLES = {
  SUPER_ADMIN: "super_admin",
  PROPERTY_ADMIN: "property_admin",
  MANAGER: "manager",

  OWNER: "owner",
  CO_OWNER: "co_owner",
  TENANT: "tenant",
  RESIDENT: "resident",

  SECURITY: "security",
  TECHNICIAN: "technician",
  ACCOUNTING: "accounting",
  HOUSEKEEPING: "housekeeping",
  RECEPTION: "reception",

  COMMITTEE: "committee",

  GUEST: "guest",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];