"use client";

import { useState } from "react";
import { ImportFile, PreviewResult } from "../types/import.types";
import { importService } from "@/services/import/import.service";

export function useImport() {
  const [file, setFile] = useState<ImportFile | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (rawFile: File) => {
    setLoading(true);
    setError(null);
    try {
      const importFile: ImportFile = {
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || rawFile.name.split(".").pop() || "",
        rawFile,
      };
      setFile(importFile);

      const parsed = await importService.preview(rawFile);
      setPreviewData(parsed);
    } catch (err) {
      console.error("Error parsing file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setFile(null);
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setFile(null);
    setPreviewData(null);
    setError(null);
  };

  return {
    file,
    previewData,
    loading,
    error,
    handleFileSelect,
    clear,
  };
}
