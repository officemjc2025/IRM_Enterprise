import { Roles } from "./roles";

export const Permissions = {

  ManageProperty: [
    Roles.SUPER_ADMIN,
    Roles.ADMIN,
  ],

  ManageResident: [
    Roles.SUPER_ADMIN,
    Roles.ADMIN,
  ],

  SecurityGate: [
    Roles.SECURITY,
    Roles.ADMIN,
  ],

  WorkOrder: [
    Roles.TECHNICIAN,
    Roles.ADMIN,
  ],

  ResidentPortal: [
    Roles.OWNER,
    Roles.CO_OWNER,
    Roles.TENANT,
    Roles.RESIDENT,
  ],
};