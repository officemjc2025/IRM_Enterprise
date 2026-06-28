"use client";

import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useImport } from "../hooks/useImport";
import UploadZone from "../components/UploadZone";
import FilePreview from "../components/FilePreview";

export default function ImportPage() {
  const { file, previewData, loading, error, handleFileSelect, clear } = useImport();

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Master Data Import</h2>
          <p className="text-sm text-slate-500">Upload Excel or CSV files to preview</p>
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
          <FilePreview file={file} previewData={previewData} onClear={clear} />
        )}
      </div>
    </MainLayout>
  );
}
