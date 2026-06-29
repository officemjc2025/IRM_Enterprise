"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Occupancy, OccupancyType, OCCUPANCY_TYPES } from "../types/occupancy.types";

export default function OccupancyListPage() {
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<OccupancyType | "">("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchOccupancies = async () => {
    try {
      const res = await fetch("/api/v1/occupancies");
      const json = await res.json();
      if (json.success) {
        setOccupancies(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchOccupancies();
    });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this occupancy?")) return;
    try {
      const res = await fetch(`/api/v1/occupancies/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchOccupancies();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOccupancies = occupancies.filter((o) => {
    const term = search.toLowerCase();
    const unitNumber = o.unit?.unit_number || "";
    const personName = o.person ? `${o.person.first_name} ${o.person.last_name || ""}` : "";

    const matchesSearch =
      unitNumber.toLowerCase().includes(term) ||
      personName.toLowerCase().includes(term);

    const matchesType = typeFilter ? o.occupancy_type === typeFilter : true;
    const matchesStatus = statusFilter ? o.status === statusFilter : true;

    return matchesSearch && matchesType && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOccupancies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOccupancies = filteredOccupancies.slice(startIndex, startIndex + itemsPerPage);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Occupancy List</h2>
          <Link
            href="/occupancies/create"
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
          >
            Create Occupancy
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search by unit number or occupant name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
          />

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as OccupancyType | "");
              setCurrentPage(1);
            }}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
          >
            <option value="">All Occupancy Types</option>
            {OCCUPANCY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-slate-500">Loading...</div>
          ) : paginatedOccupancies.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No occupancy records found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <th className="p-4">Unit Number</th>
                  <th className="p-4">Occupant Name</th>
                  <th className="p-4">Occupancy Type</th>
                  <th className="p-4">Start Date</th>
                  <th className="p-4">End Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {paginatedOccupancies.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono font-medium">{o.unit?.unit_number || "-"}</td>
                    <td className="p-4">
                      {o.person ? `${o.person.first_name} ${o.person.last_name || ""}` : "-"}
                    </td>
                    <td className="p-4 font-semibold text-xs text-slate-500">{o.occupancy_type}</td>
                    <td className="p-4">{o.start_date}</td>
                    <td className="p-4">{o.end_date || "Present"}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          o.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/occupancies/${o.id}`}
                        className="text-slate-600 hover:text-slate-955 dark:text-slate-400"
                      >
                        View
                      </Link>
                      <Link
                        href={`/occupancies/${o.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        Archive
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
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredOccupancies.length)} of{" "}
              {filteredOccupancies.length} occupancies
            </div>
            <div className="flex space-x-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((c) => c - 1)}
                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
              >
                Previous
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
                onClick={() => setCurrentPage((c) => c - 1)}
                className="px-3 py-1 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
