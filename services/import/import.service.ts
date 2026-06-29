import { parseFile } from "@/features/import/utils/excelParser";
import {
  CanonicalField,
  CANONICAL_FIELDS,
  ColumnMapping,
  ValidationError,
  ValidationResult,
  RowValidationResult,
  ImportValidationSummary
} from "@/features/import/types/import.types";

const AUTO_MAPPING_RULES: Record<CanonicalField, string[]> = {
  property_code: ["code", "propcode", "propertycode"],
  building_code: ["building", "bldg", "buildingcode"],
  floor: ["floor", "level"],
  unit_number: ["roomno", "room", "unit", "unitno", "unitnumber"],
  area: ["area", "size", "sqm", "sq_m"],
  ownership_ratio: ["ratio", "ownershipratio", "ownership", "share"],
  owner_name: ["ownername", "owner", "name", "customername"],
  phone: ["phone", "tel", "telephone", "mobile"],
  email: ["email", "mail"],
  status: ["status", "active"],
};

const ALLOWED_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "VACANT",
  "OWNER_OCCUPIED",
  "TENANT_OCCUPIED"
];

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]+/g, "");
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const importService = {
  async readFile(file: File) {
    return parseFile(file);
  },

  async preview(file: File) {
    const parsed = await parseFile(file);
    return {
      headers: parsed.headers,
      rows: parsed.rows.slice(0, 20),
    };
  },

  autoMap(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};

    headers.forEach((header) => {
      const normalized = header.toLowerCase().replace(/[\s_]+/g, "");

      let matchedField: CanonicalField | "" = "";

      for (const field of CANONICAL_FIELDS) {
        if (field.replace(/_/g, "") === normalized) {
          matchedField = field;
          break;
        }
      }

      if (!matchedField) {
        for (const [field, rules] of Object.entries(AUTO_MAPPING_RULES) as [CanonicalField, string[]][]) {
          if (rules.includes(normalized)) {
            matchedField = field;
            break;
          }
        }
      }

      mapping[header] = matchedField;
    });

    return mapping;
  },

  getStorageKey(headers: string[]): string {
    return `import-mapping:${headers.join(",")}`;
  },

  saveMapping(headers: string[], mapping: ColumnMapping): void {
    if (typeof window !== "undefined") {
      const key = this.getStorageKey(headers);
      localStorage.setItem(key, JSON.stringify(mapping));
    }
  },

  loadMapping(headers: string[]): ColumnMapping | null {
    if (typeof window !== "undefined") {
      const key = this.getStorageKey(headers);
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  },

  validateData(rows: Record<string, unknown>[], mapping: ColumnMapping): ValidationResult {
    const results: RowValidationResult[] = [];
    const allErrors: ValidationError[] = [];

    const reverseMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([header, field]) => {
      if (field) {
        reverseMapping[field] = header;
      }
    });

    const unitNumberTracker: Record<string, number[]> = {};

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors: ValidationError[] = [];
      const normalizedData: Record<string, unknown> = {};

      Object.entries(mapping).forEach(([header, field]) => {
        if (!field) return;

        const rawValue = row[header];
        let val = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : "";

        val = val.replace(/\s+/g, " ");

        if (field === "unit_number") {
          val = val.toUpperCase();
          if (val) {
            if (!unitNumberTracker[val]) {
              unitNumberTracker[val] = [];
            }
            unitNumberTracker[val].push(rowNumber);
          }
        } else if (field === "email") {
          val = val.toLowerCase();
        } else if (field === "phone") {
          val = normalizePhone(val);
        } else if (field === "status") {
          val = val.toUpperCase().replace(/\s+/g, "_");
        }

        normalizedData[field] = val || null;
      });

      const requiredFields: CanonicalField[] = ["unit_number", "floor", "status"];
      requiredFields.forEach((field) => {
        const headerName = reverseMapping[field] || field;
        const val = normalizedData[field];
        if (val === null || val === undefined || String(val).trim() === "") {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Required field '${field}' is missing`,
            severity: "error",
          });
        }
      });

      if (normalizedData.email) {
        const val = String(normalizedData.email);
        const headerName = reverseMapping.email || "email";
        if (!isValidEmail(val)) {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Invalid email format: '${val}'`,
            severity: "error",
          });
        }
      }

      if (normalizedData.phone) {
        const val = String(normalizedData.phone);
        const headerName = reverseMapping.phone || "phone";
        const digitsOnly = val.replace(/\D/g, "");
        if (digitsOnly.length < 8) {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Phone number is too short (min 8 digits): '${val}'`,
            severity: "warning",
          });
        }
      }

      if (normalizedData.area) {
        const val = String(normalizedData.area);
        const headerName = reverseMapping.area || "area";
        const num = Number(val);
        if (isNaN(num) || num <= 0) {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Area must be a positive number: '${val}'`,
            severity: "error",
          });
        }
      }

      if (normalizedData.ownership_ratio) {
        const val = String(normalizedData.ownership_ratio);
        const headerName = reverseMapping.ownership_ratio || "ownership_ratio";
        const num = Number(val);
        if (isNaN(num) || num < 0) {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Ownership ratio must be a non-negative number: '${val}'`,
            severity: "error",
          });
        }
      }

      if (normalizedData.status) {
        const val = String(normalizedData.status);
        const headerName = reverseMapping.status || "status";
        if (!ALLOWED_STATUSES.includes(val)) {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}. Received: '${val}'`,
            severity: "error",
          });
        }
      }

      results.push({
        rowNumber,
        normalizedData,
        errors,
      });

      allErrors.push(...errors);
    });

    Object.entries(unitNumberTracker).forEach(([unitNum, rowsWithUnit]) => {
      if (rowsWithUnit.length > 1) {
        rowsWithUnit.forEach((rowNum) => {
          const headerName = reverseMapping.unit_number || "unit_number";
          const dupError: ValidationError = {
            rowNumber: rowNum,
            column: headerName,
            message: `Duplicate unit number '${unitNum}' detected in rows: ${rowsWithUnit.join(", ")}`,
            severity: "error",
          };

          const rowRes = results.find((r) => r.rowNumber === rowNum);
          if (rowRes) {
            rowRes.errors.push(dupError);
          }
          allErrors.push(dupError);
        });
      }
    });

    allErrors.sort((a, b) => a.rowNumber - b.rowNumber);

    let validRows = 0;
    let warningRows = 0;
    let errorRows = 0;

    results.forEach((r) => {
      const hasErrors = r.errors.some((e) => e.severity === "error");
      const hasWarnings = r.errors.some((e) => e.severity === "warning");

      if (hasErrors) {
        errorRows++;
      } else if (hasWarnings) {
        warningRows++;
      } else {
        validRows++;
      }
    });

    const summary: ImportValidationSummary = {
      totalRows: rows.length,
      validRows,
      warningRows,
      errorRows,
      importReady: errorRows === 0 && rows.length > 0,
    };

    return {
      summary,
      results,
      allErrors,
    };
  }
};
