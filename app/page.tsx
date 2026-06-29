"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "../components/layout/MainLayout";

function KpiCard({ title, value, href }: { title: string; value: string | number; href: string }) {
  return (
    <a
      href={href}
      className="block bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm hover:border-[#D4AF37] transition duration-200"
    >
      <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</dt>
      <dd className="mt-2 flex items-baseline">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
      </dd>
    </a>
  );
}

export default function Page() {
  const [counts, setCounts] = useState({
    properties: 0,
    units: 0,
    persons: 0,
    occupancies: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [propRes, unitRes, personRes, occRes] = await Promise.all([
          fetch("/api/v1/properties"),
          fetch("/api/v1/units"),
          fetch("/api/v1/persons"),
          fetch("/api/v1/occupancies"),
        ]);

        const [propJson, unitJson, personJson, occJson] = await Promise.all([
          propRes.json(),
          unitRes.json(),
          personRes.json(),
          occRes.json(),
        ]);

        setCounts({
          properties: propJson.success ? propJson.data.length : 0,
          units: unitJson.success ? unitJson.data.length : 0,
          persons: personJson.success ? personJson.data.length : 0,
          occupancies: occJson.success ? occJson.data.length : 0,
        });
      } catch (err) {
        console.error("Failed to load dashboard counts:", err);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      fetchCounts();
    });
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <section aria-labelledby="overview-heading">
          <div className="flex items-center justify-between">
            <h2 id="overview-heading" className="text-xl font-bold">Metro Administration Console</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center text-slate-500">Loading metrics...</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Properties" value={counts.properties} href="/properties" />
              <KpiCard title="Units" value={counts.units} href="/units" />
              <KpiCard title="Persons" value={counts.persons} href="/persons" />
              <KpiCard title="Occupancies" value={counts.occupancies} href="/occupancies" />
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Welcome to IRM Enterprise</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This console is the central workspace for Metro Jomtien condominium daily operations. 
            Use the sidebar navigation to manage property assets, units, resident directories, and active occupancy assignments.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
