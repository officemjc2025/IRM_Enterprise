"use client";

import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useImport } from "../hooks/useImport";
import UploadZone from "../components/UploadZone";
import FilePreview from "../components/FilePreview";
import ColumnMappingTable from "../components/ColumnMappingTable";
import ValidationSummary from "../components/ValidationSummary";
import ValidationErrorsTable from "../components/ValidationErrorsTable";

export default function ImportPage() {
  const {
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
  } = useImport();

  const handleImport = () => {
    alert("Database Import functionality is out of scope for PACK-001C.");
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Master Data Import</h2>
          <p className="text-sm text-slate-500">Upload Excel or CSV files, map fields, and validate data</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        {!file && !loading && (
          <UploadZone onFileSelected={handleFileSelect} loading={loading} />
        )}

        {loading && (
          <div className="text-center py-12 text-slate-500">
            <span className="animate-spin inline-block mr-2">⏳</span>
            Parsing worksheet data...
          </div>
        )}

        {file && previewData && !loading && (
          <div className="space-y-6">
            <FilePreview file={file} previewData={previewData} onClear={clear} />

            <ColumnMappingTable
              previewData={previewData}
              mapping={mapping}
              onMappingChange={updateMapping}
              onAutoMap={triggerAutoMapping}
            />

            <div className="flex justify-start">
              <button
                type="button"
                onClick={runValidation}
                disabled={isValidating}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition-colors"
              >
                {isValidating ? "Validating..." : "🔍 Run Validation checks"}
              </button>
            </div>

            {validationResult && (
              <div className="space-y-6 animate-fade-in">
                <ValidationSummary
                  summary={validationResult.summary}
                  onImportClick={handleImport}
                />

                <ValidationErrorsTable errors={validationResult.allErrors} />
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
