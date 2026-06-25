"use client";

import React from "react";

export default function Header({
  className = "",
}: {
  className?: string;
}) {
  return (
    <header className={"w-full bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 " + className}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open sidebar"
            >
              <span className="sr-only">Open sidebar</span>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
                <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex sm:items-center sm:gap-3">
              <input
                aria-label="Search"
                placeholder="Search"
                className="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">JD</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
