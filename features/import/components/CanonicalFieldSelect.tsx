"use client";

import React from "react";
import { CanonicalField, CANONICAL_FIELDS } from "../types/import.types";

interface CanonicalFieldSelectProps {
  value: CanonicalField | "";
  onChange: (value: CanonicalField | "") => void;
  disabledFields: (CanonicalField | "")[];
}

export default function CanonicalFieldSelect({
  value,
  onChange,
  disabledFields,
}: CanonicalFieldSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CanonicalField | "")}
      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm max-w-xs focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
    >
      <option value="">[ Ignore / Do not map ]</option>
      {CANONICAL_FIELDS.map((field) => {
        const isDisabled = field !== value && disabledFields.includes(field);
        return (
          <option key={field} value={field} disabled={isDisabled}>
            {field} {isDisabled ? "(mapped)" : ""}
          </option>
        );
      })}
    </select>
  );
}
