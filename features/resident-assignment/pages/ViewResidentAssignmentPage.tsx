"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResidentAssignment } from "../types/resident-assignment.types";
import { useLanguage } from "@/providers/LanguageProvider";

interface ViewResidentAssignmentProps {
  params: Promise<{ id: string }>;
}

export default function ViewResidentAssignmentPage({ params }: ViewResidentAssignmentProps) {
  const router = useRouter();
  const { id } = use(params);
  const { t, language } = useLanguage();
  
  const [assignment, setAssignment] = useState<ResidentAssignment | null>(null);
  const [history, setHistory] = useState<ResidentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/v1/residents/${id}`);
        const json = await res.json();
        if (json.success) {
          setAssignment(json.data);
          
          // Load history
          try {
            const historyRes = await fetch("/api/v1/residents");
            const historyJson = await historyRes.json();
            if (historyJson.success) {
              const matches = (historyJson.data as ResidentAssignment[]).filter(
                (item) => (item.unit_id === json.data.unit_id || item.person_id === json.data.person_id) && item.id !== json.data.id
              );
              setHistory(matches);
            }
          } catch (historyErr) {
            console.error("Error loading assignment history:", historyErr);
          }
        } else {
          setError(json.message);
        }
      } catch (err) {
        console.error("Error loading assignment details:", err);
        setError("Failed to load assignment details.");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleDelete = async () => {
    if (!assignment) return;
    if (!confirm(language === "en" ? "Are you sure you want to archive this assignment?" : "คุณแน่ใจหรือไม่ว่าต้องการเก็บข้อมูลการมอบหมายนี้?")) return;

    try {
      const res = await fetch(`/api/v1/residents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        router.push("/residents");
        router.refresh();
      } else {
        setError(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getPropertyName = (properties: unknown) => {
    if (!properties) return "-";
    const p = properties as { property_name_th: string; property_name_en?: string | null };
    return language === "en" 
      ? p.property_name_en || p.property_name_th 
      : p.property_name_th;
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {t.residentAssignment.details}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === "en" ? "Review unit-resident relationship." : "ตรวจสอบข้อมูลความสัมพันธ์ระหว่างห้องชุดและผู้อยู่อาศัย"}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/residents"
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              {t.common.backToList}
            </Link>
            {assignment && (
              <>
                <Link
                  href={`/residents/${assignment.id}/edit`}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10"
                >
                  {t.common.edit}
                </Link>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition"
                >
                  {t.common.archive}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60">
          {loading ? (
            <div className="text-center py-10 text-slate-500">{t.common.loading}</div>
          ) : error || !assignment ? (
            <div className="p-6 text-center text-red-600">{error || "Assignment not found."}</div>
          ) : (
            <>
              {/* Relationship Flow Diagram */}
              <div className="p-6 bg-slate-50/50 dark:bg-slate-900/10 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
                <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm min-w-[150px]">
                  <span className="block text-xs uppercase font-bold text-slate-400 mb-1">{t.residentAssignment.property}</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {getPropertyName((assignment.unit as Record<string, unknown> | undefined)?.properties)}
                  </span>
                </div>
                <span className="text-slate-300 text-xl hidden sm:block">➔</span>
                <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm min-w-[150px]">
                  <span className="block text-xs uppercase font-bold text-slate-400 mb-1">{t.unit.title}</span>
                  <span className="text-sm font-bold text-[#D4AF37]">
                    {assignment.unit?.unit_number || "-"}
                  </span>
                </div>
                <span className="text-slate-300 text-xl hidden sm:block">➔</span>
                <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm min-w-[150px]">
                  <span className="block text-xs uppercase font-bold text-slate-400 mb-1">{t.person.title}</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {assignment.person?.display_name || `${assignment.person?.first_name} ${assignment.person?.last_name || ""}`}
                  </span>
                </div>
              </div>

              {/* Assignment Details Grid */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.residentName}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {assignment.person?.display_name || `${assignment.person?.first_name} ${assignment.person?.last_name || ""}`}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.unit}
                  </span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    {assignment.unit?.unit_number} (Floor {assignment.unit?.floor})
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.occupancyType}
                  </span>
                  <span className="px-2 py-0.5 rounded font-semibold text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {assignment.occupancy_type}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.primaryResident}
                  </span>
                  <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                    assignment.primary_resident 
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                  }`}>
                    {assignment.primary_resident ? t.residentAssignment.yes : t.residentAssignment.no}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.moveInDate}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {assignment.move_in_date}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.moveOutDate}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {assignment.move_out_date || t.unit.present}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.common.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    assignment.status === "ACTIVE"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}>
                    {assignment.status}
                  </span>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.residentAssignment.remark}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {assignment.remark || "-"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Assignment History */}
        {!loading && assignment && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {language === "en" ? "Related Assignment History" : "ประวัติการมอบหมายที่เกี่ยวข้อง"}
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">
                {language === "en" ? "No history records found." : "ไม่พบประวัติการมอบหมาย"}
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                      <th className="p-3">{t.residentAssignment.unit}</th>
                      <th className="p-3">{t.residentAssignment.residentName}</th>
                      <th className="p-3">{t.residentAssignment.occupancyType}</th>
                      <th className="p-3">{t.residentAssignment.moveInDate}</th>
                      <th className="p-3">{t.residentAssignment.moveOutDate}</th>
                      <th className="p-3">{t.common.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {h.unit?.unit_number || "-"}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {h.person ? h.person.display_name || `${h.person.first_name} ${h.person.last_name || ""}` : "-"}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded font-medium text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {h.occupancy_type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{h.move_in_date}</td>
                        <td className="p-3 text-slate-500">{h.move_out_date || t.unit.present}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            h.status === "ACTIVE"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
