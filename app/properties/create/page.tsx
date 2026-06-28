"use client";

import React, { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";

export default function CreatePropertyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name_th: nameTh, name_en: nameEn, status }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/properties");
      } else {
        setError(json.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create property";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Property</h2>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Property Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name (TH) *</label>
              <input
                type="text"
                required
                value={nameTh}
                onChange={(e) => setNameTh(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Name (EN)</label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900"
              >
                <option value={Status.ACTIVE}>Active</option>
                <option value={Status.INACTIVE}>Inactive</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => router.push("/properties")}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
