export const PERMISSIONS = {

  DASHBOARD_VIEW: "dashboard.view",

  PROPERTY_VIEW: "property.view",
  PROPERTY_CREATE: "property.create",
  PROPERTY_UPDATE: "property.update",
  PROPERTY_DELETE: "property.delete",

  UNIT_VIEW: "unit.view",
  UNIT_UPDATE: "unit.update",

  RESIDENT_VIEW: "resident.view",
  RESIDENT_CREATE: "resident.create",
  RESIDENT_UPDATE: "resident.update",

  VISITOR_VIEW: "visitor.view",
  VISITOR_CHECKIN: "visitor.checkin",
  VISITOR_CHECKOUT: "visitor.checkout",

  WORKORDER_VIEW: "workorder.view",
  WORKORDER_CREATE: "workorder.create",
  WORKORDER_ASSIGN: "workorder.assign",
  WORKORDER_COMPLETE: "workorder.complete",

  REPORT_VIEW: "report.view",

  SETTINGS_VIEW: "settings.view",

} as const;