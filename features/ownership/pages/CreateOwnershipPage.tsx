"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";
import { PageHeader } from "@/shared/ui";
import { Person } from "@/features/person/types/person.types";
import { Unit } from "@/features/unit/types/unit.types";

export default function CreateOwnershipPage() {
  const router = useRouter();
  const [persons, setPersons] = useState<Person[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [personId, setPersonId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [ownershipPercentage, setOwnershipPercentage] = useState<number>(100);
  const [ownershipType, setOwnershipType] = useState("OWNER");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [resPersons, resUnits] = await Promise.all([
          fetch("/api/v1/persons"),
          fetch("/api/v1/units")
        ]);

        const jsonPersons = await resPersons.json();
        const jsonUnits = await resUnits.json();

        if (jsonPersons.success) {
          setPersons(jsonPersons.data);
          if (jsonPersons.data.length > 0) setPersonId(jsonPersons.data[0].id);
        }
        if (jsonUnits.success) {
          setUnits(jsonUnits.data);
          if (jsonUnits.data.length > 0) setUnitId(jsonUnits.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load dependency data");
      } finally {
        setLoading(false);
      }
    };

    setStartDate(new Date().toISOString().split("T")[0]);
    fetchLookups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/ownerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: personId,
          unit_id: unitId,
          ownership_percentage: Number(ownershipPercentage),
          ownership_type: ownershipType,
          start_date: startDate,
          end_date: endDate || null,
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/ownerships");
      } else {
        setError(json.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create ownership";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader title="Create Ownership" />

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="text-center text-slate-500 py-6">Loading lookups...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Person (Owner) *</label>
                  <select
                    required
                    value={personId}
                    onChange={(e) => setPersonId(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                  >
                    {persons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || `${p.first_name} ${p.last_name}`} ({p.person_code || "No Code"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Unit *</label>
                  <select
                    required
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} (Floor {u.floor})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ownership Percentage (%) *</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={ownershipPercentage}
                    onChange={(e) => setOwnershipPercentage(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Ownership Type *</label>
                  <select
                    required
                    value={ownershipType}
                    onChange={(e) => setOwnershipType(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="CO_OWNER">Co-Owner</option>
                    <option value="JOINT_OWNER">Joint Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none"
                >
                  <option value={Status.ACTIVE}>Active</option>
                  <option value={Status.INACTIVE}>Inactive</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => router.push("/ownerships")}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium transition"
                >
                  {submitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
