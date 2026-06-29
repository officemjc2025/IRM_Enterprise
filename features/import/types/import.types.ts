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
  | "building_code"
  | "floor"
  | "unit_number"
  | "area"
  | "ownership_ratio"
  | "owner_name"
  | "phone"
  | "email"
  | "status";

export const CANONICAL_FIELDS: CanonicalField[] = [
  "property_code",
  "building_code",
  "floor",
  "unit_number",
  "area",
  "ownership_ratio",
  "owner_name",
  "phone",
  "email",
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
