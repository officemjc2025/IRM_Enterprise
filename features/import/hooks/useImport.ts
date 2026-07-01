"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImportFile, ColumnMapping, ValidationResult } from "../types/import.types";
import { FileValidationResult, validateFileStructure } from "../utils/excelValidator";
import { parseFile } from "../utils/excelParser";
import { importService } from "@/services/import/import.service";
import { getSchema } from "../schemas";
import { createClient } from "@/lib/supabase/client";

// Configurable Max File Size (10MB by default)
export const MAX_FILE_SIZE_MB = 10;

export interface ImportResultSummary {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  total?: number;
  elapsedTime: string;
}

export interface ImportResponse {
  success: boolean;
  message: string;
  summary?: ImportResultSummary;
}

export function useImport() {
  const [selectedModule, setSelectedModule] = useState<string>("unit");
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [file, setFile] = useState<ImportFile | null>(null);
  const [step, setStep] = useState<number>(1); // 1: Upload, 2: Validate, 3: Preview, 4: Ready (Summary)
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [rowValidation, setRowValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const router = useRouter();

  // Fetch properties on mount using supabase client
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("properties")
          .select("id, property_code, property_name_th, property_name_en")
          .is("deleted_at", null);
        if (data) {
          setProperties(data);
          if (data.length > 0) {
            setSelectedPropertyId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load properties for import engine:", err);
      }
    };
    fetchProperties();
  }, []);

  const handleModuleChange = (moduleName: string) => {
    setSelectedModule(moduleName);
    setFile(null);
    setStep(1);
    setValidationResult(null);
    setParsedData(null);
    setColumnMapping({});
    setRowValidation(null);
    setImportResult(null);
    setError(null);
  };

  const handleFileSelect = (rawFile: File) => {
    // Selection is required before Import / File Select
    if (selectedModule === "unit" && !selectedPropertyId) {
      setError("propertyRequired");
      return;
    }

    setError(null);
    setValidationResult(null);
    setParsedData(null);
    setRowValidation(null);
    setImportResult(null);

    const name = rawFile.name;
    const extension = name.split(".").pop()?.toLowerCase();

    // 1. Supported extension validation
    if (extension !== "xlsx" && extension !== "xls" && extension !== "csv") {
      setError("invalidFileType");
      setFile(null);
      return;
    }

    // 2. Configurable Max file size validation
    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (rawFile.size > maxSizeBytes) {
      setError("fileTooLarge");
      setFile(null);
      return;
    }

    const importFile: ImportFile = {
      name,
      size: rawFile.size,
      type: rawFile.type || extension,
      rawFile,
    };

    setFile(importFile);
    setStep(1);
  };

  const runFileValidation = async () => {
    if (!file?.rawFile) {
      setError("fileRequired");
      return;
    }
    if (selectedModule === "unit" && !selectedPropertyId) {
      setError("propertyRequired");
      return;
    }

    setIsValidating(true);
    setError(null);
    try {
      const schema = getSchema(selectedModule);
      const result = await validateFileStructure(file.rawFile, schema);
      setValidationResult(result);

      if (result.isValid) {
        // Parse data for step 3 Preview
        const parsed = await parseFile(file.rawFile, schema.worksheetName);
        setParsedData(parsed);

        // Auto map columns based on schema
        const mapping = importService.autoMap(parsed.headers, schema);
        setColumnMapping(mapping);

        // Perform row-by-row validation of data based on schema and selected property
        const validated = await importService.validateData(
          parsed.rows,
          mapping,
          schema,
          selectedModule === "unit" ? selectedPropertyId : undefined
        );
        setRowValidation(validated);
      }
      
      setStep(2); // Go to step 2: Validate
    } catch (err) {
      console.error("Validation failed:", err);
      setError("validationErrorMsg");
    } finally {
      setIsValidating(false);
    }
  };

  const updateMappingAndRevalidate = async (newMapping: ColumnMapping) => {
    setColumnMapping(newMapping);
    if (parsedData) {
      const schema = getSchema(selectedModule);
      const validated = await importService.validateData(
        parsedData.rows,
        newMapping,
        schema,
        selectedModule === "unit" ? selectedPropertyId : undefined
      );
      setRowValidation(validated);
    }
  };

  const commitImport = async () => {
    if (!rowValidation || !rowValidation.summary.importReady) {
      setError("validationRequired");
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      // 1. Preparing
      setImportProgress("Preparing...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 2. Validating
      setImportProgress("Validating...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 3. Saving
      setImportProgress("Saving...");
      const payload = rowValidation.results.map((r) => r.normalizedData);
      const res = await importService.commit(payload, selectedModule);

      // 4. Finishing
      setImportProgress("Finishing...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      setImportResult(res);
      if (res.success) {
        // Refresh /api/v1/units and current router to ensure new data is retrieved immediately
        try {
          await fetch("/api/v1/units", { cache: "no-store" });
        } catch (fetchErr) {
          console.error("Failed to refresh units cache:", fetchErr);
        }
        router.refresh();

        // Navigate automatically to /units after a short duration
        setTimeout(() => {
          router.push("/units");
        }, 4000);
      } else {
        setError(res.message || "Import failed. No data has been saved.");
      }
    } catch (err: any) {
      console.error("Import execution failed:", err);
      setError(err.message || "Import failed. No data has been saved.");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const clear = () => {
    setFile(null);
    setStep(1);
    setValidationResult(null);
    setParsedData(null);
    setColumnMapping({});
    setRowValidation(null);
    setImportResult(null);
    setImportProgress(null);
    setError(null);
  };

  return {
    selectedModule,
    handleModuleChange,
    properties,
    selectedPropertyId,
    setSelectedPropertyId,
    file,
    step,
    setStep,
    error,
    setError,
    isValidating,
    isImporting,
    validationResult,
    parsedData,
    columnMapping,
    rowValidation,
    importResult,
    importProgress,
    handleFileSelect,
    runFileValidation,
    updateMappingAndRevalidate,
    commitImport,
    clear,
  };
}
export default useImport;
