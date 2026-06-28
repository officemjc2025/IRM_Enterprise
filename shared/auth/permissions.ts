import { ROLES } from "./roles";

export const Permissions = {

  ManageProperty: [
    ROLES.SUPER_ADMIN,
    ROLES.PROPERTY_ADMIN,
  ],

  ManageResident: [
    ROLES.SUPER_ADMIN,
    ROLES.PROPERTY_ADMIN,
  ],

  SecurityGate: [
    ROLES.SECURITY,
    ROLES.PROPERTY_ADMIN,
  ],

  WorkOrder: [
    ROLES.TECHNICIAN,
    ROLES.PROPERTY_ADMIN,
  ],

  ResidentPortal: [
    ROLES.OWNER,
    ROLES.CO_OWNER,
    ROLES.TENANT,
    ROLES.RESIDENT,
  ],
};