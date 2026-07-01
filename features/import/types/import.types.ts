export interface ImportFile {
  name: string;
  size: number;
  type: string;
  rawFile: File;
}

export interface ImportRow {
  [key: string]: unknown;
}

export interface PreviewResult {
  headers: string[];
  rows: Record<string, unknown>[];
}

export type CanonicalField =
  | "property_code"
  | "property_name"
  | "building_code"
  | "floor"
  | "unit_number"
  | "area"
  | "ownership_ratio"
  | "remark"
  | "full_name"
  | "display_name"
  | "phone"
  | "email"
  | "passport_no"
  | "national_id"
  | "owner_code"
  | "owner_name"
  | "owner_type"
  | "person_code"
  | "person_type"
  | "occupancy_type"
  | "move_in_date"
  | "move_out_date"
  | "primary_resident"
  | "status";

export const CANONICAL_FIELDS: CanonicalField[] = [
  "property_code",
  "property_name",
  "building_code",
  "floor",
  "unit_number",
  "area",
  "ownership_ratio",
  "remark",
  "full_name",
  "display_name",
  "phone",
  "email",
  "passport_no",
  "national_id",
  "owner_code",
  "owner_name",
  "owner_type",
  "person_code",
  "person_type",
  "occupancy_type",
  "move_in_date",
  "move_out_date",
  "primary_resident",
  "status",
];

export type ColumnMapping = Record<string, CanonicalField | "">;

export interface ValidationError {
  rowNumber: number;
  column: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  importReady: boolean;
}

export interface RowValidationResult {
  rowNumber: number;
  normalizedData: Record<string, unknown>;
  errors: ValidationError[];
}

export interface ValidationResult {
  summary: ImportValidationSummary;
  results: RowValidationResult[];
  allErrors: ValidationError[];
}

export interface ImportSchema {
  moduleName: string;
  worksheetName: string;
  requiredFields: CanonicalField[];
  optionalFields: CanonicalField[];
  defaultMappings: Partial<Record<CanonicalField, string[]>>;
  validationRules?: Partial<Record<CanonicalField, (val: string) => string | null>>;
}
