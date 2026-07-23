import { ROLES } from "./roles";

export const Permissions = {

  ManageProperty: [
    ROLES.SUPER_ADMIN,
    ROLES.PROPERTY_ADMIN,
  ],

  ManageStaff: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.PROPERTY_ADMIN,
    ROLES.OFFICE,
  ],

  ManageResident: [
    ROLES.SUPER_ADMIN,
    ROLES.PROPERTY_ADMIN,
    ROLES.OFFICE,
  ],

  SecurityGate: [
    ROLES.SECURITY,
    ROLES.PROPERTY_ADMIN,
  ],

  WorkOrder: [
    ROLES.TECHNICIAN,
    ROLES.PROPERTY_ADMIN,
    ROLES.OFFICE,
  ],

  ResidentPortal: [
    ROLES.OWNER,
    ROLES.CO_OWNER,
    ROLES.TENANT,
    ROLES.RESIDENT,
  ],
};