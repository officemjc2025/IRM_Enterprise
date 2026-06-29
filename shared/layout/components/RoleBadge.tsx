"use client";

import React from "react";

export function RoleBadge({ role = "Administrator" }: { role?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
      {role}
    </span>
  );
}
