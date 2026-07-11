"use client";

import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import { PageHeader } from "@/shared/ui";

/**
 * RegistrationRequestsPage
 * Admin-only view for managing incoming resident/staff registration requests.
 * IRM-043 scaffold — full implementation in future sprint.
 */
export default function RegistrationRequestsPage() {
  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader title="Registration Requests" />
        <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2">
          Review and manage incoming registration submissions
        </p>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 flex flex-col items-center justify-center gap-4 text-center">
          {/* Construction icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Registration Requests
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              This feature is under construction. Registration request management will be available in the next release.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            IRM-043 — Coming Soon
          </span>
        </div>
      </div>
    </MainLayout>
  );
}
