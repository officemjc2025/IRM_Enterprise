"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Unit } from "../types/unit.types";
import { useLanguage } from "@/providers/LanguageProvider";

export default function UnitListPage() {
  const { t } = useLanguage();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/v1/units");
      const json = await res.json();
      if (json.success) {
        setUnits(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchUnits();
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this unit?")) return;
    try {
      const res = await fetch(`/api/v1/units/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchUnits();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUnits = units.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.unit_number.toLowerCase().includes(term) ||
      u.building_code.toLowerCase().includes(term) ||
      u.floor.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredUnits.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUnits = filteredUnits.slice(startIndex, startIndex + itemsPerPage);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.unit.title}</h2>
          <Link
            href="/units/create"
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
          >
            {t.unit.createUnit}
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder={t.unit.searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 max-w-md p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-slate-500">{t.common.loading}</div>
          ) : paginatedUnits.length === 0 ? (
            <div className="p-6 text-center text-slate-500">{t.unit.noUnitsFound}</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <th className="p-4">{t.unit.unitNumber}</th>
                  <th className="p-4">{t.unit.buildingCode}</th>
                  <th className="p-4">{t.unit.floor}</th>
                  <th className="p-4">{t.unit.area}</th>
                  <th className="p-4">{t.unit.ownershipRatio}</th>
                  <th className="p-4">{t.common.status}</th>
                  <th className="p-4 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {paginatedUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono font-medium">{u.unit_number}</td>
                    <td className="p-4">{u.building_code || "-"}</td>
                    <td className="p-4">{u.floor}</td>
                    <td className="p-4">{u.area} sqm</td>
                    <td className="p-4">{(u.ownership_ratio * 100).toFixed(4)}%</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          u.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/units/${u.id}`}
                        className="text-slate-600 hover:text-slate-955 dark:text-slate-400"
                      >
                        {t.common.view}
                      </Link>
                      <Link
                        href={`/units/${u.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        {t.common.edit}
                      </Link>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        {t.common.archive}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center text-sm text-slate-500">
            <div>
              {t.common.showing} {startIndex + 1} {t.common.to} {Math.min(startIndex + itemsPerPage, filteredUnits.length)} {t.common.of}{" "}
              {filteredUnits.length} {t.unit.items}
            </div>
            <div className="flex space-x-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => c - 1)}
                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
              >
                {t.common.previous}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 rounded-lg border ${
                    currentPage === page
                      ? "bg-[#D4AF37] border-[#D4AF37] text-white"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((c) => c + 1)}
                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
              >
                {t.common.next}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
