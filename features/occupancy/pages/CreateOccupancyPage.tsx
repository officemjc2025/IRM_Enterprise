"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";
import { OccupancyType, OCCUPANCY_TYPES } from "../types/occupancy.types";
import { Unit } from "@/features/unit/types/unit.types";
import { createClient } from "@/lib/supabase/client";

interface PersonOption {
  id: string;
  first_name: string;
  last_name: string | null;
}

export default function CreateOccupancyPage() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [personId, setPersonId] = useState("");
  const [occupancyType, setOccupancyType] = useState<OccupancyType>("RESIDENT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const unitsRes = await fetch("/api/v1/units");
        const unitsJson = await unitsRes.json();
        if (unitsJson.success && unitsJson.data.length > 0) {
          setUnits(unitsJson.data);
          setUnitId(unitsJson.data[0].id);
        }

        const supabase = createClient();
        const { data: peopleData, error: peopleError } = await supabase
          .from("person")
          .select("id, first_name, last_name")
          .is("deleted_at", null);

        if (!peopleError && peopleData && peopleData.length > 0) {
          setPeople(peopleData as PersonOption[]);
          setPersonId(peopleData[0].id);
        }
      } catch (err) {
        console.error("Failed to load options:", err);
      }
    };
    loadOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/occupancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unitId,
          person_id: personId,
          occupancy_type: occupancyType,
          start_date: startDate,
          end_date: endDate || null,
          remarks: remarks || null,
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/occupancies");
      } else {
        setError(json.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create occupancy";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Occupancy</h2>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Unit *</label>
              <select
                required
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
              >
                {units.length === 0 ? (
                  <option value="">[ No units found ]</option>
                ) : (
                  units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} ({u.building_code || "Main"})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Occupant (Person) *</label>
              <select
                required
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
              >
                {people.length === 0 ? (
                  <option value="">[ No people found ]</option>
                ) : (
                  people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name || ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Occupancy Type *</label>
              <select
                value={occupancyType}
                onChange={(e) => setOccupancyType(e.target.value as OccupancyType)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
              >
                {OCCUPANCY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
              >
                <option value={Status.ACTIVE}>Active</option>
                <option value={Status.INACTIVE}>Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm h-20"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <button
                type="button"
                onClick={() => router.push("/occupancies")}
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
