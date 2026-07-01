"use client";

import React, { Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Ownership } from "../types/ownership.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { useDebounce, usePagination, useSorting, useFilter } from "../hooks";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";

function OwnershipListInner() {
  const { t, language } = useLanguage();
  const [ownerships, setOwnerships] = useState<Ownership[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { sortBy, sortOrder, setSorting } = useSorting("unit_id", "asc");
  const { status, setFilter } = useFilter("all");

  const fetchOwnerships = async () => {
    try {
      const res = await fetch("/api/v1/ownerships");
      const json = await res.json();
      if (json.success) {
        setOwnerships(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchOwnerships();
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this ownership record?")) return;
    try {
      const res = await fetch(`/api/v1/ownerships/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchOwnerships();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Search Filter Step
  const searchedOwnerships = ownerships.filter((o) => {
    const term = debouncedSearchTerm.toLowerCase().trim();
    if (!term) return true;

    const unitNum = o.unit?.unit_number?.toLowerCase() || "";
    const personFirstName = o.person?.first_name?.toLowerCase() || "";
    const personLastName = o.person?.last_name?.toLowerCase() || "";
    const personDisplayName = o.person?.display_name?.toLowerCase() || "";
    const typeName = o.ownership_type?.toLowerCase() || "";

    return (
      unitNum.includes(term) ||
      personFirstName.includes(term) ||
      personLastName.includes(term) ||
      personDisplayName.includes(term) ||
      typeName.includes(term)
    );
  });

  // 2. Status Filter Step
  const filteredOwnerships = searchedOwnerships.filter((o) => {
    if (status === "all") return true;
    return o.status.toUpperCase() === status.toUpperCase();
  });

  // 3. Sort Step
  const sortedOwnerships = [...filteredOwnerships].sort((a, b) => {
    let valA: any = "";
    let valB: any = "";

    if (sortBy === "unit_id") {
      valA = a.unit?.unit_number || "";
      valB = b.unit?.unit_number || "";
    } else if (sortBy === "person_id") {
      valA = a.person?.display_name || `${a.person?.first_name || ""} ${a.person?.last_name || ""}`;
      valB = b.person?.display_name || `${b.person?.first_name || ""} ${b.person?.last_name || ""}`;
    } else if (sortBy === "ownership_percentage") {
      valA = a.ownership_percentage;
      valB = b.ownership_percentage;
    } else if (sortBy === "ownership_type") {
      valA = a.ownership_type || "";
      valB = b.ownership_type || "";
    } else if (sortBy === "status") {
      valA = a.status || "";
      valB = b.status || "";
    } else {
      valA = a[sortBy as keyof Ownership] ?? "";
      valB = b[sortBy as keyof Ownership] ?? "";
    }

    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }

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
  } = usePagination(sortedOwnerships.length);

  const sliceStart = (currentPage - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const paginatedOwnerships = sortedOwnerships.slice(sliceStart, sliceEnd);

  const renderSortableHeader = (label: string, key: string) => {
    const isSorted = sortBy === key;
    return (
      <th
        onClick={() => setSorting(key)}
        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none font-semibold text-slate-600 dark:text-slate-300"
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
          title={language === "en" ? "Unit Ownerships" : "การเป็นเจ้าของยูนิต"}
          actionHref="/ownerships/create"
          actionLabel={language === "en" ? "Create Ownership" : "เพิ่มสิทธิ์การเป็นเจ้าของ"}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <SearchInput
              placeholder={language === "en" ? "Search by unit number or owner name..." : "ค้นหาด้วยเลขที่ยูนิต หรือชื่อเจ้าของ..."}
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
            <LoadingState message={t.common.loading} />
          ) : paginatedOwnerships.length === 0 ? (
            <EmptyState message={language === "en" ? "No ownership records found." : "ไม่พบข้อมูลการเป็นเจ้าของ"} />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                  {renderSortableHeader(language === "en" ? "Unit Number" : "เลขยูนิต", "unit_id")}
                  {renderSortableHeader(language === "en" ? "Owner Name" : "ชื่อเจ้าของ", "person_id")}
                  {renderSortableHeader(language === "en" ? "Ownership %" : "สัดส่วน %", "ownership_percentage")}
                  {renderSortableHeader(language === "en" ? "Ownership Type" : "ประเภทสิทธิ์", "ownership_type")}
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">
                    {language === "en" ? "Start Date" : "วันที่เริ่มต้น"}
                  </th>
                  {renderSortableHeader(t.common.status, "status")}
                  <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {paginatedOwnerships.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono font-medium">
                      {o.unit ? (
                        <Link href={`/units/${o.unit.id}`} className="text-[#D4AF37] hover:underline">
                          {o.unit.unit_number}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4 font-medium">
                      {o.person ? (
                        <Link href={`/persons/${o.person.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          {o.person.display_name || `${o.person.first_name} ${o.person.last_name}`}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4 font-mono">{o.ownership_percentage}%</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {o.ownership_type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{o.start_date}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        o.status === "ACTIVE" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/ownerships/${o.id}`}
                        className="text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      >
                        {t.common.view}
                      </Link>
                      <Link
                        href={`/ownerships/${o.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        {t.common.edit}
                      </Link>
                      <button
                        onClick={() => handleDelete(o.id)}
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

        {/* Pagination Controls */}
        {!loading && sortedOwnerships.length > 0 && (
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
                {t.common.showing} {startIndex}–{endIndex} {t.common.of} {sortedOwnerships.length} {language === "en" ? "records" : "รายการ"}
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

export default function OwnershipListPage() {
  return (
    <Suspense fallback={<MainLayout><div className="p-6 text-center text-slate-500">Loading ownership context...</div></MainLayout>}>
      <OwnershipListInner />
    </Suspense>
  );
}
