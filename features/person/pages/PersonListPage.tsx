"use client";

import React, { Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Person } from "../types/person.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { useDebounce, usePagination, useSorting, useFilter } from "../hooks";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";

function PersonListInner() {
  const { t, language } = useLanguage();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { sortBy, sortOrder, setSorting } = useSorting("person_code", "asc");
  const { status, setFilter } = useFilter("all");

  const fetchPeople = async () => {
    try {
      const res = await fetch("/api/v1/persons");
      const json = await res.json();
      if (json.success) {
        setPeople(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchPeople();
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this person?")) return;
    try {
      const res = await fetch(`/api/v1/persons/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchPeople();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Search Filter Step
  const searchedPeople = people.filter((p) => {
    const term = debouncedSearchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (p.person_code && p.person_code.toLowerCase().includes(term)) ||
      p.first_name.toLowerCase().includes(term) ||
      p.last_name.toLowerCase().includes(term) ||
      (p.display_name && p.display_name.toLowerCase().includes(term)) ||
      (p.phone && p.phone.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term))
    );
  });

  // 2. Status Filter Step
  const filteredPeople = searchedPeople.filter((p) => {
    if (status === "all") return true;
    return p.status.toUpperCase() === status.toUpperCase();
  });

  // 3. Sort Step
  const sortedPeople = [...filteredPeople].sort((a, b) => {
    let valA = a[sortBy as keyof Person] ?? "";
    let valB = b[sortBy as keyof Person] ?? "";

    if (sortBy === "first_name" || sortBy === "fullName") {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      if (nameA < nameB) return sortOrder === "asc" ? -1 : 1;
      if (nameA > nameB) return sortOrder === "asc" ? 1 : -1;
      return 0;
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
  } = usePagination(sortedPeople.length);

  const sliceStart = (currentPage - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const paginatedPeople = sortedPeople.slice(sliceStart, sliceEnd);

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
          title={t.person.directory}
          actionHref="/persons/create"
          actionLabel={t.person.createPerson}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <SearchInput
              placeholder={t.person.searchPlaceholder}
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
          ) : paginatedPeople.length === 0 ? (
            <EmptyState message={t.person.noPeopleFound} />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm">
                  <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">{t.person.photo}</th>
                  {renderSortableHeader(t.person.personCode, "person_code")}
                  {renderSortableHeader(t.person.fullName, "first_name")}
                  {renderSortableHeader(t.person.displayName, "display_name")}
                  {renderSortableHeader(t.common.phone, "phone")}
                  {renderSortableHeader(t.common.email, "email")}
                  {renderSortableHeader(t.common.status, "status")}
                  <th className="p-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {paginatedPeople.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4">
                      {p.photo ? (
                        <img
                          src={p.photo}
                          alt={p.display_name || p.first_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                          {p.first_name[0]}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono font-medium">{p.person_code || "-"}</td>
                    <td className="p-4">
                      {p.title ? `${p.title} ` : ""}
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="p-4">{p.display_name || "-"}</td>
                    <td className="p-4">{p.phone || "-"}</td>
                    <td className="p-4">{p.email || "-"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.status === "ACTIVE" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/persons/${p.id}`}
                        className="text-slate-600 hover:text-slate-900 dark:text-slate-400"
                      >
                        {t.common.view}
                      </Link>
                      <Link
                        href={`/persons/${p.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        {t.common.edit}
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id)}
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
        {!loading && sortedPeople.length > 0 && (
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
                {t.common.showing} {startIndex}–{endIndex} {t.common.of} {sortedPeople.length} {t.person.items}
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

export default function PersonListPage() {
  return (
    <Suspense fallback={<MainLayout><div className="p-6 text-center text-slate-500">Loading pagination context...</div></MainLayout>}>
      <PersonListInner />
    </Suspense>
  );
}
