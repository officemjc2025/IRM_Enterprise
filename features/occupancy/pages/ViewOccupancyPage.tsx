"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Occupancy } from "../types/occupancy.types";

interface ViewOccupancyProps {
  params: Promise<{ id: string }>;
}

export default function ViewOccupancyPage({ params }: ViewOccupancyProps) {
  const router = useRouter();
  const { id } = use(params);
  const [occupancy, setOccupancy] = useState<Occupancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOccupancy = async () => {
      try {
        const res = await fetch(`/api/v1/occupancies/${id}`);
        const json = await res.json();
        if (json.success) {
          setOccupancy(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load occupancy";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchOccupancy();
  }, [id]);

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Occupancy Details</h2>
          <button
            onClick={() => router.push("/occupancies")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          >
            Back to List
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
          {loading ? (
            <div className="text-center text-slate-500">Loading...</div>
          ) : error ? (
            <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          ) : (
            occupancy && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Unit Number</span>
                  <span className="col-span-2 font-mono text-sm font-semibold">
                    {occupancy.unit?.unit_number || "-"}
                  </span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Building / Floor</span>
                  <span className="col-span-2 text-sm">
                    {occupancy.unit?.building_code || "Main"} / Floor {occupancy.unit?.floor || "-"}
                  </span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Occupant Name</span>
                  <span className="col-span-2 text-sm">
                    {occupancy.person
                      ? `${occupancy.person.first_name} ${occupancy.person.last_name || ""}`
                      : "-"}
                  </span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Occupancy Type</span>
                  <span className="col-span-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {occupancy.occupancy_type}
                  </span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Start Date</span>
                  <span className="col-span-2 text-sm">{occupancy.start_date}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">End Date</span>
                  <span className="col-span-2 text-sm">{occupancy.end_date || "Present"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Status</span>
                  <span className="col-span-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        occupancy.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {occupancy.status}
                    </span>
                  </span>
                </div>
                {occupancy.remarks && (
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Remarks</span>
                    <span className="col-span-2 text-sm text-slate-600 dark:text-slate-400">
                      {occupancy.remarks}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Created At</span>
                  <span className="col-span-2 text-xs font-mono text-slate-400">
                    {new Date(occupancy.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </MainLayout>
  );
}
