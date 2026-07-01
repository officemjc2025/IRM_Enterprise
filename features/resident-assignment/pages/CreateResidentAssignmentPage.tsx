"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";
import { RESIDENT_OCCUPANCY_TYPES } from "../types/resident-assignment.types";
import { Unit } from "@/features/unit/types/unit.types";
import { Person } from "@/features/person/types/person.types";
import { useLanguage } from "@/providers/LanguageProvider";

export default function CreateResidentAssignmentPage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [units, setUnits] = useState<Unit[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [unitId, setUnitId] = useState("");
  const [personId, setPersonId] = useState("");
  const [occupancyType, setOccupancyType] = useState("RESIDENT");
  const [primaryResident, setPrimaryResident] = useState(false);
  const [moveInDate, setMoveInDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [moveOutDate, setMoveOutDate] = useState("");
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [unitsRes, peopleRes] = await Promise.all([
          fetch("/api/v1/units"),
          fetch("/api/v1/persons")
        ]);
        const unitsJson = await unitsRes.json();
        const peopleJson = await peopleRes.json();

        if (unitsJson.success && unitsJson.data.length > 0) {
          setUnits(unitsJson.data);
          setUnitId(unitsJson.data[0].id);
        }

        if (peopleJson.success && peopleJson.data.length > 0) {
          setPeople(peopleJson.data);
          setPersonId(peopleJson.data[0].id);
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
      const res = await fetch("/api/v1/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: unitId,
          person_id: personId,
          occupancy_type: occupancyType,
          primary_resident: primaryResident,
          move_in_date: moveInDate,
          move_out_date: moveOutDate || null,
          remark: remark || null,
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/residents");
        router.refresh();
      } else {
        setError(json.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to assign resident";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            {t.residentAssignment.create}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "en" ? "Assign a person as a resident to a unit." : "บันทึกข้อมูลการมอบหมายผู้อยู่อาศัยเข้าสู่ห้องชุด"}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Resident / Person */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.residentAssignment.residentName}
              </label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
                required
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || `${p.first_name} ${p.last_name || ""}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.residentAssignment.unit}
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
                required
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number} (Floor {u.floor})
                  </option>
                ))}
              </select>
            </div>

            {/* Occupancy Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.residentAssignment.occupancyType}
              </label>
              <select
                value={occupancyType}
                onChange={(e) => setOccupancyType(e.target.value)}
                className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
              >
                {RESIDENT_OCCUPANCY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Resident */}
            <div className="flex items-center gap-2 py-2">
              <input
                id="primaryResident"
                type="checkbox"
                checked={primaryResident}
                onChange={(e) => setPrimaryResident(e.target.checked)}
                className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-slate-300 rounded cursor-pointer"
              />
              <label htmlFor="primaryResident" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer">
                {t.residentAssignment.primaryResident}
              </label>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t.residentAssignment.moveInDate}
                </label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t.residentAssignment.moveOutDate}
                </label>
                <input
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.common.status}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
              >
                <option value="ACTIVE">{t.common.active}</option>
                <option value="INACTIVE">{t.common.inactive}</option>
              </select>
            </div>

            {/* Remark */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.residentAssignment.remark}
              </label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none resize-y min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => router.push("/residents")}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 disabled:opacity-50 transition"
              >
                {loading ? t.common.processing : t.common.save}
              </button>
            </div>
          </form>
        </div>
      </div>
    </MainLayout>
  );
}
