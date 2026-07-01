"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Unit } from "../types/unit.types";
import { Occupancy } from "@/features/occupancy/types/occupancy.types";
import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader } from "@/shared/ui";

interface ViewUnitProps {
  params: Promise<{ id: string }>;
}

export default function ViewUnitPage({ params }: ViewUnitProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { id } = use(params);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [residents, setResidents] = useState<ResidentAssignment[]>([]);
  
  const [loadingUnit, setLoadingUnit] = useState(true);
  const [loadingOccs, setLoadingOccs] = useState(true);
  const [loadingResidents, setLoadingResidents] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUnit = async () => {
      try {
        setLoadingUnit(true);
        const res = await fetch(`/api/v1/units/${id}`);
        const json = await res.json();
        if (json.success) {
          setUnit(json.data);
        } else {
          setError(json.message);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load unit";
        setError(message);
      } finally {
        setLoadingUnit(false);
      }
    };

    const fetchOccupancies = async () => {
      try {
        setLoadingOccs(true);
        const res = await fetch(`/api/v1/units/${id}/occupancies`);
        const json = await res.json();
        if (json.success) {
          setOccupancies(json.data);
        }
      } catch (err) {
        console.error("Failed to load occupancies:", err);
      } finally {
        setLoadingOccs(false);
      }
    };

    const fetchResidents = async () => {
      try {
        setLoadingResidents(true);
        const res = await fetch("/api/v1/residents");
        const json = await res.json();
        if (json.success) {
          const activeResidents = (json.data as ResidentAssignment[]).filter(
            (r) => r.unit_id === id && r.status === "ACTIVE"
          );
          setResidents(activeResidents);
        }
      } catch (err) {
        console.error("Failed to load unit residents:", err);
      } finally {
        setLoadingResidents(false);
      }
    };

    queueMicrotask(() => {
      fetchUnit();
      fetchOccupancies();
      fetchResidents();
    });
  }, [id]);

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title={t.unit.details} />
          <button
            onClick={() => router.push("/units")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm transition"
          >
            {t.common.backToDirectory}
          </button>
        </div>

        {error ? (
          <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        ) : loadingUnit ? (
          <div className="p-12 text-center text-slate-500">{t.common.loading}</div>
        ) : (
          unit && (
            <div className="space-y-6">
              {/* Unit Info Card */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
                <h3 className="text-base font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
                  {t.unit.unitInfo}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.unit.unitNumber}</span>
                    <span className="text-sm font-semibold font-mono text-slate-800 dark:text-slate-200">{unit.unit_number}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.unit.buildingCode}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{unit.building_code || "-"}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.unit.floor}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{unit.floor}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.unit.area}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{unit.area} sqm</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.unit.ownershipRatio}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{(unit.ownership_ratio * 100).toFixed(4)}%</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{t.common.status}</span>
                    <span className="block mt-0.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          unit.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {unit.status}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Occupancy and Assigned Persons */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
                <h3 className="text-base font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
                  {t.unit.currentOccupancy}
                </h3>
                {loadingOccs ? (
                  <div className="text-center text-xs text-slate-500 py-4">{t.unit.loadingOccupancies}</div>
                ) : occupancies.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-6">{t.unit.noOccupants}</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {occupancies.map((o) => (
                      <div key={o.id} className="py-3 flex justify-between items-center text-sm">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {o.person ? `${o.person.first_name} ${o.person.last_name || ""}` : "Unknown"}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {t.unit.period}: {o.start_date} to {o.end_date || t.unit.present}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                            {o.occupancy_type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              o.status === "ACTIVE"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Residents Section */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
                <h3 className="text-base font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
                  {language === "en" ? "Active Residents" : "ผู้อยู่อาศัยที่ใช้งานอยู่"}
                </h3>
                {loadingResidents ? (
                  <div className="text-center text-xs text-slate-500 py-4">{t.common.loading}</div>
                ) : residents.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-6">
                    {language === "en" ? "No active residents assigned to this unit." : "ไม่มีผู้อยู่อาศัยที่เปิดใช้งานในยูนิตนี้"}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {residents.map((r) => (
                      <div key={r.id} className="py-3 flex justify-between items-center text-sm">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {r.person ? r.person.display_name || `${r.person.first_name} ${r.person.last_name || ""}` : "Unknown"}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {language === "en" ? "Period" : "ระยะเวลา"}: {r.move_in_date} to {r.move_out_date || t.unit.present}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                            {r.occupancy_type}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                            r.primary_resident 
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                          }`}>
                            {r.primary_resident ? (language === "en" ? "Primary" : "หลัก") : (language === "en" ? "General" : "ทั่วไป")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </MainLayout>
  );
}
