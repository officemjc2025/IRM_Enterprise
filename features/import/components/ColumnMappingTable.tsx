"use client";

import React from "react";
import { ColumnMapping, PreviewResult, CanonicalField } from "../types/import.types";
import MappingRow from "./MappingRow";
import AutoMappingButton from "./AutoMappingButton";

interface ColumnMappingTableProps {
  previewData: PreviewResult;
  mapping: ColumnMapping;
  onMappingChange: (header: string, field: CanonicalField | "") => void;
  onAutoMap: () => void;
}

export default function ColumnMappingTable({
  previewData,
  mapping,
  onMappingChange,
  onAutoMap,
}: ColumnMappingTableProps) {
  const disabledFields = Object.values(mapping).filter((field): field is CanonicalField => field !== "");

  const getSampleValue = (header: string): string => {
    if (previewData.rows && previewData.rows[0]) {
      const val = previewData.rows[0][header];
      return val === null || val === undefined ? "" : String(val);
    }
    return "";
  };

  return (
    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Column Mapping Setup
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Map Excel/CSV headers to IRM system fields</p>
        </div>
        <AutoMappingButton onClick={onAutoMap} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
              <th className="p-3">Uploaded Column</th>
              <th className="p-3">IRM Canonical Field</th>
              <th className="p-3">Sample Value (Row 1)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {previewData.headers.map((header) => (
              <MappingRow
                key={header}
                header={header}
                mappedField={mapping[header] || ""}
                sampleValue={getSampleValue(header)}
                onChange={(field) => onMappingChange(header, field)}
                disabledFields={disabledFields}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
