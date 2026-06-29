"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Visitor } from "../types/visitor.types";

export default function VisitorHistoryPage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/visitors");
        const json = await res.json();
        if (json.success) {
          setVisitors(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load visitor history";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      fetchVisitors();
    });
  }, [refreshKey]);

  const handleCheckout = async (id: string) => {
    if (!confirm("Are you sure you want to check out this visitor?")) return;
    try {
      const res = await fetch(`/api/v1/visitors/${id}`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (json.success) {
        setRefreshKey((k) => k + 1);
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    }
  };

  const filtered = visitors.filter((v) => {
    const term = searchTerm.toLowerCase();
    return (
      v.visitor_name.toLowerCase().includes(term) ||
      v.visitor_number.toLowerCase().includes(term) ||
      (v.phone && v.phone.toLowerCase().includes(term)) ||
      (v.vehicle_plate && v.vehicle_plate.toLowerCase().includes(term)) ||
      v.unit?.unit_number.toLowerCase().includes(term)
    );
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Visitor Directory</h2>
            <p className="text-sm text-slate-500">View check-in logs and active visits.</p>
          </div>
          <button
            onClick={() => router.push("/visitors/check-in")}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold transition"
          >
            Check-in New Visitor
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by visitor name, ID number, phone, plate, or unit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm shadow-sm outline-none"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading logs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">No visitor records found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="p-3">Visitor No. & Name</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">Plate No.</th>
                  <th className="p-3">Check-in Time</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <div className="text-xs text-slate-400 font-mono">{v.visitor_number}</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{v.visitor_name}</div>
                      {v.phone && <div className="text-[10px] text-slate-400 font-mono">{v.phone}</div>}
                    </td>
                    <td className="p-3 font-mono font-medium">{v.unit?.unit_number || "-"}</td>
                    <td className="p-3 font-mono">{v.vehicle_plate || "-"}</td>
                    <td className="p-3 text-xs">
                      {new Date(v.check_in_time).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          v.status === "CHECKED_IN"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {v.status === "CHECKED_IN" ? "Checked In" : "Checked Out"}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 text-xs">
                      <button
                        onClick={() => router.push(`/visitors/${v.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                      >
                        Details
                      </button>
                      {v.status === "CHECKED_IN" && (
                        <button
                          onClick={() => handleCheckout(v.id)}
                          className="text-amber-600 hover:text-amber-900 dark:text-amber-400"
                        >
                          Checkout
                        </button>
                      )}
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
