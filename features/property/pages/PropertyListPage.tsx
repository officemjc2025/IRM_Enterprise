"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Property } from "@/features/property/types/property.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { useDebounce } from "@/features/property/hooks";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";

export default function PropertyListPage() {
  const { language } = useLanguage();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/v1/properties");
      const json = await res.json();
      if (json.success) {
        setProperties(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchProperties();
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;
    try {
      const res = await fetch(`/api/v1/properties/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchProperties();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProperties = properties.filter((p) => {
    const term = debouncedSearchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      p.code.toLowerCase().includes(term) ||
      p.name_th.toLowerCase().includes(term) ||
      (p.name_en && p.name_en.toLowerCase().includes(term))
    );
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Properties"
          actionHref="/properties/create"
          actionLabel="Create Property"
        />

        <SearchInput
          placeholder={language === "en" ? "Search by name or code..." : "ค้นหาด้วยชื่อหรือรหัส..."}
          value={searchTerm}
          onChange={setSearchTerm}
        />

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <LoadingState />
          ) : filteredProperties.length === 0 ? (
            <EmptyState message="No properties found." />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <th className="p-4">Code</th>
                  <th className="p-4">Name (TH)</th>
                  <th className="p-4">Name (EN)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {filteredProperties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono font-medium">{p.code}</td>
                    <td className="p-4">{p.name_th}</td>
                    <td className="p-4">{p.name_en || "-"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/properties/${p.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
