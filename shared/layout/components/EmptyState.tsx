"use client";

import React from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "No data found",
  description = "Get started by creating a new record.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="p-12 border border-dashed border-slate-200 dark:border-slate-700/80 rounded-lg text-center space-y-4">
      <div className="text-4xl text-slate-400">📁</div>
      <div className="space-y-1">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
