/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import {
  MeterReading,
  UtilityControlType,
  MeterReadingCycle
} from "@/features/reservation/types/stay.types";
import { compareUnitNumbers } from "@/shared/utils/unit";

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

const supabase = createClient();

export default function MeterReadingPage() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [cycles, setCycles] = useState<MeterReadingCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [searchRoom, setSearchRoom] = useState("");
  const [activeMode, setActiveMode] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [techFilter, setTechFilter] = useState<"ALL" | "PENDING" | "RECHECK" | "SUBMITTED" | "APPROVED">("ALL");

  // Input Modal state
  const [selectedReading, setSelectedReading] = useState<MeterReading | null>(null);
  const [currentReadingInput, setCurrentReadingInput] = useState("");
  const [techNote, setTechNote] = useState("");
  const [isAnomalyFlagged, setIsAnomalyFlagged] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response received:", text);
        return { success: false, message: `Server error (${res.status}): Received invalid format` };
      }
      return await res.json();
    } catch (err) {
      console.error("Fetch failed:", err);
      return { success: false, message: "Network connection error. Please try again." };
    }
  };

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
          let propQuery = supabase.from("properties").select("id, property_name_th, property_name_en");
          if (profile.property_id) {
            propQuery = propQuery.eq("id", profile.property_id);
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
    const json = await safeFetchJson(`/api/v1/meter-cycles?property_id=${selectedProperty}`);
    if (json.success) {
      const openCycles = (json.data || []).filter((c: MeterReadingCycle) => c.status === "OPEN" || c.status === "IN_PROGRESS");
      setCycles(openCycles);
      const modeCycles = openCycles.filter((c: MeterReadingCycle) => c.utility_type === activeMode);
      if (modeCycles.length > 0 && !selectedCycle) {
        setSelectedCycle(modeCycles[0].id);
      }
    } else {
      console.error(json.message);
    }
  }, [selectedProperty, selectedCycle, activeMode]);

  const handleModeChange = (newMode: "WATER" | "ELECTRICITY") => {
    setActiveMode(newMode);
    const modeCycles = cycles.filter(c => c.utility_type === newMode);
    if (modeCycles.length > 0) {
      setSelectedCycle(modeCycles[0].id);
    } else {
      setSelectedCycle("");
    }
  };

  const fetchReadings = React.useCallback(async () => {
    if (!selectedProperty || !selectedCycle) return;
    const json = await safeFetchJson(`/api/v1/meter-readings?property_id=${selectedProperty}&cycle_id=${selectedCycle}`);
    if (json.success) {
      setReadings(json.data || []);
    } else {
      console.error(json.message);
    }
  }, [selectedProperty, selectedCycle]);

  useEffect(() => {
    if (selectedProperty) {
      fetchCycles();
    }
  }, [selectedProperty, fetchCycles]);

  useEffect(() => {
    if (selectedProperty && selectedCycle) {
      fetchReadings();
    }
  }, [selectedProperty, selectedCycle, fetchReadings]);

  // Format date helper with Thai Buddhist Era option
  const formatThaiDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear() + (language === "th" ? 543 : 0);
    const monthsTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mLabel = language === "th" ? monthsTh[month] : monthsEn[month];
    return `${day} ${mLabel} ${year}`;
  };

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
      setModalError(language === "en" ? `Current reading cannot be less than previous (${prevVal})` : `เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน (${prevVal})`);
      setSubmitting(false);
      return;
    }

    try {
      let uploadedUrl: string | null = null;
      if (photoFile) {
        uploadedUrl = await handlePhotoUpload(photoFile);
        if (!uploadedUrl) {
          setModalError(language === "en" ? "Failed to upload photo." : "อัปโหลดภาพไม่สำเร็จ");
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
      console.error(err);
      setModalError(language === "en" ? "An error occurred." : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };


  const renderWarningBanner = (status: UtilityControlType, label: string) => {
    if (status === "RESTRICTED_NO_RECONNECT") {
      return (
        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px] rounded-lg">
          🚨 {language === "en" ? `RESTRICTED: DO NOT RECONNECT ${label}` : `ห้ามต่อเชื่อม ${label} เด็ดขาด!`}
        </div>
      );
    }
    if (status === "SHUT_OFF") {
      return (
        <div className="p-2 bg-amber-50 border border-amber-250 text-amber-700 text-[10px] font-semibold rounded-lg">
          ⚠️ {language === "en" ? `${label} is SHUT OFF` : `สถานะ: ปิด ${label} อยู่`}
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

  const naturalSort = (a: string, b: string) => {
    return compareUnitNumbers(a, b);
  };

  // Filter and sort readings queue: RETURNED -> PENDING -> SUBMITTED -> APPROVED
  const filteredReadings = readings
    .filter(r => {
      // Search filter
      if (searchRoom && !r.unit?.unit_number.toLowerCase().includes(searchRoom.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (techFilter === "PENDING") {
        return r.status === "PENDING" || (r.status === "REJECTED" && !r.recheck_requested);
      }
      if (techFilter === "RECHECK") {
        return r.status === "REJECTED" && r.recheck_requested;
      }
      if (techFilter === "SUBMITTED") {
        return r.status === "REVIEW";
      }
      if (techFilter === "APPROVED") {
        return r.status === "APPROVED";
      }
      return true;
    })
    .sort((a, b) => {
      const aPriority = a.recheck_requested ? 0 : (a.status === "REJECTED" ? 1 : (a.status === "PENDING" ? 2 : (a.status === "REVIEW" ? 3 : 4)));
      const bPriority = b.recheck_requested ? 0 : (b.status === "REJECTED" ? 1 : (b.status === "PENDING" ? 2 : (b.status === "REVIEW" ? 3 : 4)));
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return naturalSort(a.unit?.unit_number || "", b.unit?.unit_number || "");
    });

  // Cycle statistics
  const currentCycleObj = cycles.find(c => c.id === selectedCycle);
  const totalRooms = readings.length;
  const pendingCount = readings.filter(r => r.status === "PENDING" || r.status === "REJECTED").length;
  const submittedCount = readings.filter(r => r.status === "REVIEW").length;
  const approvedCount = readings.filter(r => r.status === "APPROVED").length;

  const isAuthorized = role && ["super_admin", "admin", "property_admin", "technician"].includes(role);

  if (loading) {
    return (
      <MainLayout>
        <LoadingState />
      </MainLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <MainLayout>
        <div className="p-6 text-center text-rose-600 font-bold bg-white rounded-xl border border-rose-100 shadow-sm max-w-lg mx-auto mt-12">
          ❌ {language === "en" ? "Access Denied: Unprivileged role scope" : "ไม่มีสิทธิ์เข้าถึง: บทบาทผู้ใช้ไม่มีสิทธิ์เข้าใช้งานระบบการจดมิเตอร์"}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-4 max-w-md mx-auto">
        <div>
          <PageHeader
            title={language === "en" ? "Mobile Meter Reading" : "บันทึกค่าน้ำ/ค่าไฟ (สำหรับช่าง)"}
          />
          <p className="text-[11px] text-slate-500 mt-0.5">
            {language === "en" ? "Select cycle and rooms to submit readings." : "เลือกโครงการและห้องพักเพื่อเริ่มทำการจดบันทึกเลขดัชนีมิเตอร์น้ำ/ไฟ"}
          </p>
        </div>

        {/* Mode Selector Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-bold w-full">
          <button
            type="button"
            onClick={() => handleModeChange("WATER")}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeMode === "WATER"
                ? "bg-white dark:bg-slate-800 text-blue-600 shadow"
                : "text-slate-400 hover:text-slate-500"
            }`}
          >
            💧 {language === "en" ? "Water Meter" : "จดมิเตอร์น้ำ"}
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("ELECTRICITY")}
            className={`flex-1 py-2 rounded-lg transition-all ${
              activeMode === "ELECTRICITY"
                ? "bg-white dark:bg-slate-800 text-amber-500 shadow"
                : "text-slate-400 hover:text-slate-500"
            }`}
          >
            ⚡ {language === "en" ? "Electricity Meter" : "จดมิเตอร์ไฟ"}
          </button>
        </div>

        {/* Selection panel */}
        <div className="bg-white dark:bg-slate-800 p-4 border rounded-xl shadow-sm space-y-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400">{language === "en" ? "Select Property" : "เลือกโครงการ"}</label>
            <select
              value={selectedProperty}
              onChange={(e) => {
                setSelectedProperty(e.target.value);
                setSelectedCycle("");
              }}
              className="p-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold outline-none w-full"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400">{language === "en" ? "Select Open Cycle" : "รอบจดมิเตอร์ที่กำลังเปิด"}</label>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="p-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold outline-none w-full"
            >
              <option value="">-- {language === "en" ? "Select Cycle" : "เลือกรอบจดมิเตอร์"} --</option>
              {cycles.filter(c => c.utility_type === activeMode).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cycle_name} ({c.cycle_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary metrics panel */}
        {selectedCycle && currentCycleObj && (
          <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-4 shadow-sm grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
            <div>
              <span className="block text-slate-400">{language === "en" ? "Rooms" : "ห้องทั้งหมด"}</span>
              <span className="text-sm text-slate-700 dark:text-white font-mono">{totalRooms}</span>
            </div>
            <div>
              <span className="block text-amber-500">{language === "en" ? "Pending" : "รอจด"}</span>
              <span className="text-sm text-amber-500 font-mono">{pendingCount}</span>
            </div>
            <div>
              <span className="block text-blue-500">{language === "en" ? "Review" : "ส่งตรวจ"}</span>
              <span className="text-sm text-blue-500 font-mono">{submittedCount}</span>
            </div>
            <div>
              <span className="block text-emerald-500">{language === "en" ? "Approved" : "อนุมัติ"}</span>
              <span className="text-sm text-emerald-500 font-mono">{approvedCount}</span>
            </div>
          </div>
        )}

        {/* Readings Queue */}
        {selectedCycle && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder={language === "en" ? "Search room..." : "ค้นหาเลขห้อง..."}
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                className="p-2 border rounded-xl dark:bg-slate-900 text-xs w-full outline-none"
              />
              
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-[9px] font-bold gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTechFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    techFilter === "ALL" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow" : "text-slate-400"
                  }`}
                >
                  {language === "en" ? "All" : "ทั้งหมด"} ({readings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTechFilter("PENDING")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    techFilter === "PENDING" ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow" : "text-slate-400"
                  }`}
                >
                  {language === "en" ? "Pending" : "ยังไม่ได้จด"} ({readings.filter(r => r.status === "PENDING" || (r.status === "REJECTED" && !r.recheck_requested)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTechFilter("RECHECK")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    techFilter === "RECHECK" ? "bg-white dark:bg-slate-800 text-rose-600 shadow" : "text-slate-400"
                  }`}
                >
                  {language === "en" ? "Recheck" : "ต้องจดใหม่"} ({readings.filter(r => r.status === "REJECTED" && r.recheck_requested).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTechFilter("SUBMITTED")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    techFilter === "SUBMITTED" ? "bg-white dark:bg-slate-800 text-blue-500 shadow" : "text-slate-400"
                  }`}
                >
                  {language === "en" ? "Submitted" : "ส่งตรวจแล้ว"} ({readings.filter(r => r.status === "REVIEW").length})
                </button>
                <button
                  type="button"
                  onClick={() => setTechFilter("APPROVED")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    techFilter === "APPROVED" ? "bg-white dark:bg-slate-800 text-emerald-500 shadow" : "text-slate-400"
                  }`}
                >
                  {language === "en" ? "Approved" : "เสร็จแล้ว"} ({readings.filter(r => r.status === "APPROVED").length})
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {filteredReadings.map((r) => {
                const prevReading = Number(r.previous_reading);
                const isReturned = r.status === "REJECTED";
                const isApproved = r.status === "APPROVED";
                const isSubmitted = r.status === "REVIEW";

                return (
                  <div
                    key={r.id}
                    className={`bg-white dark:bg-slate-800 border rounded-xl p-4 shadow-sm space-y-2.5 transition ${
                      isReturned ? "border-rose-300" :
                      isApproved ? "border-emerald-150" :
                      isSubmitted ? "border-blue-150" :
                      "border-slate-100"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <strong className="text-sm text-slate-800 dark:text-white">Room {r.unit?.unit_number}</strong>
                        <span className="text-[10px] text-slate-400 block font-mono">Serial: {r.meter?.meter_number}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {r.utility_type === "WATER" ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-blue-50 text-blue-600 border border-blue-100">💧 WATER</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-50 text-amber-600 border border-amber-100">⚡ ELEC</span>
                        )}
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                          isReturned ? "bg-rose-50 text-rose-600" :
                          isApproved ? "bg-emerald-50 text-emerald-600" :
                          isSubmitted ? "bg-blue-50 text-blue-600" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {isReturned ? (language === "en" ? "Returned" : "ต้องแก้ไข") :
                           isApproved ? (language === "en" ? "Approved" : "อนุมัติแล้ว") :
                           isSubmitted ? (language === "en" ? "Submitted" : "ส่งตรวจแล้ว") :
                           (language === "en" ? "Pending" : "รอจด")}
                        </span>
                      </div>
                    </div>

                    {/* Warning Banners */}
                    {r.utility_type === "WATER" && r.unit && renderWarningBanner(r.unit.water_control_status, "Water")}
                    {r.utility_type === "ELECTRICITY" && r.unit && renderWarningBanner(r.unit.electricity_control_status, "Electricity")}

                    <div className="text-[11px] text-slate-500 grid grid-cols-2 gap-2 border-t pt-2 dark:border-slate-700">
                      <div>
                        <span>{language === "en" ? "Previous Reading:" : "เลขจดครั้งก่อน:"}</span>
                        <strong className="block text-slate-800 dark:text-slate-200 font-mono">{prevReading.toLocaleString()}</strong>
                        {r.recorded_at && (
                          <span className="text-[9px] text-slate-400 block font-normal mt-0.5">
                            {formatThaiDate(r.recorded_at)}
                          </span>
                        )}
                      </div>
                      <div>
                        <span>{language === "en" ? "Recorded Value:" : "เลขปัจจุบัน:"}</span>
                        <strong className="block text-slate-800 dark:text-slate-200 font-mono">
                          {r.current_reading !== null ? Number(r.current_reading).toLocaleString() : "-"}
                        </strong>
                      </div>
                    </div>

                    {isReturned && r.manager_note && (
                      <div className="p-2 bg-rose-50 rounded-lg text-[10px] text-rose-600 font-semibold">
                        ❌ {language === "en" ? `Correction request: ${r.manager_note}` : `รายละเอียดการแก้ไข: ${r.manager_note}`}
                      </div>
                    )}

                    {!isApproved && !isSubmitted && (
                      <button
                        onClick={() => {
                          setSelectedReading(r);
                          setCurrentReadingInput(r.current_reading !== null ? String(r.current_reading) : "");
                          setTechNote(r.technician_note || "");
                          setIsAnomalyFlagged(r.anomaly_status === "TECHNICIAN_FLAGGED");
                          setPhotoFile(null);
                          setModalError(null);
                        }}
                        className="w-full py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl text-xs transition"
                      >
                        📝 {isReturned ? (language === "en" ? "Re-enter Reading" : "แก้ไขข้อมูลมิเตอร์") : (language === "en" ? "Enter Reading" : "บันทึกตัวเลขมิเตอร์")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Entry Modal */}
      {selectedReading && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-end p-0 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-800 dark:text-white">
                📝 {language === "en" ? "Record index reading" : "บันทึกตัวเลขและพยานหลักฐาน"}
              </h3>
              <button
                onClick={() => setSelectedReading(null)}
                className="text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-xs text-slate-500">
              <div><strong>{language === "en" ? "Room:" : "ห้องชุด:"}</strong> Room {selectedReading.unit?.unit_number}</div>
              <div><strong>{language === "en" ? "Utility Type:" : "ประเภทมิเตอร์:"}</strong> {selectedReading.utility_type}</div>
              <div><strong>{language === "en" ? "Meter Serial:" : "เลขมิเตอร์:"}</strong> {selectedReading.meter?.meter_number}</div>
              <div><strong>{language === "en" ? "Previous index:" : "ดัชนีจดครั้งก่อน:"}</strong> <span className="font-mono">{Number(selectedReading.previous_reading).toLocaleString()}</span></div>
              {selectedReading.unit && (
                <div className="mt-1">
                  <strong>{language === "en" ? "Control Status:" : "สถานะควบคุมสัญญาณ:"}</strong>{" "}
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-semibold font-mono">
                    {selectedReading.utility_type === "WATER"
                      ? translateControlStatus(selectedReading.unit.water_control_status)
                      : translateControlStatus(selectedReading.unit.electricity_control_status)}
                  </span>
                </div>
              )}
            </div>
            {selectedReading.recheck_requested && (
              <div className="p-3 bg-rose-50 dark:bg-rose-955/20 border border-rose-200 text-rose-800 dark:text-rose-400 rounded-xl space-y-1">
                <div className="font-bold text-xs">⚠️ {language === "en" ? "Recheck requested by manager" : "คำสั่งตรวจสอบซ้ำ (ต้องจดใหม่)"}</div>
                <div className="text-[10px] font-medium">{language === "en" ? "Reason:" : "สาเหตุที่ต้องตรวจซ้ำ:"} <span className="font-bold">{selectedReading.recheck_reason}</span></div>
                <div className="text-[10px] font-mono">{language === "en" ? "Originally submitted reading:" : "ค่าที่บันทึกไว้เดิม:"} {Number(selectedReading.current_reading).toLocaleString()}</div>
                {selectedReading.photo_url && (
                  <div className="mt-1">
                    <span className="font-semibold block text-[10px] text-slate-400 mb-1">{language === "en" ? "Previously uploaded photo:" : "ภาพถ่ายเดิม:"}</span>
                    <img src={selectedReading.photo_url} alt="Previous reading photo" className="w-full max-h-32 object-cover rounded-lg border" />
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleReadingSubmit} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Current Meter Index" : "เลขดัชนีจดมิเตอร์ปัจจุบัน"}</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentReadingInput}
                  onChange={(e) => {
                    setCurrentReadingInput(e.target.value);
                    setModalError(null);
                  }}
                  placeholder={language === "en" ? "e.g. 1250.00" : "เช่น 1250.00"}
                  className="p-2.5 border rounded-xl dark:bg-slate-900 font-mono text-sm outline-none font-bold"
                  required
                />
              </div>

              {/* Consumption unit preview */}
              {currentReadingInput && !isNaN(Number(currentReadingInput)) && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1 font-semibold text-[11px]">
                  <div className="flex justify-between">
                    <span>{language === "en" ? "Current Input:" : "ตัวเลขใหม่:"}</span>
                    <span className="font-mono">{Number(currentReadingInput).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span>{language === "en" ? "Consumption usage:" : "ปริมาณการใช้ประมวลผล:"}</span>
                    <span className="font-mono text-[#D4AF37] font-bold">
                      {Math.max(0, Number(currentReadingInput) - Number(selectedReading.previous_reading)).toLocaleString()} หน่วย
                    </span>
                  </div>
                </div>
              )}

              {/* Validation Warning */}
              {currentReadingInput && Number(currentReadingInput) < Number(selectedReading.previous_reading) && (
                <div className="p-2 bg-rose-50 text-rose-600 font-bold rounded-lg">
                  ⚠️ {language === "en" ? "Current reading cannot be less than previous!" : "เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน!"}
                </div>
              )}

              {/* Abnormal Usage warning preview client-side */}
              {currentReadingInput && (Number(currentReadingInput) - Number(selectedReading.previous_reading) > 50) && (
                <div className="p-2 bg-amber-50 text-amber-700 font-bold rounded-lg animate-pulse">
                  ⚠️ {language === "en" ? "Abnormal consumption warning (>50 units)." : "การใช้สูงผิดปกติ กรุณาตรวจสอบและถ่ายภาพเพื่อยืนยัน"}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Attach Photo Evidence" : "ถ่ายรูปประกอบพยานหลักฐาน"}</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Technician Note" : "หมายเหตุช่าง"}</label>
                <textarea
                  value={techNote}
                  onChange={(e) => setTechNote(e.target.value)}
                  placeholder={language === "en" ? "Note any damage or suspect meter" : "ระบุความผิดปกติหรือการทำงานเพิ่มเติม"}
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="flag"
                  checked={isAnomalyFlagged}
                  onChange={(e) => setIsAnomalyFlagged(e.target.checked)}
                />
                <label htmlFor="flag" className="font-semibold text-rose-500">
                  ⚠️ {language === "en" ? "Flag meter suspect / damaged" : "แจ้งพบมิเตอร์ชำรุด/สงสัยน้ำรั่วซึม"}
                </label>
              </div>

              {modalError && <div className="text-rose-500 font-semibold text-[10px]">{modalError}</div>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedReading(null)}
                  className="w-1/2 py-2 border rounded-xl font-bold"
                >
                  {language === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  disabled={submitting || Number(currentReadingInput) < Number(selectedReading.previous_reading)}
                  className={`w-1/2 py-2 text-white font-bold rounded-xl ${
                    submitting || Number(currentReadingInput) < Number(selectedReading.previous_reading)
                      ? "bg-slate-350 cursor-not-allowed"
                      : "bg-[#D4AF37] hover:bg-[#D4AF37]/90 shadow-sm"
                  }`}
                >
                  {submitting ? (language === "en" ? "Submitting..." : "กำลังส่ง...") : (language === "en" ? "Submit" : "ตกลงส่งตรวจ")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
