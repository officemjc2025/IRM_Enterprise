"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Owner } from "../types/owner.types";
import { useLanguage } from "@/providers/LanguageProvider";

interface ViewOwnerProps {
  params: Promise<{ id: string }>;
}

export default function ViewOwnerPage({ params }: ViewOwnerProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { id } = use(params);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const res = await fetch(`/api/v1/owners/${id}`);
        const json = await res.json();
        if (json.success) {
          setOwner(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load owner";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchOwner();
  }, [id]);

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.owner.details}</h2>
          <button
            onClick={() => router.push("/owners")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          >
            {t.common.backToList}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
          {loading ? (
            <div className="text-center text-slate-500">{t.common.loading}</div>
          ) : error ? (
            <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          ) : (
            owner && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.owner.ownerCode}</span>
                  <span className="col-span-2 font-mono text-sm font-semibold">{owner.owner_code}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.owner.fullName}</span>
                  <span className="col-span-2 text-sm">{owner.full_name}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.owner.phone}</span>
                  <span className="col-span-2 text-sm">{owner.phone || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.owner.email}</span>
                  <span className="col-span-2 text-sm">{owner.email || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.owner.nationality}</span>
                  <span className="col-span-2 text-sm">{owner.nationality || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.owner.taxId}</span>
                  <span className="col-span-2 text-sm">{owner.tax_id || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.common.status}</span>
                  <span className="col-span-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        owner.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {owner.status === "ACTIVE" ? t.common.active : t.common.inactive}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.common.createdAt}</span>
                  <span className="col-span-2 text-xs font-mono text-slate-400">
                    {new Date(owner.created_at).toLocaleString()}
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
