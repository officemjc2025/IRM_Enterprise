// =====================================================
// IRM Enterprise — Canonical Unit Operational Status
// Single source of truth for unit operational state.
//
// Architecture Rules:
//   - Owner ≠ Resident ≠ Operational Status
//   - Never infer Status from Owner or Resident
//   - Only lifecycle services may transition this value
// =====================================================

export type UnitOperationalStatus =
  | "OWNER_OCCUPIED"
  | "TENANT_OCCUPIED"
  | "VACANT"
  | "RESERVED"
  | "CHECKING_IN"
  | "CHECKED_IN"
  | "CHECKING_OUT"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE"
  | "STAFF"
  | "MJC"
  | "LOCKED";

export const UNIT_OPERATIONAL_STATUSES: UnitOperationalStatus[] = [
  "OWNER_OCCUPIED",
  "TENANT_OCCUPIED",
  "VACANT",
  "RESERVED",
  "CHECKING_IN",
  "CHECKED_IN",
  "CHECKING_OUT",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
  "STAFF",
  "MJC",
  "LOCKED",
];

// Priority table: lower number = higher priority.
// In the Derived State Engine, highest priority wins.
export const STATUS_PRIORITY: Record<UnitOperationalStatus, number> = {
  OUT_OF_SERVICE:  1,
  LOCKED:          2,
  MAINTENANCE:     3,
  CHECKED_IN:      4,
  CHECKING_IN:     5,
  CHECKING_OUT:    6,
  RESERVED:        7,
  TENANT_OCCUPIED: 8,
  OWNER_OCCUPIED:  9,
  STAFF:           10,
  MJC:             11,
  VACANT:          12,
};

export const STATUS_LABEL_EN: Record<UnitOperationalStatus, string> = {
  OWNER_OCCUPIED:  "Owner Occupied",
  TENANT_OCCUPIED: "Tenant Occupied",
  VACANT:          "Vacant",
  RESERVED:        "Reserved",
  CHECKING_IN:     "Checking In",
  CHECKED_IN:      "Checked In",
  CHECKING_OUT:    "Checking Out",
  MAINTENANCE:     "Maintenance",
  OUT_OF_SERVICE:  "Out of Service",
  STAFF:           "Staff",
  MJC:             "MJC",
  LOCKED:          "Locked",
};

export const STATUS_LABEL_TH: Record<UnitOperationalStatus, string> = {
  OWNER_OCCUPIED:  "เจ้าของอยู่อาศัย",
  TENANT_OCCUPIED: "ผู้เช่าอยู่อาศัย",
  VACANT:          "ห้องว่าง",
  RESERVED:        "จองแล้ว",
  CHECKING_IN:     "กำลังเช็คอิน",
  CHECKED_IN:      "เช็คอินแล้ว",
  CHECKING_OUT:    "กำลังเช็คเอาท์",
  MAINTENANCE:     "ซ่อมบำรุง",
  OUT_OF_SERVICE:  "ปิดให้บริการ",
  STAFF:           "เจ้าหน้าที่",
  MJC:             "MJC / นิติบุคคล",
  LOCKED:          "ล็อคห้อง",
};

export const STATUS_ICON: Record<UnitOperationalStatus, string> = {
  OWNER_OCCUPIED:  "🏠",
  TENANT_OCCUPIED: "🔑",
  VACANT:          "⬜",
  RESERVED:        "📅",
  CHECKING_IN:     "🛬",
  CHECKED_IN:      "✅",
  CHECKING_OUT:    "🛫",
  MAINTENANCE:     "🔧",
  OUT_OF_SERVICE:  "🚫",
  STAFF:           "👷",
  MJC:             "🏢",
  LOCKED:          "🔒",
};

// HSL-tuned color tokens for status badges and dashboard cards
export const STATUS_COLOR: Record<
  UnitOperationalStatus,
  { badge: string; card: string; cardBorder: string; dot: string }
> = {
  OWNER_OCCUPIED:  {
    badge:       "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    card:        "bg-blue-50 dark:bg-blue-950/20",
    cardBorder:  "border-blue-200 dark:border-blue-800",
    dot:         "bg-blue-500",
  },
  TENANT_OCCUPIED: {
    badge:       "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    card:        "bg-indigo-50 dark:bg-indigo-950/20",
    cardBorder:  "border-indigo-200 dark:border-indigo-800",
    dot:         "bg-indigo-500",
  },
  VACANT:          {
    badge:       "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-400",
    card:        "bg-slate-50 dark:bg-slate-800/30",
    cardBorder:  "border-slate-200 dark:border-slate-700",
    dot:         "bg-slate-400",
  },
  RESERVED:        {
    badge:       "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    card:        "bg-purple-50 dark:bg-purple-950/20",
    cardBorder:  "border-purple-200 dark:border-purple-800",
    dot:         "bg-purple-500",
  },
  CHECKING_IN:     {
    badge:       "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    card:        "bg-cyan-50 dark:bg-cyan-950/20",
    cardBorder:  "border-cyan-200 dark:border-cyan-800",
    dot:         "bg-cyan-500",
  },
  CHECKED_IN:      {
    badge:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    card:        "bg-green-50 dark:bg-green-950/20",
    cardBorder:  "border-green-200 dark:border-green-800",
    dot:         "bg-green-500",
  },
  CHECKING_OUT:    {
    badge:       "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    card:        "bg-teal-50 dark:bg-teal-950/20",
    cardBorder:  "border-teal-200 dark:border-teal-800",
    dot:         "bg-teal-500",
  },
  MAINTENANCE:     {
    badge:       "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    card:        "bg-amber-50 dark:bg-amber-950/20",
    cardBorder:  "border-amber-200 dark:border-amber-800",
    dot:         "bg-amber-500",
  },
  OUT_OF_SERVICE:  {
    badge:       "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    card:        "bg-red-50 dark:bg-red-950/20",
    cardBorder:  "border-red-200 dark:border-red-800",
    dot:         "bg-red-600",
  },
  STAFF:           {
    badge:       "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    card:        "bg-sky-50 dark:bg-sky-950/20",
    cardBorder:  "border-sky-200 dark:border-sky-800",
    dot:         "bg-sky-500",
  },
  MJC:             {
    badge:       "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    card:        "bg-orange-50 dark:bg-orange-950/20",
    cardBorder:  "border-orange-200 dark:border-orange-800",
    dot:         "bg-orange-500",
  },
  LOCKED:          {
    badge:       "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    card:        "bg-rose-50 dark:bg-rose-950/20",
    cardBorder:  "border-rose-200 dark:border-rose-800",
    dot:         "bg-rose-600",
  },
};

// Roles permitted to change operational_status
export const STATUS_CHANGE_ALLOWED_ROLES = [
  "super_admin",
  "admin",
  "property_admin",
] as const;

export type StatusChangeAllowedRole = (typeof STATUS_CHANGE_ALLOWED_ROLES)[number];
