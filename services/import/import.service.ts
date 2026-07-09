import { parseFile } from "@/features/import/utils/excelParser";
import {
  CanonicalField,
  ColumnMapping,
  ValidationResult,
  ImportSchema
} from "@/features/import/types/import.types";

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
    const res = await fetch("/api/v1/import/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows,
        mapping,
        moduleName: schema.moduleName,
        propertyId: selectedPropertyId
      }),
    });
    return res.json();
  },

  async commit(payload: Record<string, unknown>[], moduleName: string, importStrategy?: string, duplicateResolution?: string) {
    const res = await fetch("/api/v1/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload, moduleName, importStrategy, duplicateResolution }),
    });
    return res.json();
  }
};
