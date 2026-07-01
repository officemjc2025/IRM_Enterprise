"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Ownership } from "../types/ownership.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader } from "@/shared/ui";

interface ViewOwnershipProps {
  params: Promise<{ id: string }>;
}

export default function ViewOwnershipPage({ params }: ViewOwnershipProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = use(params);
  
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOwnership = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/ownerships/${id}`);
        const json = await res.json();
        if (json.success) {
          setOwnership(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      fetchOwnership();
    });
  }, [id]);

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title={t.common.details || "Ownership Details"} />
          <button
            onClick={() => router.push("/ownerships")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm transition"
          >
            {t.common.backToList || "Back to List"}
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">{t.common.loading}</div>
        ) : error ? (
          <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm w-full">
            {error}
          </div>
        ) : (
          ownership && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-6">
              {/* Unit Info Section */}
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h3 className="font-semibold text-lg mb-3">Unit Information</h3>
                {ownership.unit ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="block font-medium text-slate-400">Unit Number</span>
                      <span className="font-semibold">{ownership.unit.unit_number}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Floor</span>
                      <span>{ownership.unit.floor}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Building Code</span>
                      <span>{ownership.unit.building_code || "Main"}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Unit details missing.</p>
                )}
              </div>

              {/* Owner Info Section */}
              <div className="border-b border-slate-100 dark:border-slate-700 pb-4">
                <h3 className="font-semibold text-lg mb-3">Owner Information</h3>
                {ownership.person ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="block font-medium text-slate-400">Full Name</span>
                      <span className="font-semibold">
                        {ownership.person.title ? `${ownership.person.title} ` : ""}
                        {ownership.person.first_name} {ownership.person.last_name}
                      </span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Display Name</span>
                      <span>{ownership.person.display_name || "-"}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Person Code</span>
                      <span className="font-mono">{ownership.person.person_code || "-"}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Phone</span>
                      <span>{ownership.person.phone || "-"}</span>
                    </div>
                    <div>
                      <span className="block font-medium text-slate-400">Email</span>
                      <span>{ownership.person.email || "-"}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Owner details missing.</p>
                )}
              </div>

              {/* Ownership Info Section */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Ownership Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="block font-medium text-slate-400">Ownership Ratio</span>
                    <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400">
                      {ownership.ownership_percentage}%
                    </span>
                  </div>
                  <div>
                    <span className="block font-medium text-slate-400">Ownership Type</span>
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {ownership.ownership_type}
                    </span>
                  </div>
                  <div>
                    <span className="block font-medium text-slate-400">Status</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ownership.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {ownership.status}
                    </span>
                  </div>
                  <div>
                    <span className="block font-medium text-slate-400">Start Date</span>
                    <span>{ownership.start_date}</span>
                  </div>
                  <div>
                    <span className="block font-medium text-slate-400">End Date</span>
                    <span>{ownership.end_date || "Present"}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </MainLayout>
  );
}
