"use client";

import React from "react";
import Sidebar from "../../components/layout/Sidebar";
import Header from "../../components/layout/Header";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="lg:flex">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex-1 min-w-0">
          <Header />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}