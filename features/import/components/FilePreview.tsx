"use client";

import React from "react";
import { ImportFile, PreviewResult } from "../types/import.types";

interface FilePreviewProps {
  file: ImportFile;
  previewData: PreviewResult;
  onClear: () => void;
}

export default function FilePreview({ file, previewData, onClear }: FilePreviewProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* File Info Card */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
        <div className="flex items-center space-y-1 gap-3">
          <span className="text-2xl">📄</span>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-xs md:max-w-md">
              {file.name}
            </div>
            <div className="text-xs text-slate-400">{formatSize(file.size)}</div>
          </div>
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Clear
        </button>
      </div>

      {/* Preview Table Container */}
      <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Preview (Showing first 20 rows)
          </h3>
          <span className="text-xs text-slate-400">{previewData.rows.length} rows loaded</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse min-w-max text-sm">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-500">
                {previewData.headers.map((h, i) => (
                  <th key={i} className="p-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {previewData.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                  {previewData.headers.map((h, colIndex) => {
                    const value = row[h];
                    return (
                      <td key={colIndex} className="p-3 text-slate-600 dark:text-slate-300">
                        {value === null || value === undefined ? "" : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
