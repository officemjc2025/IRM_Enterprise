"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Person } from "../types/person.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader } from "@/shared/ui";
import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";
import { Unit } from "@/features/unit/types/unit.types";

interface UnitWithProperties extends Unit {
  properties?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
  } | null;
}

interface ViewPersonProps {
  params: Promise<{ id: string }>;
}

export default function ViewPersonPage({ params }: ViewPersonProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [units, setUnits] = useState<ResidentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPerson = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/persons/${id}`);
        const json = await res.json();
        if (json.success) {
          setPerson(json.data);
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

    const fetchUnits = async () => {
      try {
        setLoadingUnits(true);
        const res = await fetch("/api/v1/residents");
        const json = await res.json();
        if (json.success) {
          const activeUnits = (json.data as ResidentAssignment[]).filter(
            (r) => r.person_id === id && r.status === "ACTIVE"
          );
          setUnits(activeUnits);
        }
      } catch (err) {
        console.error("Failed to load current units for person:", err);
      } finally {
        setLoadingUnits(false);
      }
    };

    queueMicrotask(() => {
      fetchPerson();
      fetchUnits();
    });
  }, [id]);

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title={t.common.details || "Person Details"} />
          <button
            onClick={() => router.push("/persons")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm transition"
          >
            {t.common.backToDirectory}
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">{t.common.loading}</div>
        ) : error ? (
          <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm w-full">
            {error}
          </div>
        ) : (
          person && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center gap-4 w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 pb-6 md:pb-0 md:pr-6">
                {person.photo ? (
                  <img
                    src={person.photo}
                    alt={person.display_name || person.first_name}
                    className="w-32 h-32 rounded-full object-cover shadow"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-4xl text-slate-500 shadow">
                    {person.first_name[0]}
                  </div>
                )}
                <div className="text-center">
                  <h3 className="font-semibold text-lg">
                    {person.title ? `${person.title} ` : ""}
                    {person.first_name} {person.last_name}
                  </h3>
                  <p className="text-sm text-slate-400 font-mono mt-1">{person.person_code || "No Code"}</p>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.person.displayName}</span>
                  <span className="col-span-2 text-sm">{person.display_name || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Gender</span>
                  <span className="col-span-2 text-sm">{person.gender || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Date of Birth</span>
                  <span className="col-span-2 text-sm">{person.date_of_birth || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Nationality</span>
                  <span className="col-span-2 text-sm">{person.nationality || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.common.phone}</span>
                  <span className="col-span-2 text-sm">{person.phone || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.common.email}</span>
                  <span className="col-span-2 text-sm">{person.email || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">ID Card</span>
                  <span className="col-span-2 text-sm font-mono">{person.id_card || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">Passport No.</span>
                  <span className="col-span-2 text-sm font-mono">{person.passport || "-"}</span>
                </div>
                <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="font-semibold text-slate-500 text-sm">{t.common.status}</span>
                  <span className="col-span-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        person.status === "ACTIVE"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {person.status}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {/* Current Units Section */}
        {!loading && person && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
              {language === "en" ? "Current Units" : "ยูนิตปัจจุบัน"}
            </h3>
            {loadingUnits ? (
              <div className="text-center text-xs text-slate-500 py-4">{t.common.loading}</div>
            ) : units.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-6">
                {language === "en" ? "No current units assigned." : "ไม่มีข้อมูลยูนิตปัจจุบัน"}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {units.map((u) => {
                  const unitWithProps = u.unit as UnitWithProperties | null | undefined;
                  return (
                    <div key={u.id} className="py-3 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                          {u.unit?.unit_number || "-"}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {unitWithProps?.properties ? (language === "en" ? (unitWithProps.properties.property_name_en || unitWithProps.properties.property_name_th) : unitWithProps.properties.property_name_th) : "-"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                          {u.occupancy_type}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          u.primary_resident 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                        }`}>
                          {u.primary_resident ? (language === "en" ? "Primary" : "หลัก") : (language === "en" ? "General" : "ทั่วไป")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
