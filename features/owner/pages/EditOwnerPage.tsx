"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";
import { useLanguage } from "@/providers/LanguageProvider";

interface EditOwnerProps {
  params: Promise<{ id: string }>;
}

export default function EditOwnerPage({ params }: EditOwnerProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { id } = use(params);
  const [ownerCode, setOwnerCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("");
  const [taxId, setTaxId] = useState("");
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const res = await fetch(`/api/v1/owners/${id}`);
        const json = await res.json();
        if (json.success) {
          setOwnerCode(json.data.owner_code);
          setFullName(json.data.full_name);
          setPhone(json.data.phone || "");
          setEmail(json.data.email || "");
          setNationality(json.data.nationality || "");
          setTaxId(json.data.tax_id || "");
          setStatus(json.data.status);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load details";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchOwner();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/owners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_code: ownerCode,
          full_name: fullName,
          phone: phone || null,
          email: email || null,
          nationality: nationality || null,
          tax_id: taxId || null,
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/owners");
      } else {
        setError(json.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update owner";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.owner.editOwner}</h2>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="text-center text-slate-500">{t.common.loading}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">{t.owner.ownerCode} *</label>
                <input
                  type="text"
                  required
                  value={ownerCode}
                  onChange={(e) => setOwnerCode(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t.owner.fullName} *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t.owner.phone}</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t.owner.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t.owner.nationality}</label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t.owner.taxId}</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t.common.status}</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                >
                  <option value={Status.ACTIVE}>{t.common.active}</option>
                  <option value={Status.INACTIVE}>{t.common.inactive}</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => router.push("/owners")}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
                >
                  {saving ? t.common.saving : t.common.save}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
