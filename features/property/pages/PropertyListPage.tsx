"use client";

import React, { Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Property } from "@/features/property/types/property.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { useDebounce, usePagination, useSorting, useFilter } from "@/features/property/hooks";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";

function PropertyListInner() {
  const { language } = useLanguage();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { sortBy, sortOrder, setSorting } = useSorting("code", "asc");
  const { status, setFilter } = useFilter("all");

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

  // 1. Search Filter Step
  const searchedProperties = properties.filter((p) => {
    const term = debouncedSearchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      p.code.toLowerCase().includes(term) ||
      p.name_th.toLowerCase().includes(term) ||
      (p.name_en && p.name_en.toLowerCase().includes(term))
    );
  });

  // 2. Status Filter Step
  const filteredProperties = searchedProperties.filter((p) => {
    if (status === "all") return true;
    return p.status.toUpperCase() === status.toUpperCase();
  });

  // 3. Sort Step
  const sortedProperties = [...filteredProperties].sort((a, b) => {
    const valA = a[sortBy as keyof Property] || "";
    const valB = b[sortBy as keyof Property] || "";

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    if (strA < strB) return sortOrder === "asc" ? -1 : 1;
    if (strA > strB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // 4. Pagination Step
  const {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    
    setPageSize,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
  } = usePagination(sortedProperties.length);

  const sliceStart = (currentPage - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const paginatedProperties = sortedProperties.slice(sliceStart, sliceEnd);

  const renderSortableHeader = (label: string, key: string) => {
    const isSorted = sortBy === key;
    return (
      <th
        onClick={() => setSorting(key)}
        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none"
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          <span className="text-slate-400 text-xs">
            {isSorted ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </div>
      </th>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Properties"
          actionHref="/properties/create"
          actionLabel="Create Property"
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <SearchInput
              placeholder={language === "en" ? "Search by name or code..." : "ค้นหาด้วยชื่อหรือรหัส..."}
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>
          <div className="sm:w-48">
            <select
              value={status}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm shadow-sm outline-none cursor-pointer"
            >
              <option value="all">{language === "en" ? "All Statuses" : "ทุกสถานะ"}</option>
              <option value="ACTIVE">{language === "en" ? "Active" : "ใช้งานอยู่"}</option>
              <option value="INACTIVE">{language === "en" ? "Inactive" : "ไม่ได้ใช้งาน"}</option>
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <LoadingState />
          ) : paginatedProperties.length === 0 ? (
            <EmptyState message="No properties found." />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {renderSortableHeader("Code", "code")}
                  {renderSortableHeader("Name (TH)", "name_th")}
                  {renderSortableHeader("Name (EN)", "name_en")}
                  {renderSortableHeader("Status", "status")}
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {paginatedProperties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono font-medium">{p.code}</td>
                    <td className="p-4">{p.name_th}</td>
                    <td className="p-4">{p.name_en || "-"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.status === "ACTIVE" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
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

        {/* Pagination Controls */}
        {!loading && sortedProperties.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-4 shadow-sm text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-slate-500 ml-2">
                Showing {startIndex}–{endIndex} of {sortedProperties.length} properties
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={firstPage}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
              >
                First
              </button>
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded font-semibold text-slate-800 dark:text-slate-200">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
              >
                Next
              </button>
              <button
                onClick={lastPage}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function PropertyListPage() {
  return (
    <Suspense fallback={<MainLayout><div className="p-6 text-center text-slate-500">Loading pagination context...</div></MainLayout>}>
      <PropertyListInner />
    </Suspense>
  );
}
