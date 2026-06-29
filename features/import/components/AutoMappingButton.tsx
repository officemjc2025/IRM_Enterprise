"use client";

import React from "react";

interface AutoMappingButtonProps {
  onClick: () => void;
}

export default function AutoMappingButton({ onClick }: AutoMappingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 rounded-lg text-xs font-semibold transition-colors"
    >
      ⚡ Auto Map Columns
    </button>
  );
}
