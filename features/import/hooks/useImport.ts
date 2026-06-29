"use client";

import { useState } from "react";
import { ImportFile, PreviewResult, ColumnMapping, CanonicalField, ValidationResult } from "../types/import.types";
import { importService } from "@/services/import/import.service";

export function useImport() {
  const [file, setFile] = useState<ImportFile | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [fullParsedData, setFullParsedData] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleFileSelect = async (rawFile: File) => {
    setLoading(true);
    setError(null);
    setValidationResult(null);
    try {
      const importFile: ImportFile = {
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || rawFile.name.split(".").pop() || "",
        rawFile,
      };
      setFile(importFile);

      const parsedPreview = await importService.preview(rawFile);
      setPreviewData(parsedPreview);

      const parsedFull = await importService.readFile(rawFile);
      setFullParsedData(parsedFull);

      const savedMapping = importService.loadMapping(parsedPreview.headers);
      if (savedMapping) {
        setMapping(savedMapping);
      } else {
        const autoMapping = importService.autoMap(parsedPreview.headers);
        setMapping(autoMapping);
      }
    } catch (err) {
      console.error("Error parsing file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setFile(null);
      setPreviewData(null);
      setFullParsedData(null);
      setMapping({});
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (header: string, field: CanonicalField | "") => {
    setMapping((prev) => {
      const updated = { ...prev, [header]: field };
      if (previewData) {
        importService.saveMapping(previewData.headers, updated);
      }
      setValidationResult(null);
      return updated;
    });
  };

  const triggerAutoMapping = () => {
    if (previewData) {
      const autoMapping = importService.autoMap(previewData.headers);
      setMapping(autoMapping);
      importService.saveMapping(previewData.headers, autoMapping);
      setValidationResult(null);
    }
  };

  const runValidation = () => {
    if (!fullParsedData) return;
    setIsValidating(true);
    setError(null);
    try {
      const result = importService.validateData(fullParsedData.rows, mapping);
      setValidationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const clear = () => {
    setFile(null);
    setPreviewData(null);
    setFullParsedData(null);
    setMapping({});
    setValidationResult(null);
    setError(null);
  };

  return {
    file,
    previewData,
    mapping,
    loading,
    error,
    isValidating,
    validationResult,
    handleFileSelect,
    updateMapping,
    triggerAutoMapping,
    runValidation,
    clear,
  };
}
