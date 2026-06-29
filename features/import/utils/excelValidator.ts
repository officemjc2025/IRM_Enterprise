import * as XLSX from "xlsx";
import { importService } from "@/services/import/import.service";
import { CanonicalField } from "../types/import.types";

export interface ValidationCheckResult {
  status: "success" | "warning" | "error";
  message: string;
  details?: string[];
}

export interface FileValidationResult {
  isValid: boolean;
  overallStatus: "success" | "warning" | "error";
  checks: {
    fileOpen: ValidationCheckResult;
    sheetExists: ValidationCheckResult;
    columnsExist: ValidationCheckResult;
  };
  sheetNames: string[];
  headers: string[];
}

const REQUIRED_FIELDS: CanonicalField[] = ["unit_number", "floor", "status"];
const OPTIONAL_FIELDS: CanonicalField[] = [
  "property_code",
  "building_code",
  "area",
  "ownership_ratio",
  "owner_name",
  "phone",
  "email",
];

export async function validateFileStructure(file: File): Promise<FileValidationResult> {
  const result: FileValidationResult = {
    isValid: false,
    overallStatus: "error",
    checks: {
      fileOpen: { status: "error", message: "Pending check" },
      sheetExists: { status: "error", message: "Pending check" },
      columnsExist: { status: "error", message: "Pending check" },
    },
    sheetNames: [],
    headers: [],
  };

  let workbook: XLSX.WorkBook;

  // 1. Check if file can be opened
  try {
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result instanceof ArrayBuffer) {
          resolve(e.target.result);
        } else {
          reject(new Error("Failed to read file as ArrayBuffer"));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });

    workbook = XLSX.read(data, { type: "array" });
    result.sheetNames = workbook.SheetNames;
    result.checks.fileOpen = {
      status: "success",
      message: "File opened and read successfully",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid Excel file structure";
    result.checks.fileOpen = {
      status: "error",
      message: "Failed to open or parse Excel file",
      details: [msg],
    };
    result.checks.sheetExists = { status: "error", message: "Check skipped due to open file error" };
    result.checks.columnsExist = { status: "error", message: "Check skipped due to open file error" };
    return result;
  }

  // 2. Check if required worksheet "Units" exists (case-insensitive)
  const targetSheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase() === "units"
  );

  if (!targetSheetName) {
    result.checks.sheetExists = {
      status: "error",
      message: "Required worksheet 'Units' is missing",
      details: [`Available worksheets: ${workbook.SheetNames.join(", ") || "none"}`],
    };
    result.checks.columnsExist = { status: "error", message: "Check skipped due to missing worksheet" };
    return result;
  }

  result.checks.sheetExists = {
    status: "success",
    message: `Required worksheet 'Units' found (matches as '${targetSheetName}')`,
  };

  // 3. Check if required columns exist in the worksheet
  try {
    const worksheet = workbook.Sheets[targetSheetName];
    const sheetArrays = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
    });

    const rawHeaders = (sheetArrays[0] || []).map((h) => String(h).trim()).filter((h) => h !== "");
    result.headers = rawHeaders;

    if (rawHeaders.length === 0) {
      result.checks.columnsExist = {
        status: "error",
        message: "No column headers found in 'Units' sheet",
      };
      return result;
    }

    const mapping = importService.autoMap(rawHeaders);
    const mappedFields = Object.values(mapping).filter((f): f is CanonicalField => f !== "");

    const missingRequired: string[] = [];
    REQUIRED_FIELDS.forEach((field) => {
      if (!mappedFields.includes(field)) {
        missingRequired.push(field);
      }
    });

    const missingOptional: string[] = [];
    OPTIONAL_FIELDS.forEach((field) => {
      if (!mappedFields.includes(field)) {
        missingOptional.push(field);
      }
    });

    if (missingRequired.length > 0) {
      result.checks.columnsExist = {
        status: "error",
        message: "Required columns are missing",
        details: missingRequired.map((f) => `Missing required column for field: '${f}'`),
      };
    } else if (missingOptional.length > 0) {
      result.checks.columnsExist = {
        status: "warning",
        message: "Some optional columns are missing, but file is importable",
        details: missingOptional.map((f) => `Optional column for field '${f}' is missing`),
      };
      result.isValid = true;
      result.overallStatus = "warning";
    } else {
      result.checks.columnsExist = {
        status: "success",
        message: "All required and optional columns are present",
      };
      result.isValid = true;
      result.overallStatus = "success";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error reading sheet columns";
    result.checks.columnsExist = {
      status: "error",
      message: "Failed to parse worksheet columns",
      details: [msg],
    };
  }

  return result;
}
