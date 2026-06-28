"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";

interface EditProps {
  params: Promise<{ id: string }>;
}

export default function EditPropertyPage({ params }: EditProps) {
  const router = useRouter();
  const { id } = use(params);
  const [code, setCode] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const res = await fetch(`/api/v1/properties/${id}`);
        const json = await res.json();
        if (json.success) {
          setCode(json.data.code);
          setNameTh(json.data.name_th);
          setNameEn(json.data.name_en || "");
          setStatus(json.data.status);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load property";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/properties/${id}`, {
        method: "PATCH",
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
      const message = err instanceof Error ? err.message : "Failed to update property";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Property</h2>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="text-center text-slate-500">Loading...</div>
          ) : (
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
                  disabled={saving}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
