"use client";

import React from "react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "An error occurred",
  message = "Failed to load requested resources.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="p-8 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-center space-y-4">
      <div className="text-4xl">⚠️</div>
      <div className="space-y-1">
        <h3 className="font-semibold text-red-800 dark:text-red-400">{title}</h3>
        <p className="text-sm text-red-600 dark:text-red-500">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}
