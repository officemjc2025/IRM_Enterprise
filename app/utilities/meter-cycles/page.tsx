/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState, LocalizedDatePicker } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { MeterReadingCycle, MeterReading } from "@/features/reservation/types/stay.types";

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

interface CycleMetrics {
  total: number;
  unread: number;
  review: number;
  approved: number;
  anomaly: number;
  overdue: number;
}

export default function MeterCyclesPage() {
  const { language } = useLanguage();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [cycles, setCycles] = useState<MeterReadingCycle[]>([]);
  const [cycleMetrics, setCycleMetrics] = useState<Record<string, CycleMetrics>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Cycle creation modal / form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [utilityType, setUtilityType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [cycleCode, setCycleCode] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [billingMonth, setBillingMonth] = useState(""); // YYYY-MM
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const initPage = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, property_id")
          .eq("id", user.id)
          .single();

        if (profile) {
          setRole(profile.role);
          
          let propQuery = supabase.from("properties").select("id, property_name_th, property_name_en");
          if (profile.role === "property_admin") {
            if (profile.property_id) {
              propQuery = propQuery.eq("id", profile.property_id);
            } else {
              setLoading(false);
              return;
            }
          }
          const { data: props } = await propQuery;
          if (props && props.length > 0) {
            setProperties(props);
            setSelectedProperty(profile.property_id || props[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, []);

  const fetchCycles = React.useCallback(async () => {
    if (!selectedProperty) return;
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/meter-cycles?property_id=${selectedProperty}`);
      if (!res.ok) {
        const text = await res.text();
        let errMsg = `HTTP error ${res.status}`;
        try {
          const errJson = JSON.parse(text);
          errMsg = errJson.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }

      const json = await res.json();
      if (json.success) {
        const cycleList: MeterReadingCycle[] = json.data || [];
        setCycles(cycleList);

        // Fetch metrics for each cycle
        const metricsMap: Record<string, CycleMetrics> = {};
        for (const cycle of cycleList) {
          const mRes = await fetch(`/api/v1/meter-readings?cycle_id=${cycle.id}`);
          if (!mRes.ok) continue;
          
          const mContentType = mRes.headers.get("content-type") || "";
          if (!mContentType.includes("application/json")) continue;

          const mJson = await mRes.json();
          if (mJson.success) {
            const readings: MeterReading[] = mJson.data || [];
            const isOverdue = new Date() > new Date(cycle.reading_due_date);
            metricsMap[cycle.id] = {
              total: readings.length,
              unread: readings.filter(r => r.status === "PENDING").length,
              review: readings.filter(r => r.status === "REVIEW").length,
              approved: readings.filter(r => r.status === "APPROVED").length,
              anomaly: readings.filter(r => r.anomaly_status !== "NORMAL").length,
              overdue: isOverdue ? readings.filter(r => ["PENDING", "REJECTED"].includes(r.status)).length : 0
            };
          }
        }
        setCycleMetrics(metricsMap);
      } else {
        throw new Error(json.message || "Failed to fetch cycles");
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("relation") && msg.includes("does not exist")) {
        setFetchError(language === "en"
          ? "System Setup Required: Utility operations schema (Migration 030) is not applied. Functional UAT requires sql migration approval."
          : "ระบบต้องการการเตรียมพร้อมข้อมูล: ยังไม่ได้ติดตั้งตารางข้อมูลสาธารณูปโภค (Migration 030) การทดสอบระบบ UAT จำเป็นต้องรอการอนุมัติการย้ายฐานข้อมูล SQL");
      } else {
        setFetchError(language === "en" ? `Failed to load cycles: ${msg}` : `ไม่สามารถโหลดข้อมูลรอบจดมิเตอร์: ${msg}`);
      }
    }
  }, [selectedProperty, language]);

  useEffect(() => {
    if (selectedProperty) {
      fetchCycles();
    }
  }, [selectedProperty, fetchCycles]);

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProperty) return;
    if (!cycleCode || !cycleName || !billingMonth || !startDate || !dueDate) {
      setFormError(language === "en" ? "All fields are required." : "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    try {
      const res = await fetch("/api/v1/meter-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedProperty,
          utility_type: utilityType,
          cycle_code: cycleCode,
          cycle_name: cycleName,
          billing_month: billingMonth,
          reading_start_date: startDate,
          reading_due_date: dueDate
        })
      });

      const json = await res.json();
      if (!json.success) {
        setFormError(json.message);
      } else {
        setShowCreateModal(false);
        setCycleCode("");
        setCycleName("");
        setBillingMonth("");
        setStartDate("");
        setDueDate("");
        fetchCycles();
      }
    } catch (err) {
      console.error("Failed to create meter reading cycle:", err);
      setFormError(language === "en" ? "An error occurred." : "เกิดข้อผิดพลาด");
    }
  };

  const handleOpenCycle = async (cycleId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to open this cycle? This will generate reading tasks for all active unit meters." : "ยืนยันการเปิดรอบจดมิเตอร์นี้หรือไม่? ระบบจะสร้างใบสั่งงานให้กับพนักงานจดมิเตอร์ทุกห้อง")) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/meter-cycles/${cycleId}/open`, {
        method: "POST"
      });
      const json = await res.json();
      if (json.success) {
        fetchCycles();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <LoadingState />
      </MainLayout>
    );
  }

  const isAuthorized = ["super_admin", "admin", "property_admin"].includes(role || "");
  if (!isAuthorized) {
    return (
      <MainLayout>
        <div className="p-6 text-center text-rose-600 font-bold">
          {language === "en" ? "Access Denied: Unprivileged user role" : "ไม่มีสิทธิ์เข้าถึง: บทบาทผู้ใช้ไม่ได้รับอนุญาต"}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <PageHeader
              title={language === "en" ? "Meter Reading Cycles" : "รอบการจดมิเตอร์น้ำ/ไฟ"}
            />
            <p className="text-sm text-slate-500 mt-1">
              {language === "en" ? "Create, open, and track utility meter reading operations." : "สร้าง เปิด และติดตามรอบการทำงานของเจ้าหน้าที่จดบันทึกค่ามิเตอร์"}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition shadow-sm text-sm"
          >
            {language === "en" ? "+ Create Cycle" : "+ สร้างรอบจดมิเตอร์"}
          </button>
        </div>

        {fetchError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{fetchError}</span>
          </div>
        )}

        {/* Property Selector */}
        {properties.length > 1 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {language === "en" ? "Select Property:" : "เลือกโครงการ:"}
            </span>
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-sm font-semibold outline-none"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Cycle List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cycles.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 text-center p-12 bg-white dark:bg-slate-800 rounded-xl border text-slate-400">
              {language === "en" ? "No reading cycles found for this property." : "ไม่พบรอบการจดบันทึกมิเตอร์ในโครงการนี้"}
            </div>
          ) : (
            cycles.map((c) => {
              const metrics = cycleMetrics[c.id] || { total: 0, unread: 0, review: 0, approved: 0, anomaly: 0, overdue: 0 };
              return (
                <div key={c.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">{c.cycle_name}</h4>
                      <span className="text-xs font-mono text-slate-400">{c.cycle_code}</span>
                    </div>
                    {c.utility_type === "WATER" ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-455 border border-blue-100 dark:border-blue-900/30">
                        💧 WATER
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455 border border-amber-100 dark:border-amber-900/30">
                        ⚡ ELEC
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                      <span className="text-slate-400 block text-[10px]">{language === "en" ? "Total" : "ทั้งหมด"}</span>
                      <strong className="text-slate-800 dark:text-slate-200">{metrics.total}</strong>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded">
                      <span className="text-slate-400 block text-[10px]">{language === "en" ? "Unread" : "ยังไม่จด"}</span>
                      <strong className="text-slate-600 dark:text-slate-350">{metrics.unread}</strong>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/10 p-2 rounded">
                      <span className="text-amber-500 block text-[10px]">{language === "en" ? "Review" : "รอตรวจ"}</span>
                      <strong className="text-amber-600 dark:text-amber-455">{metrics.review}</strong>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/10 p-2 rounded">
                      <span className="text-emerald-500 block text-[10px]">{language === "en" ? "Approved" : "อนุมัติ"}</span>
                      <strong className="text-emerald-600 dark:text-emerald-455">{metrics.approved}</strong>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/10 p-2 rounded">
                      <span className="text-rose-500 block text-[10px]">{language === "en" ? "Anomaly" : "ผิดปกติ"}</span>
                      <strong className="text-rose-600 dark:text-rose-455">{metrics.anomaly}</strong>
                    </div>
                    <div className="bg-rose-100/50 dark:bg-rose-950/20 p-2 rounded">
                      <span className="text-rose-600 block text-[10px]">{language === "en" ? "Overdue" : "เลยกำหนด"}</span>
                      <strong className="text-rose-700 dark:text-rose-455">{metrics.overdue}</strong>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t">
                    <div className="flex justify-between">
                      <span>{language === "en" ? "Due Date:" : "วันสิ้นสุดรอบจด:"}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{c.reading_due_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === "en" ? "Billing Month:" : "เดือนบิล:"}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{c.billing_month}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>{language === "en" ? "Status:" : "สถานะ:"}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {c.status}
                      </span>
                    </div>
                  </div>

                  {c.status === "DRAFT" && (
                    <button
                      onClick={() => handleOpenCycle(c.id)}
                      className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs shadow-sm"
                    >
                      🚀 {language === "en" ? "Open Cycle & Generate Tasks" : "เปิดรอบจดบันทึกข้อมูล"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Create Cycle Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? "Create Meter Reading Cycle" : "สร้างรอบจดบันทึกค่ามิเตอร์"}
              </h3>

              <form onSubmit={handleCreateCycle} className="space-y-4 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Utility Type" : "ประเภทมิเตอร์"}</label>
                  <select
                    value={utilityType}
                    onChange={(e) => setUtilityType(e.target.value as "WATER" | "ELECTRICITY")}
                    className="p-2 border rounded dark:bg-slate-900 outline-none font-semibold"
                  >
                    <option value="WATER">{language === "en" ? "WATER" : "ค่าน้ำประปา"}</option>
                    <option value="ELECTRICITY">{language === "en" ? "ELECTRICITY" : "ค่าไฟฟ้า"}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Cycle Code" : "รหัสรอบ (เช่น WATER-2026-07)"}</label>
                  <input
                    type="text"
                    value={cycleCode}
                    onChange={(e) => setCycleCode(e.target.value)}
                    placeholder="e.g. WATER-2026-07"
                    className="p-2 border rounded dark:bg-slate-900 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Cycle Name" : "ชื่อรอบ (ภาษาไทย)"}</label>
                  <input
                    type="text"
                    value={cycleName}
                    onChange={(e) => setCycleName(e.target.value)}
                    placeholder="เช่น รอบจดมิเตอร์น้ำ กรกฎาคม 2569"
                    className="p-2 border rounded dark:bg-slate-900 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Billing Month (YYYY-MM)" : "เดือนรอบบิล (YYYY-MM)"}</label>
                  <input
                    type="month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="p-2 border rounded dark:bg-slate-900 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <LocalizedDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    locale={language}
                    label={language === "en" ? "Start Date" : "วันที่เริ่มจด"}
                    required
                  />
                  <LocalizedDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    locale={language}
                    label={language === "en" ? "Due Date" : "กำหนดส่งงาน"}
                    required
                  />
                </div>

                {formError && (
                  <div className="p-2 bg-rose-50 text-rose-600 font-semibold rounded">
                    ⚠️ {formError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50 transition font-semibold"
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition"
                  >
                    {language === "en" ? "Create Draft" : "สร้างรอบร่าง"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
