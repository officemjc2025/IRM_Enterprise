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
  PROPERTY_MANAGER: "property_manager",

OFFICE_STAFF: "office_staff",

ACCOUNTING: "accounting",
} as const;

export type Role =
  (typeof Roles)[keyof typeof Roles];