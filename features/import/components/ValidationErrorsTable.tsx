"use client";

import React from "react";
import { ValidationError } from "../types/import.types";

interface ValidationErrorsTableProps {
  errors: ValidationError[];
}

export default function ValidationErrorsTable({ errors }: ValidationErrorsTableProps) {
  if (errors.length === 0) return null;

  return (
    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Validation Issues & Diagnostics
        </h3>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse min-w-max text-sm">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 font-semibold text-slate-500">
              <th className="p-3 w-20">Row</th>
              <th className="p-3 w-40">Column</th>
              <th className="p-3 w-28">Severity</th>
              <th className="p-3">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {errors.map((err, index) => (
              <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                <td className="p-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                  {err.rowNumber}
                </td>
                <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                  {err.column}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      err.severity === "error"
                        ? "bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/45 dark:text-yellow-400"
                    }`}
                  >
                    {err.severity}
                  </span>
                </td>
                <td className="p-3 text-slate-600 dark:text-slate-400">{err.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
