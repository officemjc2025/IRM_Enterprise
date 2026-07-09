/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { MeterReading, UtilityControlType, MeterReadingCycle, UtilityMeter } from "@/features/reservation/types/stay.types";

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

interface UnitOption {
  id: string;
  unit_number: string;
  water_control_status: UtilityControlType;
  electricity_control_status: UtilityControlType;
}

const supabase = createClient();

export default function MeterReadingsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [cycles, setCycles] = useState<MeterReadingCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("ALL");
  const [readings, setReadings] = useState<MeterReading[]>([]);
  
  // Tab states for Admin
  const [adminTab, setAdminTab] = useState<"review" | "all" | "control" | "replacement">("review");

  // Units list for Control and Replacement tabs
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [activeMeters, setActiveMeters] = useState<UtilityMeter[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modal / Form States
  const [selectedReading, setSelectedReading] = useState<MeterReading | null>(null);
  const [currentReadingInput, setCurrentReadingInput] = useState("");
  const [techNote, setTechNote] = useState("");
  const [isAnomalyFlagged, setIsAnomalyFlagged] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Return / Reject Modal States
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnNote, setReturnNote] = useState("");

  // Utility Control Status Modal State
  const [selectedUnit, setSelectedUnit] = useState<UnitOption | null>(null);
  const [controlType, setControlType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [newControlStatus, setNewControlStatus] = useState<UtilityControlType>("NORMAL");
  const [controlReason, setControlReason] = useState("");

  // Meter Replacement Modal State
  const [selectedMeter, setSelectedMeter] = useState<UtilityMeter | null>(null);
  const [newMeterNumber, setNewMeterNumber] = useState("");
  const [startingReading, setStartingReading] = useState("");
  const [finalReading, setFinalReading] = useState("");
  const [replacementReason, setReplacementReason] = useState("");

  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, property_id")
          .eq("id", user.id)
          .single();

        if (profile) {
          setRole(profile.role);
          if (profile.role === "technician") {
            router.replace("/meter-reading");
            return;
          } else {
            router.replace("/meter-management");
            return;
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, [router]);

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
        setCycles(json.data || []);
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

  const fetchReadings = React.useCallback(async () => {
    if (!selectedProperty) return;
    setFetchError(null);
    try {
      let url = `/api/v1/meter-readings?property_id=${selectedProperty}`;
      if (selectedCycle !== "ALL") {
        url += `&cycle_id=${selectedCycle}`;
      }
      const res = await fetch(url);
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
        let list: MeterReading[] = json.data || [];
        if (role === "technician") {
          list = list.filter(r => ["PENDING", "REJECTED"].includes(r.status));
        }
        setReadings(list);
      } else {
        throw new Error(json.message || "Failed to fetch readings");
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("relation") && msg.includes("does not exist")) {
        setFetchError(language === "en"
          ? "System Setup Required: Utility operations schema (Migration 030) is not applied. Functional UAT requires sql migration approval."
          : "ระบบต้องการการเตรียมพร้อมข้อมูล: ยังไม่ได้ติดตั้งตารางข้อมูลสาธารณูปโภค (Migration 030) การทดสอบระบบ UAT จำเป็นต้องรอการอนุมัติการย้ายฐานข้อมูล SQL");
      } else {
        setFetchError(language === "en" ? `Failed to load readings: ${msg}` : `ไม่สามารถโหลดข้อมูลจดมิเตอร์: ${msg}`);
      }
    }
  }, [selectedProperty, selectedCycle, role, language]);

  const fetchUnitsAndMeters = React.useCallback(async () => {
    if (!selectedProperty) return;
    try {
      // Fetch Units
      const { data: unitList } = await supabase
        .from("units")
        .select("id, unit_number, water_control_status, electricity_control_status")
        .eq("property_id", selectedProperty)
        .order("unit_number", { ascending: true });
      if (unitList) setUnits(unitList as UnitOption[]);

      // Fetch active meters
      const { data: meterList } = await supabase
        .from("utility_meters")
        .select("*, unit:units ( id, unit_number )")
        .eq("property_id", selectedProperty)
        .eq("meter_status", "ACTIVE");
      if (meterList) setActiveMeters(meterList as UtilityMeter[]);
    } catch (err) {
      console.error(err);
    }
  }, [selectedProperty]);

  useEffect(() => {
    if (selectedProperty) {
      fetchCycles();
      fetchReadings();
      if (role !== "technician") {
        fetchUnitsAndMeters();
      }
    }
  }, [selectedProperty, selectedCycle, role, adminTab, fetchCycles, fetchReadings, fetchUnitsAndMeters]);

  const handlePhotoUpload = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `meters/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("work-orders")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("work-orders")
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      console.error("Photo upload failed:", err);
      return null;
    }
  };

  const handleReadingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setSubmitting(true);

    if (!selectedReading) return;
    const prevVal = Number(selectedReading.previous_reading);
    const currVal = Number(currentReadingInput);

    if (isNaN(currVal)) {
      setModalError(language === "en" ? "Please enter a valid reading number." : "กรุณากรอกตัวเลขมิเตอร์ที่ถูกต้อง");
      setSubmitting(false);
      return;
    }

    if (currVal < prevVal) {
      setModalError(language === "en" ? `Current reading cannot be less than previous reading (${prevVal.toLocaleString()})` : `เลขมิเตอร์ครั้งปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน (${prevVal.toLocaleString()})`);
      setSubmitting(false);
      return;
    }

    try {
      let uploadedUrl: string | null = null;
      if (photoFile) {
        uploadedUrl = await handlePhotoUpload(photoFile);
        if (!uploadedUrl) {
          setModalError(language === "en" ? "Failed to upload meter photo evidence." : "อัปโหลดรูปภาพมิเตอร์ไม่สำเร็จ");
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch(`/api/v1/meter-readings/${selectedReading.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_reading: currVal,
          photo_url: uploadedUrl,
          technician_note: techNote,
          is_anomaly_flagged: isAnomalyFlagged
        })
      });

      const json = await res.json();
      if (json.success) {
        setSelectedReading(null);
        setCurrentReadingInput("");
        setTechNote("");
        setIsAnomalyFlagged(false);
        setPhotoFile(null);
        fetchReadings();
      } else {
        setModalError(json.message);
      }
    } catch (err) {
      console.error("Failed to submit meter reading:", err);
      setModalError(language === "en" ? "An error occurred during submission." : "เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReading = async (readingId: string) => {
    if (!confirm(language === "en" ? "Approve this meter reading and synchronize charges?" : "ยืนยันอนุมัติและบันทึกค่าน้ำ/ไฟในระบบรอบบิลหรือไม่?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/meter-readings/${readingId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_note: "Approved by manager" })
      });
      const json = await res.json();
      if (json.success) {
        fetchReadings();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReturnReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReading || !returnNote) return;

    try {
      const res = await fetch(`/api/v1/meter-readings/${selectedReading.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_note: returnNote })
      });
      const json = await res.json();
      if (json.success) {
        setShowReturnModal(false);
        setSelectedReading(null);
        setReturnNote("");
        fetchReadings();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleControlStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !controlReason) return;

    try {
      const res = await fetch(`/api/v1/units/${selectedUnit.id}/utility-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utility_type: controlType,
          status: newControlStatus,
          reason: controlReason
        })
      });

      const json = await res.json();
      if (json.success) {
        setSelectedUnit(null);
        setControlReason("");
        fetchUnitsAndMeters();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMeterReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeter || !newMeterNumber || !startingReading || !replacementReason) return;

    try {
      const res = await fetch(`/api/v1/utility-meters/${selectedMeter.id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_meter_number: newMeterNumber,
          starting_reading: Number(startingReading),
          final_reading: finalReading ? Number(finalReading) : null,
          replacement_reason: replacementReason
        })
      });

      const json = await res.json();
      if (json.success) {
        setSelectedMeter(null);
        setNewMeterNumber("");
        setStartingReading("");
        setFinalReading("");
        setReplacementReason("");
        fetchUnitsAndMeters();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderWarningBanner = (status: UtilityControlType, label: string) => {
    if (status === "RESTRICTED_NO_RECONNECT") {
      return (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-2 animate-pulse">
          🚨 {language === "en" ? `RESTRICTED: DO NOT RECONNECT ${label} WITHOUT AUTHORIZATION` : `ประกาศเตือน: ห้ามเปิด ${label} โดยไม่ได้รับอนุมัติโดยเด็ดขาด!`}
        </div>
      );
    }
    if (status === "SHUT_OFF") {
      return (
        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-xl">
          ⚠️ {language === "en" ? `${label} is currently SHUT OFF` : `สถานะ: ปิด ${label} อยู่`}
        </div>
      );
    }
    return null;
  };

  const translateControlStatus = (status: UtilityControlType) => {
    switch (status) {
      case "NORMAL": return language === "en" ? "Normal" : "ปกติ";
      case "SHUTOFF_REQUESTED": return language === "en" ? "Shutoff Requested" : "แจ้งปิด";
      case "SHUT_OFF": return language === "en" ? "Shut Off" : "ปิดบริการแล้ว";
      case "RECONNECT_REQUESTED": return language === "en" ? "Reconnect Requested" : "แจ้งเปิด";
      case "RESTRICTED_NO_RECONNECT": return language === "en" ? "Restricted: Do Not Reconnect" : "ห้ามเปิดโดยไม่ได้รับอนุมัติ";
      default: return status;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <LoadingState />
      </MainLayout>
    );
  }

  const isTechnician = role === "technician";

  return (
    <MainLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div>
          <PageHeader
            title={isTechnician ? (language === "en" ? "Meter Reading Jobs" : "งานจดบันทึกมิเตอร์น้ำ/ไฟ") : (language === "en" ? "Utility Readings Operations" : "งานตรวจสอบและจัดการมิเตอร์")}
          />
          <p className="text-sm text-slate-500 mt-1">
            {language === "en" ? "Execute, review, and verify unit utility consumption readings." : "จดบันทึก ตรวจสอบความถูกต้อง และอนุมัติการใช้งานค่าน้ำ/ค่าไฟของห้องพัก"}
          </p>
        </div>

        {fetchError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{fetchError}</span>
          </div>
        )}

        {/* Property & Cycle filters */}
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            {properties.length > 1 && (
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-sm font-semibold outline-none"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-sm font-semibold outline-none"
            >
              <option value="ALL">{language === "en" ? "ALL CYCLES" : "ทุกรอบจดมิเตอร์"}</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.cycle_name}</option>
              ))}
            </select>
          </div>

          {!isTechnician && (
            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setAdminTab("review")}
                className={`px-3 py-1.5 rounded-lg transition ${adminTab === "review" ? "bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
              >
                {language === "en" ? "Review Queue" : "รอตรวจสอบ"}
              </button>
              <button
                onClick={() => setAdminTab("all")}
                className={`px-3 py-1.5 rounded-lg transition ${adminTab === "all" ? "bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
              >
                {language === "en" ? "All Readings" : "ประวัติทั้งหมด"}
              </button>
              <button
                onClick={() => setAdminTab("control")}
                className={`px-3 py-1.5 rounded-lg transition ${adminTab === "control" ? "bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
              >
                {language === "en" ? "Utility Control" : "เปิด/ปิดน้ำไฟ"}
              </button>
              <button
                onClick={() => setAdminTab("replacement")}
                className={`px-3 py-1.5 rounded-lg transition ${adminTab === "replacement" ? "bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-white" : "text-slate-500"}`}
              >
                {language === "en" ? "Meter Replacement" : "เปลี่ยนมิเตอร์"}
              </button>
            </div>
          )}
        </div>

        {/* Technician Mode */}
        {isTechnician && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {readings.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 text-center p-12 bg-white dark:bg-slate-800 border text-slate-400 rounded-xl">
                {language === "en" ? "No pending meter reading tasks assigned." : "ไม่มีงานจดบันทึกมิเตอร์ที่ต้องดำเนินการ"}
              </div>
            ) : (
              readings.map((r) => (
                <div key={r.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3 hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">{r.cycle?.cycle_name}</span>
                      <strong className="text-lg text-slate-800 dark:text-white">Unit {r.unit?.unit_number}</strong>
                    </div>
                    {r.utility_type === "WATER" ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-455 border border-blue-100 dark:border-blue-900/30">
                        💧 WATER
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-455 border border-amber-100 dark:border-amber-900/30">
                        ⚡ ELEC
                      </span>
                    )}
                  </div>

                  {/* Utility Control Warns */}
                  {r.utility_type === "WATER" && r.unit && renderWarningBanner(r.unit.water_control_status, language === "en" ? "Water" : "ค่าน้ำ")}
                  {r.utility_type === "ELECTRICITY" && r.unit && renderWarningBanner(r.unit.electricity_control_status, language === "en" ? "Electricity" : "ค่าไฟ")}

                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>{language === "en" ? "Meter Number:" : "เลขมิเตอร์:"}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{r.meter?.meter_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === "en" ? "Previous Reading:" : "เลขจดครั้งก่อน:"}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{Number(r.previous_reading).toLocaleString()}</span>
                    </div>
                    {r.status === "REJECTED" && (
                      <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 font-bold rounded">
                        {language === "en" ? `Returned: ${r.manager_note}` : `ส่งกลับแก้ไข: ${r.manager_note}`}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedReading(r);
                      setCurrentReadingInput("");
                      setTechNote("");
                      setIsAnomalyFlagged(false);
                      setPhotoFile(null);
                      setModalError(null);
                    }}
                    className="w-full py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition text-xs shadow-sm"
                  >
                    📝 {language === "en" ? "Enter Reading" : "จดบันทึกค่ามิเตอร์"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Admin Mode - Review Queue */}
        {!isTechnician && adminTab === "review" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4">{language === "en" ? "Unit" : "ห้องชุด"}</th>
                    <th className="p-4">{language === "en" ? "Utility Type" : "ประเภท"}</th>
                    <th className="p-4">{language === "en" ? "Prev Reading" : "ครั้งก่อน"}</th>
                    <th className="p-4">{language === "en" ? "Current Reading" : "ครั้งนี้"}</th>
                    <th className="p-4">{language === "en" ? "Usage" : "หน่วยที่ใช้"}</th>
                    <th className="p-4">{language === "en" ? "Amount" : "ยอดเงินคำนวณ"}</th>
                    <th className="p-4">{language === "en" ? "Anomaly Status" : "ความผิดปกติ"}</th>
                    <th className="p-4 text-right">{language === "en" ? "Actions" : "อนุมัติ/จัดการ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {readings.filter(r => r.status === "REVIEW").length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        {language === "en" ? "No readings waiting for review." : "ไม่มีข้อมูลมิเตอร์ค้างอนุมัติ"}
                      </td>
                    </tr>
                  ) : (
                    readings.filter(r => r.status === "REVIEW").map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                        <td className="p-4 font-bold text-slate-800 dark:text-white">Unit {r.unit?.unit_number}</td>
                        <td className="p-4">
                          {r.utility_type === "WATER" ? (
                            <span className="text-blue-600 dark:text-blue-455 font-semibold">💧 {language === "en" ? "WATER" : "ค่าน้ำ"}</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-455 font-semibold">⚡ {language === "en" ? "ELEC" : "ค่าไฟ"}</span>
                          )}
                        </td>
                        <td className="p-4 font-mono">{Number(r.previous_reading).toLocaleString()}</td>
                        <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200">{Number(r.current_reading).toLocaleString()}</td>
                        <td className="p-4 font-mono font-bold">{Number(r.usage_units).toLocaleString()} {language === "en" ? "units" : "หน่วย"}</td>
                        <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-100">{Number(r.calculated_amount).toFixed(2)} ฿</td>
                        <td className="p-4">
                          {r.anomaly_status !== "NORMAL" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 border border-rose-100 dark:border-rose-900/30">
                              ⚠️ {r.anomaly_reason || r.anomaly_status}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-455 border border-emerald-100 dark:border-emerald-900/30">
                              ✓ Normal
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedReading(r);
                              setCurrentReadingInput("");
                              setTechNote("");
                              setIsAnomalyFlagged(false);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded text-xs font-semibold transition"
                          >
                            🔎 {language === "en" ? "View Details" : "ดูข้อมูลเพิ่ม"}
                          </button>
                          <button
                            onClick={() => handleApproveReading(r.id)}
                            className="px-3 py-1 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded text-xs transition"
                          >
                            ✓ {language === "en" ? "Approve" : "อนุมัติ"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admin Mode - All Readings history */}
        {!isTechnician && adminTab === "all" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4">{language === "en" ? "Billing Cycle" : "รอบบิล"}</th>
                    <th className="p-4">{language === "en" ? "Unit" : "ห้องชุด"}</th>
                    <th className="p-4">{language === "en" ? "Utility Type" : "ประเภท"}</th>
                    <th className="p-4">{language === "en" ? "Prev Reading" : "ครั้งก่อน"}</th>
                    <th className="p-4">{language === "en" ? "Current Reading" : "ครั้งนี้"}</th>
                    <th className="p-4">{language === "en" ? "Usage" : "หน่วยที่ใช้"}</th>
                    <th className="p-4">{language === "en" ? "Amount" : "ยอดเงิน"}</th>
                    <th className="p-4">{language === "en" ? "Status" : "สถานะจด"}</th>
                    <th className="p-4">{language === "en" ? "Billing Sync" : "การซิงค์รอบบัญชี"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {readings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400">
                        {language === "en" ? "No meter readings found." : "ไม่พบประวัติการจดมิเตอร์"}
                      </td>
                    </tr>
                  ) : (
                    readings.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                        <td className="p-4">{r.cycle?.cycle_name}</td>
                        <td className="p-4 font-bold text-slate-800 dark:text-white">Unit {r.unit?.unit_number}</td>
                        <td className="p-4 font-semibold text-slate-600 dark:text-slate-400">{r.utility_type}</td>
                        <td className="p-4 font-mono">{Number(r.previous_reading).toLocaleString()}</td>
                        <td className="p-4 font-mono">{r.current_reading ? Number(r.current_reading).toLocaleString() : "-"}</td>
                        <td className="p-4 font-mono">{r.usage_units ? `${Number(r.usage_units).toLocaleString()} หน่วย` : "-"}</td>
                        <td className="p-4 font-mono">{r.calculated_amount ? `${Number(r.calculated_amount).toFixed(2)} ฿` : "-"}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {r.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {r.sync_status === "SYNCED" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-600 border border-emerald-200">
                              ✓ SYNCED (ซิงค์แล้ว)
                            </span>
                          )}
                          {r.sync_status === "PENDING_PERIOD" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-600 border border-amber-200">
                              ⏳ PENDING PERIOD
                            </span>
                          )}
                          {r.sync_status === "NOT_APPLICABLE" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-50 text-slate-500 border border-slate-200">
                              NA (ไม่มีการเข้าพักแบบพาณิชย์)
                            </span>
                          )}
                          {r.sync_status === "SYNC_FAILED" && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-600 border border-rose-200">
                              ⚠️ FAILED (ล้มเหลว)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Admin Mode - Utility Control Status */}
        {!isTechnician && adminTab === "control" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
              {language === "en" ? "Utility Control Status by Unit" : "สถานะควบคุมบริการน้ำประปาและไฟฟ้าแยกตามห้องชุด"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map((u) => (
                <div key={u.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow transition space-y-3">
                  <div className="flex justify-between items-center">
                    <strong className="text-slate-800 dark:text-white text-base">Unit {u.unit_number}</strong>
                  </div>
                  
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span>{language === "en" ? "Water Control:" : "ระบบน้ำประปา:"}</span>
                      <button
                        onClick={() => {
                          setSelectedUnit(u);
                          setControlType("WATER");
                          setNewControlStatus(u.water_control_status);
                          setControlReason("");
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition ${u.water_control_status === "RESTRICTED_NO_RECONNECT" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"}`}
                      >
                        {translateControlStatus(u.water_control_status)} ⚙️
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>{language === "en" ? "Electricity Control:" : "ระบบไฟฟ้า:"}</span>
                      <button
                        onClick={() => {
                          setSelectedUnit(u);
                          setControlType("ELECTRICITY");
                          setNewControlStatus(u.electricity_control_status);
                          setControlReason("");
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition ${u.electricity_control_status === "RESTRICTED_NO_RECONNECT" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"}`}
                      >
                        {translateControlStatus(u.electricity_control_status)} ⚙️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Mode - Meter Replacement */}
        {!isTechnician && adminTab === "replacement" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
              {language === "en" ? "Physical Meter Replacements & Upgrades" : "การจัดการเปลี่ยนอุปกรณ์มิเตอร์น้ำประปาและเครื่องวัดไฟฟ้า"}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-4">{language === "en" ? "Unit" : "ห้องชุด"}</th>
                    <th className="p-4">{language === "en" ? "Utility Type" : "ประเภท"}</th>
                    <th className="p-4">{language === "en" ? "Active Meter Number" : "หมายเลขมิเตอร์ปัจจุบัน"}</th>
                    <th className="p-4">{language === "en" ? "Installed Date" : "วันที่เริ่มใช้งาน"}</th>
                    <th className="p-4 text-right">{language === "en" ? "Actions" : "ดำเนินการ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {activeMeters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        {language === "en" ? "No active meters found." : "ไม่พบมิเตอร์ในโครงการนี้"}
                      </td>
                    </tr>
                  ) : (
                    activeMeters.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                        <td className="p-4 font-bold text-slate-800 dark:text-white">Unit {m.unit?.unit_number}</td>
                        <td className="p-4 font-semibold">{m.utility_type}</td>
                        <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-350">{m.meter_number}</td>
                        <td className="p-4">{m.installed_at}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedMeter(m);
                              setNewMeterNumber("");
                              setStartingReading("");
                              setFinalReading("");
                              setReplacementReason("");
                            }}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition"
                          >
                            🔄 {language === "en" ? "Replace Meter" : "เปลี่ยนอุปกรณ์ใหม่"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Technician Entry Modal */}
        {selectedReading && isTechnician && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? "Submit Meter Reading" : "จดบันทึกค่ามิเตอร์"}
              </h3>

              <form onSubmit={handleReadingSubmit} className="space-y-4 text-xs">
                {/* Warnings */}
                {selectedReading.utility_type === "WATER" && selectedReading.unit && renderWarningBanner(selectedReading.unit.water_control_status, language === "en" ? "Water" : "ค่าน้ำ")}
                {selectedReading.utility_type === "ELECTRICITY" && selectedReading.unit && renderWarningBanner(selectedReading.unit.electricity_control_status, language === "en" ? "Electricity" : "ค่าไฟ")}

                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === "en" ? "Unit Number" : "ห้องชุด"}</span>
                    <strong className="text-sm font-bold text-slate-800 dark:text-white">Unit {selectedReading.unit?.unit_number}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === "en" ? "Meter Number" : "เลขมิเตอร์"}</span>
                    <strong className="text-sm font-mono text-slate-800 dark:text-slate-200">{selectedReading.meter?.meter_number}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === "en" ? "Previous Reading" : "เลขครั้งก่อน"}</span>
                    <strong className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{Number(selectedReading.previous_reading).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === "en" ? "Usage Preview" : "หน่วยที่ใช้ (พรีวิว)"}</span>
                    <strong className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-455">
                      {currentReadingInput && !isNaN(Number(currentReadingInput)) && Number(currentReadingInput) >= Number(selectedReading.previous_reading)
                        ? `${(Number(currentReadingInput) - Number(selectedReading.previous_reading)).toLocaleString()} หน่วย`
                        : "-"}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Current Reading Value" : "เลขมิเตอร์จดครั้งปัจจุบัน"}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentReadingInput}
                    onChange={(e) => setCurrentReadingInput(e.target.value)}
                    placeholder="ป้อนตัวเลขครั้งนี้"
                    className="p-2 border rounded dark:bg-slate-900 outline-none font-mono text-base font-bold text-slate-800 dark:text-white"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Meter Photo Evidence" : "ถ่ายรูปภาพหน้าจอมิเตอร์"}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                    className="p-1 border rounded dark:bg-slate-900 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Notes" : "หมายเหตุการจดบันทึก"}</label>
                  <textarea
                    value={techNote}
                    onChange={(e) => setTechNote(e.target.value)}
                    placeholder={language === "en" ? "Enter notes (optional)" : "ป้อนหมายเหตุเพิ่มเติม (ถ้ามี)"}
                    className="p-2 border rounded dark:bg-slate-900 outline-none h-16"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="anomalyCheckbox"
                    checked={isAnomalyFlagged}
                    onChange={(e) => setIsAnomalyFlagged(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="anomalyCheckbox" className="font-semibold text-rose-600 cursor-pointer">
                    🚨 {language === "en" ? "Flag Room for Urgent Inspection" : "แจ้งตรวจสอบห้องชุดเร่งด่วน (มีน้ำรั่วซึม/ไฟผิดปกติ)"}
                  </label>
                </div>

                {modalError && (
                  <div className="p-2 bg-rose-50 text-rose-600 font-semibold rounded">
                    ⚠️ {modalError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedReading(null)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50 transition font-semibold"
                    disabled={submitting}
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition shadow-sm"
                    disabled={submitting}
                  >
                    {submitting ? (language === "en" ? "Submitting..." : "กำลังส่งงาน...") : (language === "en" ? "Submit" : "ส่งงานบันทึก")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Admin Detail Modal */}
        {selectedReading && !isTechnician && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? "Meter Reading Review Details" : "ตรวจสอบรายละเอียดการจดมิเตอร์"}
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Unit Number" : "ห้องชุด"}</span>
                  <strong className="text-sm text-slate-800 dark:text-white">Unit {selectedReading.unit?.unit_number}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Utility Type" : "ประเภท"}</span>
                  <strong className="text-sm font-semibold">{selectedReading.utility_type}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Prev Reading" : "เลขจดครั้งก่อน"}</span>
                  <strong className="text-sm font-mono">{Number(selectedReading.previous_reading).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Current Reading" : "เลขจดครั้งนี้"}</span>
                  <strong className="text-sm font-mono font-bold text-slate-800 dark:text-white">{Number(selectedReading.current_reading).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Usage" : "หน่วยการใช้"}</span>
                  <strong className="text-sm font-mono font-bold text-slate-800 dark:text-white">{Number(selectedReading.usage_units).toLocaleString()} หน่วย</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Calculated Charge" : "ค่าบริการเรียกเก็บ"}</span>
                  <strong className="text-sm font-mono font-bold text-[#D4AF37]">{Number(selectedReading.calculated_amount).toFixed(2)} ฿</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block">{language === "en" ? "Technician Note" : "บันทึกจากเจ้าหน้าที่"}</span>
                  <p className="p-2 bg-slate-50 dark:bg-slate-900 rounded font-semibold text-slate-700 dark:text-slate-300">{selectedReading.technician_note || "-"}</p>
                </div>
                {selectedReading.anomaly_status !== "NORMAL" && (
                  <div className="col-span-2 p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 font-bold rounded">
                    ⚠️ {language === "en" ? "Anomaly Flagged:" : "ตรวจพบความผิดปกติ:"} {selectedReading.anomaly_reason}
                  </div>
                )}
              </div>

              {selectedReading.photo_url && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400">{language === "en" ? "Photo Evidence" : "หลักฐานรูปภาพถ่าย"}</span>
                  <div className="border rounded-xl overflow-hidden max-h-48 flex justify-center bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedReading.photo_url}
                      alt="Evidence"
                      className="object-contain max-h-48"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedReading(null)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition font-semibold text-xs"
                >
                  {language === "en" ? "Close" : "ปิดหน้าจอ"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition text-xs"
                >
                  ↩ {language === "en" ? "Return to Technician" : "ส่งกลับแก้ไข"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleApproveReading(selectedReading.id);
                    setSelectedReading(null);
                  }}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition text-xs"
                >
                  ✓ {language === "en" ? "Approve & Sync" : "อนุมัติและบันทึกค่าน้ำไฟ"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return / Reject Comment Modal */}
        {showReturnModal && selectedReading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? "Return for Correction" : "ส่งข้อมูลกลับไปแก้ไข"}
              </h3>

              <form onSubmit={handleReturnReading} className="space-y-4 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Reason for Return" : "ระบุสาเหตุส่งกลับแก้ไข"}</label>
                  <textarea
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="เช่น เลขมิเตอร์ไม่ตรงกับรูปภาพ/โปรดตรวจสอบเลขใหม่"
                    className="p-2 border rounded dark:bg-slate-900 outline-none h-24"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowReturnModal(false)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50 transition font-semibold"
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-sm"
                  >
                    ↩ {language === "en" ? "Confirm Return" : "ยืนยันส่งกลับ"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Utility Control Modal */}
        {selectedUnit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? `Update Utility Control: Unit ${selectedUnit.unit_number}` : `อัปเดตระบบควบคุมน้ำ/ไฟ: ห้อง ${selectedUnit.unit_number}`}
              </h3>

              <form onSubmit={handleControlStatusUpdate} className="space-y-4 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Utility Service" : "บริการระบบ"}</label>
                  <select
                    value={controlType}
                    onChange={(e) => setControlType(e.target.value as "WATER" | "ELECTRICITY")}
                    className="p-2 border rounded dark:bg-slate-900 outline-none font-semibold"
                  >
                    <option value="WATER">{language === "en" ? "WATER" : "ค่าน้ำประปา"}</option>
                    <option value="ELECTRICITY">{language === "en" ? "ELECTRICITY" : "ค่าไฟฟ้า"}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Control Status" : "สถานะควบคุม"}</label>
                  <select
                    value={newControlStatus}
                    onChange={(e) => setNewControlStatus(e.target.value as UtilityControlType)}
                    className="p-2 border rounded dark:bg-slate-900 outline-none font-semibold"
                  >
                    <option value="NORMAL">{language === "en" ? "NORMAL (เปิดบริการปกติ)" : "ปกติ (เปิดใช้งาน)"}</option>
                    <option value="SHUTOFF_REQUESTED">{language === "en" ? "SHUTOFF REQUESTED" : "แจ้งปิดบริการ"}</option>
                    <option value="SHUT_OFF">{language === "en" ? "SHUT OFF (ระงับบริการแล้ว)" : "ปิดบริการแล้ว"}</option>
                    <option value="RECONNECT_REQUESTED">{language === "en" ? "RECONNECT REQUESTED" : "ขอเปิดบริการ"}</option>
                    <option value="RESTRICTED_NO_RECONNECT">{language === "en" ? "RESTRICTED: DO NOT RECONNECT" : "ห้ามเปิดโดยไม่ได้รับอนุมัติ (ห้ามเปิดต่อ)"}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Reason / Auth Note" : "เหตุผล / บันทึกการอนุมัติ"}</label>
                  <textarea
                    value={controlReason}
                    onChange={(e) => setControlReason(e.target.value)}
                    placeholder="ระบุเหตุผลในการเปลี่ยนสถานะ (เช่น ค้างชำระค่าบริการเกินกำหนด)"
                    className="p-2 border rounded dark:bg-slate-900 outline-none h-20"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedUnit(null)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50 transition font-semibold"
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition shadow-sm"
                  >
                    {language === "en" ? "Update Status" : "ยืนยันอัปเดต"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Meter Replacement Modal */}
        {selectedMeter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? `Replace Meter: Unit ${selectedMeter.unit?.unit_number}` : `เปลี่ยนมิเตอร์ใหม่: ห้อง ${selectedMeter.unit?.unit_number}`}
              </h3>

              <form onSubmit={handleMeterReplacement} className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === "en" ? "Current Meter Number" : "หมายเลขมิเตอร์เดิม"}</span>
                    <strong className="text-sm font-mono text-slate-700 dark:text-slate-350">{selectedMeter.meter_number}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === "en" ? "Utility Type" : "ประเภทระบบ"}</span>
                    <strong className="text-sm">{selectedMeter.utility_type}</strong>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "New Meter Number" : "หมายเลขมิเตอร์เครื่องใหม่"}</label>
                  <input
                    type="text"
                    value={newMeterNumber}
                    onChange={(e) => setNewMeterNumber(e.target.value)}
                    placeholder="ป้อนหมายเลขมิเตอร์เครื่องใหม่"
                    className="p-2 border rounded dark:bg-slate-900 outline-none font-mono font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-500">{language === "en" ? "Starting Reading" : "ตัวเลขเริ่มต้นจดใหม่"}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={startingReading}
                      onChange={(e) => setStartingReading(e.target.value)}
                      placeholder="เช่น 0.00"
                      className="p-2 border rounded dark:bg-slate-900 outline-none font-mono"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-slate-500">{language === "en" ? "Final Reading (Old)" : "เลขบันทึกสุดท้าย (เครื่องเดิม)"}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={finalReading}
                      onChange={(e) => setFinalReading(e.target.value)}
                      placeholder="ระบุเลขจดครั้งสุดท้าย"
                      className="p-2 border rounded dark:bg-slate-900 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-500">{language === "en" ? "Replacement Reason" : "ระบุสาเหตุการเปลี่ยนเครื่อง"}</label>
                  <textarea
                    value={replacementReason}
                    onChange={(e) => setReplacementReason(e.target.value)}
                    placeholder="ระบุสาเหตุ (เช่น มิเตอร์ชำรุดเสียหาย/หน้าจอแตกร้าว)"
                    className="p-2 border rounded dark:bg-slate-900 outline-none h-16"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedMeter(null)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50 transition font-semibold"
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition shadow-sm"
                  >
                    {language === "en" ? "Confirm Replace" : "ยืนยันการติดตั้งเปลี่ยน"}
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
