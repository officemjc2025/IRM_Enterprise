"use client";

import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import GlobalSearch from "@/shared/search/components/GlobalSearch";

export default function SearchPage() {
  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-xl font-bold">Global Search</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search across properties, units, persons, and active occupancies.
          </p>
        </div>

        <GlobalSearch />
      </div>
    </MainLayout>
  );
}
