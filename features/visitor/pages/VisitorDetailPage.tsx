"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Visitor } from "../types/visitor.types";

interface VisitorDetailProps {
  params: Promise<{ id: string }>;
}

export default function VisitorDetailPage({ params }: VisitorDetailProps) {
  const router = useRouter();
  const { id } = use(params);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchVisitor = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/visitors/${id}`);
        const json = await res.json();
        if (json.success) {
          setVisitor(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load visitor details";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      fetchVisitor();
    });
  }, [id, refreshKey]);

  const handleCheckout = async () => {
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

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Visitor Details</h2>
          <button
            onClick={() => router.push("/visitors")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm transition"
          >
            Back to Directory
          </button>
        </div>

        {error ? (
          <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-slate-500">Loading details...</div>
        ) : (
          visitor && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-6">
              {/* Photo placeholder / header */}
              <div className="flex flex-col items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
                <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-4xl text-slate-500">
                  📷
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-mono font-bold block uppercase tracking-wider">
                    {visitor.visitor_number}
                  </span>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mt-1">{visitor.visitor_name}</h3>
                  {visitor.phone && <p className="text-xs text-slate-400 font-mono mt-0.5">{visitor.phone}</p>}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    visitor.status === "CHECKED_IN"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {visitor.status === "CHECKED_IN" ? "Checked In" : "Checked Out"}
                </span>
              </div>

              {/* Visit Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Visiting Unit</span>
                  <span className="col-span-2 font-mono font-semibold">Unit {visitor.unit?.unit_number}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Vehicle Plate</span>
                  <span className="col-span-2 font-mono">{visitor.vehicle_plate || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Company</span>
                  <span className="col-span-2 font-semibold text-slate-700 dark:text-slate-300">{visitor.company || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Purpose</span>
                  <span className="col-span-2">{visitor.purpose}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Security Officer</span>
                  <span className="col-span-2 font-medium">{visitor.security_user || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Check-in Time</span>
                  <span className="col-span-2">{new Date(visitor.check_in_time).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Expected Out</span>
                  <span className="col-span-2">
                    {visitor.expected_checkout_time
                      ? new Date(visitor.expected_checkout_time).toLocaleString()
                      : "-"}
                  </span>
                </div>
                {visitor.actual_checkout_time && (
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2 text-sm">
                    <span className="font-semibold text-slate-500">Checked Out At</span>
                    <span className="col-span-2">{new Date(visitor.actual_checkout_time).toLocaleString()}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 pb-2 text-sm">
                  <span className="font-semibold text-slate-500">Remarks</span>
                  <span className="col-span-2 text-slate-600 dark:text-slate-300">{visitor.remarks || "-"}</span>
                </div>
              </div>

              {visitor.status === "CHECKED_IN" && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={handleCheckout}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition"
                  >
                    Check Out Visitor Now
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </MainLayout>
  );
}
