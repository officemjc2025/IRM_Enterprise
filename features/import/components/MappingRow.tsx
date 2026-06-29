"use client";

import React from "react";
import { CanonicalField } from "../types/import.types";
import CanonicalFieldSelect from "./CanonicalFieldSelect";

interface MappingRowProps {
  header: string;
  mappedField: CanonicalField | "";
  sampleValue: string;
  onChange: (field: CanonicalField | "") => void;
  disabledFields: (CanonicalField | "")[];
}

export default function MappingRow({
  header,
  mappedField,
  sampleValue,
  onChange,
  disabledFields,
}: MappingRowProps) {
  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 text-sm">
      <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">{header}</td>
      <td className="p-3">
        <CanonicalFieldSelect
          value={mappedField}
          onChange={onChange}
          disabledFields={disabledFields}
        />
      </td>
      <td className="p-3 text-slate-500 font-mono text-xs max-w-xs truncate">{sampleValue}</td>
    </tr>
  );
}
