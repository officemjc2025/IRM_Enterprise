import { parseFile } from "@/features/import/utils/excelParser";
import { createClient } from "@/lib/supabase/client";
import {
  CanonicalField,
  ColumnMapping,
  ValidationError,
  ValidationResult,
  RowValidationResult,
  ImportValidationSummary,
  ImportSchema
} from "@/features/import/types/import.types";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]+/g, "");
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

  autoMap(headers: string[], schema: ImportSchema): ColumnMapping {
    const mapping: ColumnMapping = {};
    const canonicalFields = [...schema.requiredFields, ...schema.optionalFields];

    headers.forEach((header) => {
      const normalized = header.toLowerCase().replace(/[\s_]+/g, "");
      let matchedField: CanonicalField | "" = "";

      // 1. Direct match with field name
      for (const field of canonicalFields) {
        if (field.replace(/_/g, "") === normalized) {
          matchedField = field;
          break;
        }
      }

      // 2. Rule mapping match
      if (!matchedField) {
        for (const [field, rules] of Object.entries(schema.defaultMappings) as [CanonicalField, string[]][]) {
          if (canonicalFields.includes(field) && rules.includes(normalized)) {
            matchedField = field;
            break;
          }
        }
      }

      mapping[header] = matchedField;
    });

    return mapping;
  },

  getStorageKey(headers: string[], moduleName: string): string {
    return `import-mapping:${moduleName}:${headers.join(",")}`;
  },

  saveMapping(headers: string[], mapping: ColumnMapping, moduleName: string): void {
    if (typeof window !== "undefined") {
      const key = this.getStorageKey(headers, moduleName);
      localStorage.setItem(key, JSON.stringify(mapping));
    }
  },

  loadMapping(headers: string[], moduleName: string): ColumnMapping | null {
    if (typeof window !== "undefined") {
      const key = this.getStorageKey(headers, moduleName);
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

  async validateData(
    rows: Record<string, unknown>[],
    mapping: ColumnMapping,
    schema: ImportSchema,
    selectedPropertyId?: string
  ): Promise<ValidationResult> {
    const results: RowValidationResult[] = [];
    const allErrors: ValidationError[] = [];

    const reverseMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([header, field]) => {
      if (field) {
        reverseMapping[field] = header;
      }
    });

    // Fetch active properties from database ONLY if selectedPropertyId is not provided
    const isPropertyCodeMapped = !selectedPropertyId && Object.values(mapping).includes("property_code");
    const propertyCodeMap = new Map<string, string>(); // property_code (uppercase) -> id

    if (isPropertyCodeMapped) {
      const supabase = createClient();
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id, property_code")
        .is("deleted_at", null);

      if (propertiesData) {
        propertiesData.forEach((p) => {
          if (p.property_code) {
            propertyCodeMap.set(p.property_code.trim().toUpperCase(), p.id);
          }
        });
      }
    }

    const isUnitNumberMapped = Object.values(mapping).includes("unit_number");

    // Query existing units in DB to check for database duplicate unit number
    const dbUnitsMap = new Map<string, string>(); // "property_id:unit_number" -> id
    if (isUnitNumberMapped) {
      const supabase = createClient();
      const { data: dbUnits } = await supabase
        .from("unit")
        .select("id, property_id, unit_number")
        .is("deleted_at", null);

      if (dbUnits) {
        dbUnits.forEach((u) => {
          if (u.property_id && u.unit_number) {
            dbUnitsMap.set(`${u.property_id}:${u.unit_number.trim().toUpperCase()}`, u.id);
          }
        });
      }
    }

    const isPersonCodeMapped = Object.values(mapping).includes("person_code");

    // Query existing persons in DB to check for database duplicate person code
    const dbPersonsMap = new Map<string, string>(); // person_code -> id
    if (isPersonCodeMapped) {
      const supabase = createClient();
      const { data: dbPersons } = await supabase
        .from("person")
        .select("id, person_code")
        .is("deleted_at", null);

      if (dbPersons) {
        dbPersons.forEach((p) => {
          if (p.person_code) {
            dbPersonsMap.set(p.person_code.trim().toUpperCase(), p.id);
          }
        });
      }
    }

    const isOwnerCodeMapped = Object.values(mapping).includes("owner_code");

    // Query existing owners in DB to check for database duplicate owner code
    const dbOwnersMap = new Map<string, string>(); // owner_code -> id
    if (isOwnerCodeMapped) {
      const supabase = createClient();
      const { data: dbOwners } = await supabase
        .from("owner")
        .select("id, owner_code")
        .is("deleted_at", null);

      if (dbOwners) {
        dbOwners.forEach((o) => {
          if (o.owner_code) {
            dbOwnersMap.set(o.owner_code.trim().toUpperCase(), o.id);
          }
        });
      }
    }

    const isOccupancyModule = schema.moduleName === "occupancy";

    // Query active occupancies in DB to check for duplicate active occupancy
    const dbActiveOccupancies = new Set<string>(); // "unit_id:person_id"
    if (isOccupancyModule) {
      const supabase = createClient();
      const { data: activeOccData } = await supabase
        .from("occupancy")
        .select("unit_id, person_id")
        .eq("status", "ACTIVE")
        .is("deleted_at", null);

      if (activeOccData) {
        activeOccData.forEach((o) => {
          dbActiveOccupancies.add(`${o.unit_id}:${o.person_id}`);
        });
      }
    }

    const unitNumberTracker: Record<string, number[]> = {};
    const personCodeTracker: Record<string, number[]> = {};
    const ownerCodeTracker: Record<string, number[]> = {};
    const excelActiveOccupancies = new Set<string>(); // "unit_id:person_id" inside Excel

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
          if (val && isUnitNumberMapped) {
            if (!unitNumberTracker[val]) {
              unitNumberTracker[val] = [];
            }
            unitNumberTracker[val].push(rowNumber);
          }
        } else if (field === "person_code") {
          val = val.toUpperCase();
          if (val && isPersonCodeMapped) {
            if (!personCodeTracker[val]) {
              personCodeTracker[val] = [];
            }
            personCodeTracker[val].push(rowNumber);
          }
        } else if (field === "owner_code") {
          val = val.toUpperCase();
          if (val && isOwnerCodeMapped) {
            if (!ownerCodeTracker[val]) {
              ownerCodeTracker[val] = [];
            }
            ownerCodeTracker[val].push(rowNumber);
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

      // Inject selected property_id directly if provided
      if (selectedPropertyId) {
        normalizedData.property_id = selectedPropertyId;
      }

      // 1. Required fields check
      schema.requiredFields.forEach((field) => {
        // Skip checking property_code if selectedPropertyId is provided
        if (field === "property_code" && selectedPropertyId) return;

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

      // 2. Custom validation rules from schema
      if (schema.validationRules) {
        Object.entries(mapping).forEach(([header, field]) => {
          if (!field) return;
          // Skip validating property_code if selectedPropertyId is provided
          if (field === "property_code" && selectedPropertyId) return;

          const val = String(normalizedData[field] || "");
          const rule = schema.validationRules?.[field];
          if (rule) {
            const ruleErr = rule(val);
            if (ruleErr) {
              const severity = (field === "phone") ? "warning" : "error";
              errors.push({
                rowNumber,
                column: header,
                message: ruleErr,
                severity,
              });
            }
          }
        });
      }

      // 3. Database existence check for property_code (only if mapped and not using selectedPropertyId)
      if (isPropertyCodeMapped && normalizedData.property_code) {
        const propCode = String(normalizedData.property_code).trim().toUpperCase();
        const headerName = reverseMapping.property_code || "property_code";
        const matchedId = propertyCodeMap.get(propCode);
        if (!matchedId) {
          errors.push({
            rowNumber,
            column: headerName,
            message: `Property code '${propCode}' does not exist in database`,
            severity: "error",
          });
        } else {
          normalizedData.property_id = matchedId;
        }
      }

      // 3b. Duplicate unit number in database check
      if (normalizedData.unit_number && normalizedData.property_id) {
        const propId = String(normalizedData.property_id);
        const unitNum = String(normalizedData.unit_number).toUpperCase();
        const key = `${propId}:${unitNum}`;
        if (dbUnitsMap.has(key)) {
          const headerName = reverseMapping.unit_number || "unit_number";
          errors.push({
            rowNumber,
            column: headerName,
            message: `Unit number '${unitNum}' already exists in database (will be updated)`,
            severity: "warning",
          });
        }
      }

      // 3c. Duplicate person code in database check
      if (isPersonCodeMapped && normalizedData.person_code) {
        const code = String(normalizedData.person_code).toUpperCase();
        if (dbPersonsMap.has(code)) {
          const headerName = reverseMapping.person_code || "person_code";
          errors.push({
            rowNumber,
            column: headerName,
            message: `Person code '${code}' already exists in database (will be updated)`,
            severity: "warning",
          });
        }
      }

      // 3d. Duplicate owner code in database check
      if (isOwnerCodeMapped && normalizedData.owner_code) {
        const code = String(normalizedData.owner_code).toUpperCase();
        if (dbOwnersMap.has(code)) {
          const headerName = reverseMapping.owner_code || "owner_code";
          errors.push({
            rowNumber,
            column: headerName,
            message: `Owner code '${code}' already exists in database (will be updated)`,
            severity: "warning",
          });
        }
      }

      // Occupancy Module specific relationship resolution and validations
      if (isOccupancyModule) {
        let matchedUnitId = "";
        let matchedPersonId = "";

        const unitNum = String(normalizedData.unit_number || "").toUpperCase().trim();
        const propId = String(normalizedData.property_id || selectedPropertyId || "");
        const unitKey = `${propId}:${unitNum}`;
        const unitHeaderName = reverseMapping.unit_number || "unit_number";

        if (!unitNum) {
          errors.push({
            rowNumber,
            column: unitHeaderName,
            message: "Unit number is required",
            severity: "error",
          });
        } else {
          const foundId = dbUnitsMap.get(unitKey);
          if (!foundId) {
            errors.push({
              rowNumber,
              column: unitHeaderName,
              message: `Unit '${unitNum}' not found in database for selected property`,
              severity: "error",
            });
          } else {
            matchedUnitId = foundId;
            normalizedData.unit_id = foundId;
          }
        }

        const personCode = String(normalizedData.person_code || "").toUpperCase().trim();
        const personHeaderName = reverseMapping.person_code || "person_code";

        if (!personCode) {
          errors.push({
            rowNumber,
            column: personHeaderName,
            message: "Person code is required",
            severity: "error",
          });
        } else {
          const foundId = dbPersonsMap.get(personCode);
          if (!foundId) {
            errors.push({
              rowNumber,
              column: personHeaderName,
              message: `Person code '${personCode}' not found in database`,
              severity: "error",
            });
          } else {
            matchedPersonId = foundId;
            normalizedData.person_id = foundId;
          }
        }

        // Date relationship validations
        if (normalizedData.move_in_date && normalizedData.move_out_date) {
          const inDate = Date.parse(String(normalizedData.move_in_date));
          const outDate = Date.parse(String(normalizedData.move_out_date));
          if (!isNaN(inDate) && !isNaN(outDate) && outDate < inDate) {
            errors.push({
              rowNumber,
              column: reverseMapping.move_out_date || "move_out_date",
              message: "Move-out date cannot be before move-in date",
              severity: "error",
            });
          }
        }

        // Duplicate active occupancy check (DB & Excel)
        if (matchedUnitId && matchedPersonId) {
          const statusVal = String(normalizedData.status || "ACTIVE").toUpperCase();
          if (statusVal === "ACTIVE") {
            const occKey = `${matchedUnitId}:${matchedPersonId}`;

            // Check database duplicate active occupancy
            if (dbActiveOccupancies.has(occKey)) {
              errors.push({
                rowNumber,
                column: unitHeaderName,
                message: `Duplicate active occupancy for unit '${unitNum}' and person '${personCode}' already exists in database (will be updated)`,
                severity: "warning", // The task states: "If an ACTIVE occupancy already exists... UPDATE. Otherwise... INSERT." So it will be updated in the DB, meaning a warning is more correct than a blocking error since the Commit Engine can merge/upsert it!
              });
            }

            // Check Excel duplicate active occupancy
            if (excelActiveOccupancies.has(occKey)) {
              errors.push({
                rowNumber,
                column: unitHeaderName,
                message: `Duplicate active occupancy for unit '${unitNum}' and person '${personCode}' detected in rows within the Excel sheet`,
                severity: "error", // Multiple active occupancies for same person & unit in same Excel sheet is an error.
              });
            } else {
              excelActiveOccupancies.add(occKey);
            }
          }
        }
      }

      results.push({
        rowNumber,
        normalizedData,
        errors,
      });

      allErrors.push(...errors);
    });

    // 4. Duplicate unit number check (if mapped)
    if (isUnitNumberMapped) {
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
    }

    // 4b. Duplicate person code check (if mapped)
    if (isPersonCodeMapped) {
      Object.entries(personCodeTracker).forEach(([code, rowsWithCode]) => {
        if (rowsWithCode.length > 1) {
          rowsWithCode.forEach((rowNum) => {
            const headerName = reverseMapping.person_code || "person_code";
            const dupError: ValidationError = {
              rowNumber: rowNum,
              column: headerName,
              message: `Duplicate person code '${code}' detected in rows: ${rowsWithCode.join(", ")}`,
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
    }

    // 4c. Duplicate owner code check (if mapped)
    if (isOwnerCodeMapped) {
      Object.entries(ownerCodeTracker).forEach(([code, rowsWithCode]) => {
        if (rowsWithCode.length > 1) {
          rowsWithCode.forEach((rowNum) => {
            const headerName = reverseMapping.owner_code || "owner_code";
            const dupError: ValidationError = {
              rowNumber: rowNum,
              column: headerName,
              message: `Duplicate owner code '${code}' detected in rows: ${rowsWithCode.join(", ")}`,
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
    }

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
  },

  async commit(payload: Record<string, unknown>[], moduleName: string) {
    const res = await fetch("/api/v1/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload, moduleName }),
    });
    return res.json();
  }
};
