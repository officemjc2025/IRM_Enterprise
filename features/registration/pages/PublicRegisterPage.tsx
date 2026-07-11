"use client";

import React from "react";

/**
 * PublicRegisterPage
 * Public-facing resident registration landing page.
 * No authentication required. No MainLayout (no sidebar).
 * IRM-043 scaffold — full registration wizard in future sprint.
 */
export default function PublicRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-10 flex flex-col items-center gap-6 text-center shadow-2xl">
          {/* Logo mark */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Resident Registration
            </h1>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-xs">
              This feature is under construction. Registration will be available soon.
            </p>
          </div>

          {/* Status badge */}
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 text-xs font-medium text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Coming Soon
          </span>

          {/* Back link */}
          <a
            href="/login"
            className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
          >
            Already have an account? Sign in
          </a>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-600">
          IRM Enterprise · Resident Portal Registration
        </p>
      </div>
    </div>
  );
}
