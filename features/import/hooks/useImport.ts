"use client";

import { useState } from "react";
import { ImportFile } from "../types/import.types";
import { FileValidationResult, validateFileStructure } from "../utils/excelValidator";

export function useImport() {
  const [file, setFile] = useState<ImportFile | null>(null);
  const [step, setStep] = useState<number>(1); // Step 1: Upload, Step 2: Validate
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<FileValidationResult | null>(null);

  const handleFileSelect = (rawFile: File) => {
    setError(null);
    setValidationResult(null);

    const name = rawFile.name;
    const extension = name.split(".").pop()?.toLowerCase();

    if (extension !== "xlsx" && extension !== "xls") {
      setError("invalidFileType");
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
    setStep(1); // Stay on step 1 when new file selected
  };

  const runFileValidation = async () => {
    if (!file?.rawFile) return;

    setIsValidating(true);
    setError(null);
    try {
      const result = await validateFileStructure(file.rawFile);
      setValidationResult(result);
      setStep(2); // Go to validation step to show results
    } catch (err) {
      console.error("Validation failed:", err);
      setError("validationErrorMsg");
    } finally {
      setIsValidating(false);
    }
  };

  const clear = () => {
    setFile(null);
    setStep(1);
    setValidationResult(null);
    setError(null);
  };

  return {
    file,
    step,
    setStep,
    error,
    setError,
    isValidating,
    validationResult,
    handleFileSelect,
    runFileValidation,
    clear,
  };
}
