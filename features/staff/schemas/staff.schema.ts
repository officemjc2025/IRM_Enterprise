import { z } from "zod";

const departments = ["Administration", "Office", "Engineering", "Housekeeping", "Security", "Committee"] as const;

export const createStaffSchema = z.object({
  employee_code: z.string().max(30).optional().nullable().or(z.literal("")),
  prefix: z.string().optional().nullable().or(z.literal("")),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  nickname: z.string().optional().nullable().or(z.literal("")),
  display_name: z.string().optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone number must be at least 8 characters").optional().nullable().or(z.literal("")),
  role: z.enum(["super_admin", "admin", "property_admin", "office", "security", "technician", "housekeeping", "committee"]),
  department: z.string().refine(val => !val || departments.includes(val as typeof departments[number]), {
    message: "Department must be one of: Administration, Office, Engineering, Housekeeping, Security, Committee"
  }).optional().nullable().or(z.literal("")),
  team: z.string().optional().nullable().or(z.literal("")),
  property_id: z.string().uuid("Invalid property UUID").optional().nullable().or(z.literal("")),
  language: z.enum(["th", "en"]).optional().default("th"),
  photo_url: z.string().url("Invalid photo URL").optional().nullable().or(z.literal("")),
  send_invitation: z.boolean().optional().default(true),
});

export const updateStaffSchema = z.object({
  employee_code: z.string().max(30).optional().nullable().or(z.literal("")),
  prefix: z.string().optional().nullable().or(z.literal("")),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  nickname: z.string().optional().nullable().or(z.literal("")),
  display_name: z.string().optional().nullable().or(z.literal("")),
  phone: z.string().min(8).optional().nullable().or(z.literal("")),
  role: z.enum(["super_admin", "admin", "property_admin", "office", "security", "technician", "housekeeping", "committee"]).optional(),
  department: z.string().refine(val => !val || departments.includes(val as typeof departments[number]), {
    message: "Department must be one of: Administration, Office, Engineering, Housekeeping, Security, Committee"
  }).optional().nullable().or(z.literal("")),
  team: z.string().optional().nullable().or(z.literal("")),
  property_id: z.string().uuid().optional().nullable().or(z.literal("")),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  account_status: z.enum(["PENDING", "ACTIVE", "LOCKED", "DISABLED"]).optional(),
  language: z.enum(["th", "en"]).optional(),
  photo_url: z.string().url().optional().nullable().or(z.literal("")),
});
