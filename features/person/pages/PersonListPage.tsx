"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Person } from "../types/person.types";

export default function PersonListPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchPeople = async (query = "") => {
    try {
      setLoading(true);
      const url = query ? `/api/v1/persons/search?q=${encodeURIComponent(query)}` : "/api/v1/persons";
      const res = await fetch(url);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPeople(search);
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to archive this person?")) return;
    try {
      const res = await fetch(`/api/v1/persons/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchPeople(search);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(people.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPeople = people.slice(startIndex, startIndex + itemsPerPage);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">People Directory</h2>
          <Link
            href="/persons/create"
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
          >
            Create Person
          </Link>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by name, code, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-md p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-sm font-medium"
          >
            Search
          </button>
        </form>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-slate-500">Loading...</div>
          ) : paginatedPeople.length === 0 ? (
            <div className="p-6 text-center text-slate-500">No people found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <th className="p-4">Photo</th>
                  <th className="p-4">Person Code</th>
                  <th className="p-4">Full Name</th>
                  <th className="p-4">Display Name</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
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
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          p.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        href={`/persons/${p.id}`}
                        className="text-slate-600 hover:text-slate-955 dark:text-slate-400"
                      >
                        View
                      </Link>
                      <Link
                        href={`/persons/${p.id}/edit`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id)}
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
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, people.length)} of{" "}
              {people.length} people
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
