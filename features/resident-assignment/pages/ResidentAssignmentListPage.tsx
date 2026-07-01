"use client";

import React, { Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { ResidentAssignment } from "../types/resident-assignment.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { useDebounce, usePagination, useSorting, useFilter } from "@/features/unit/hooks";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";

function ResidentAssignmentListInner() {
  const { t, language } = useLanguage();
  const [assignments, setAssignments] = useState<ResidentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { sortBy, sortOrder, setSorting } = useSorting("move_in_date", "desc");
  const { status: statusFilter, setFilter } = useFilter("all");

  const fetchAssignments = async () => {
    try {
      const res = await fetch("/api/v1/residents");
      const json = await res.json();
      if (json.success) {
        setAssignments(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch resident assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchAssignments();
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to archive this assignment?" : "คุณแน่ใจหรือไม่ว่าต้องการเก็บข้อมูลการมอบหมายนี้?")) return;
    try {
      const res = await fetch(`/api/v1/residents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchAssignments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Search Filter Step
  const searchedAssignments = assignments.filter((a) => {
    const term = debouncedSearchTerm.toLowerCase().trim();
    if (!term) return true;

    const unitNum = a.unit?.unit_number?.toLowerCase() || "";
    const name = a.person
      ? `${a.person.first_name} ${a.person.last_name || ""} ${a.person.display_name || ""}`.toLowerCase()
      : "";

    return unitNum.includes(term) || name.includes(term);
  });

  // 2. Status Filter Step
  const filteredAssignments = searchedAssignments.filter((a) => {
    if (statusFilter === "all") return true;
    return a.status.toUpperCase() === statusFilter.toUpperCase();
  });

  // 3. Sort Step
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    let valA: unknown = "";
    let valB: unknown = "";

    if (sortBy === "unit_id") {
      valA = a.unit?.unit_number || "";
      valB = b.unit?.unit_number || "";
    } else if (sortBy === "person_id") {
      valA = a.person?.display_name || `${a.person?.first_name || ""} ${a.person?.last_name || ""}`;
      valB = b.person?.display_name || `${b.person?.first_name || ""} ${b.person?.last_name || ""}`;
    } else if (sortBy === "occupancy_type") {
      valA = a.occupancy_type || "";
      valB = b.occupancy_type || "";
    } else if (sortBy === "move_in_date") {
      valA = a.move_in_date || "";
      valB = b.move_in_date || "";
    } else if (sortBy === "status") {
      valA = a.status || "";
      valB = b.status || "";
    } else {
      valA = a[sortBy as keyof ResidentAssignment] ?? "";
      valB = b[sortBy as keyof ResidentAssignment] ?? "";
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
    setPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
  } = usePagination(sortedAssignments.length);

  const paginatedAssignments = sortedAssignments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title={t.residentAssignment.title}
          actionHref="/residents/create"
          actionLabel={t.residentAssignment.create}
        />

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700/80 shadow-sm">
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm}
              onChange={(val) => {
                setSearchTerm(val);
                setPage(1);
              }}
              placeholder={t.residentAssignment.searchPlaceholder}
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-medium text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">{t.common.allStatuses}</option>
              <option value="ACTIVE">{t.common.active}</option>
              <option value="INACTIVE">{t.common.inactive}</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <LoadingState />
          ) : paginatedAssignments.length === 0 ? (
            <EmptyState message={t.residentAssignment.noRecords} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    <th className="p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/60" onClick={() => setSorting("unit_id")}>
                      {t.residentAssignment.unit} {sortBy === "unit_id" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/60" onClick={() => setSorting("person_id")}>
                      {t.residentAssignment.residentName} {sortBy === "person_id" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/60" onClick={() => setSorting("occupancy_type")}>
                      {t.residentAssignment.occupancyType} {sortBy === "occupancy_type" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/60" onClick={() => setSorting("move_in_date")}>
                      {t.residentAssignment.moveInDate} {sortBy === "move_in_date" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="p-4">{t.residentAssignment.moveOutDate}</th>
                    <th className="p-4">{t.residentAssignment.primaryResident}</th>
                    <th className="p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-900/60" onClick={() => setSorting("status")}>
                      {t.common.status} {sortBy === "status" && (sortOrder === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="p-4 text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                  {paginatedAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {a.unit?.unit_number || "-"}
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {a.person ? a.person.display_name || `${a.person.first_name} ${a.person.last_name || ""}` : "-"}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded font-medium text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {a.occupancy_type}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">{a.move_in_date}</td>
                      <td className="p-4 text-slate-500 font-medium">{a.move_out_date || t.unit.present}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          a.primary_resident 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                        }`}>
                          {a.primary_resident ? t.residentAssignment.yes : t.residentAssignment.no}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          a.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <Link
                          href={`/residents/${a.id}`}
                          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-semibold"
                        >
                          {t.common.view}
                        </Link>
                        <Link
                          href={`/residents/${a.id}/edit`}
                          className="text-[#D4AF37] hover:text-[#b8952b] font-semibold"
                        >
                          {t.common.edit}
                        </Link>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-red-500 hover:text-red-700 font-semibold"
                        >
                          {t.common.archive}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              {t.common.showing} <span className="font-mono text-slate-600 dark:text-slate-300">{startIndex}</span> {t.common.to}{" "}
              <span className="font-mono text-slate-600 dark:text-slate-300">{endIndex}</span> {t.common.of}{" "}
              <span className="font-mono text-slate-600 dark:text-slate-300">{sortedAssignments.length}</span>{" "}
              {language === "en" ? "assignments" : "การอยู่อาศัย"}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={firstPage}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                First
              </button>
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-900">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
              <button
                onClick={lastPage}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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

export default function ResidentAssignmentListPage() {
  return (
    <Suspense fallback={<MainLayout><div className="p-6 text-center text-slate-500">Loading residents context...</div></MainLayout>}>
      <ResidentAssignmentListInner />
    </Suspense>
  );
}
