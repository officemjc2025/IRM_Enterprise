"use client";

import React from "react";
import { ImportValidationSummary } from "../types/import.types";

interface ValidationSummaryProps {
  summary: ImportValidationSummary;
  onImportClick: () => void;
  importLoading?: boolean;
}

export default function ValidationSummary({
  summary,
  onImportClick,
  importLoading = false,
}: ValidationSummaryProps) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Validation Summary
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Overview of verified spreadsheet data</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Ready to Import:</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${
              summary.importReady
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {summary.importReady ? "YES" : "NO"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Total Rows</div>
          <div className="text-2xl font-bold mt-1">{summary.totalRows}</div>
        </div>

        <div className="bg-green-50/50 dark:bg-green-950/10 p-4 rounded-xl border border-green-100/50 dark:border-green-900/20">
          <div className="text-xs text-green-600 dark:text-green-400 font-medium">Valid Rows</div>
          <div className="text-2xl font-bold mt-1 text-green-700 dark:text-green-400">
            {summary.validRows}
          </div>
        </div>

        <div className="bg-yellow-50/50 dark:bg-yellow-950/10 p-4 rounded-xl border border-yellow-100/50 dark:border-yellow-900/20">
          <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Warning Rows</div>
          <div className="text-2xl font-bold mt-1 text-yellow-700 dark:text-yellow-400">
            {summary.warningRows}
          </div>
        </div>

        <div className="bg-red-50/50 dark:bg-red-950/10 p-4 rounded-xl border border-red-100/50 dark:border-red-900/20">
          <div className="text-xs text-red-600 dark:text-red-400 font-medium">Error Rows</div>
          <div className="text-2xl font-bold mt-1 text-red-700 dark:text-red-400">
            {summary.errorRows}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onImportClick}
          disabled={!summary.importReady || importLoading}
          className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold shadow-md shadow-[#D4AF37]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {importLoading ? "Importing..." : "🚀 Run Database Import"}
        </button>
      </div>
    </div>
  );
}
