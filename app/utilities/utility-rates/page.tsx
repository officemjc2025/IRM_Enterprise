/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState, LocalizedDatePicker } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { UtilityRate } from "@/features/reservation/types/stay.types";

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

export default function UtilityRatesPage() {
  const { language } = useLanguage();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [rates, setRates] = useState<UtilityRate[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Form State
  const [utilityType, setUtilityType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [ratePerUnit, setRatePerUnit] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");
  const [effectiveTo, setEffectiveTo] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

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
          
          // Fetch properties
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
        console.error("Error initializing rates page:", err);
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, []);

  const fetchRates = React.useCallback(async () => {
    if (!selectedProperty) return;
    setFetchError(null);
    try {
      const res = await fetch(`/api/v1/utility-rates?property_id=${selectedProperty}`);
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
        setRates(json.data || []);
      } else {
        throw new Error(json.message || "Failed to fetch rates");
      }
    } catch (err) {
      console.error("Error fetching rates:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("relation") && msg.includes("does not exist")) {
        setFetchError(language === "en"
          ? "System Setup Required: Utility operations schema (Migration 030) is not applied. Functional UAT requires sql migration approval."
          : "ระบบต้องการการเตรียมพร้อมข้อมูล: ยังไม่ได้ติดตั้งตารางข้อมูลสาธารณูปโภค (Migration 030) การทดสอบระบบ UAT จำเป็นต้องรอการอนุมัติการย้ายฐานข้อมูล SQL");
      } else {
        setFetchError(language === "en" ? `Failed to load rates: ${msg}` : `ไม่สามารถโหลดข้อมูลอัตรา: ${msg}`);
      }
    }
  }, [selectedProperty, language]);

  useEffect(() => {
    if (selectedProperty) {
      fetchRates();
    }
  }, [selectedProperty, fetchRates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    if (!selectedProperty) return;
    if (!ratePerUnit || isNaN(Number(ratePerUnit)) || Number(ratePerUnit) < 0) {
      setFormError(language === "en" ? "Please enter a valid rate amount." : "กรุณาระบุอัตราค่าบริการที่ถูกต้อง");
      return;
    }
    if (!effectiveFrom) {
      setFormError(language === "en" ? "Please select an effective start date." : "กรุณาระบุวันที่เริ่มมีผลบังคับใช้");
      return;
    }

    try {
      const res = await fetch("/api/v1/utility-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedProperty,
          utility_type: utilityType,
          rate_per_unit: Number(ratePerUnit),
          effective_from: effectiveFrom,
          effective_to: effectiveTo || null
        })
      });

      const json = await res.json();
      if (!json.success) {
        setFormError(json.message);
      } else {
        setFormSuccess(true);
        setRatePerUnit("");
        setEffectiveFrom("");
        setEffectiveTo("");
        fetchRates();
      }
    } catch (err) {
      console.error("Failed to create utility rate:", err);
      setFormError(language === "en" ? "An error occurred. Please try again." : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleDeactivate = async (rateId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to deactivate this rate?" : "ยืนยันการยกเลิกใช้งานอัตราค่าน้ำ/ไฟนี้หรือไม่?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/utility-rates/${rateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false })
      });
      const json = await res.json();
      if (json.success) {
        fetchRates();
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
        <div>
          <PageHeader
            title={language === "en" ? "Utility Rates Management" : "การจัดการอัตราค่าน้ำ/ค่าไฟ"}
          />
          <p className="text-sm text-slate-500 mt-1">
            {language === "en" ? "Configure water and electricity charges per unit of consumption." : "ตั้งค่าอัตราเรียกเก็บค่าน้ำประปาและค่าไฟฟ้าต่อหน่วยการใช้งาน"}
          </p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rate Setup Form */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
              {language === "en" ? "Create New Rate Plan" : "ตั้งค่าอัตราใหม่"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500 dark:text-slate-400">
                  {language === "en" ? "Utility Type" : "ประเภทสาธารณูปโภค"}
                </label>
                <select
                  value={utilityType}
                  onChange={(e) => setUtilityType(e.target.value as "WATER" | "ELECTRICITY")}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-semibold outline-none"
                >
                  <option value="WATER">{language === "en" ? "WATER (Water Meter)" : "น้ำประปา (ค่าน้ำ)"}</option>
                  <option value="ELECTRICITY">{language === "en" ? "ELECTRICITY (Electricity Meter)" : "ไฟฟ้า (ค่าไฟ)"}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500 dark:text-slate-400">
                  {language === "en" ? "Rate (THB / Unit)" : "อัตราค่าบริการ (บาทต่อหน่วย)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ratePerUnit}
                  onChange={(e) => setRatePerUnit(e.target.value)}
                  placeholder="e.g. 7.00"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none font-mono"
                  required
                />
              </div>

              <LocalizedDatePicker
                value={effectiveFrom}
                onChange={setEffectiveFrom}
                locale={language}
                label={language === "en" ? "Effective From" : "วันที่เริ่มใช้"}
                required
              />
              <LocalizedDatePicker
                value={effectiveTo}
                onChange={setEffectiveTo}
                locale={language}
                label={language === "en" ? "Effective To (Optional)" : "วันสิ้นสุด (ไม่จำเป็น)"}
              />

              {formError && (
                <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 text-xs font-semibold rounded">
                  ⚠️ {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-455 text-xs font-semibold rounded">
                  ✓ {language === "en" ? "Rate saved successfully." : "บันทึกอัตราสำเร็จ"}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded transition shadow-sm"
              >
                {language === "en" ? "Save Rate Plan" : "บันทึกอัตราเรียกเก็บ"}
              </button>
            </form>
          </div>

          {/* Rates Table / List */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b pb-2">
              {language === "en" ? "Utility Rates History & Active Status" : "ประวัติอัตราเรียกเก็บและสถานะปัจจุบัน"}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="p-3">{language === "en" ? "Utility Type" : "ประเภท"}</th>
                    <th className="p-3">{language === "en" ? "Rate / Unit" : "บาทต่อหน่วย"}</th>
                    <th className="p-3">{language === "en" ? "Effective From" : "วันที่เริ่มใช้"}</th>
                    <th className="p-3">{language === "en" ? "Effective To" : "วันสิ้นสุด"}</th>
                    <th className="p-3">{language === "en" ? "Status" : "สถานะ"}</th>
                    <th className="p-3 text-right">{language === "en" ? "Actions" : "การจัดการ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {rates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        {language === "en" ? "No rates configured yet." : "ยังไม่มีการตั้งค่าอัตราค่าน้ำประปาและค่าไฟฟ้า"}
                      </td>
                    </tr>
                  ) : (
                    rates.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-900/10">
                        <td className="p-3 font-semibold">
                          {r.utility_type === "WATER" ? (
                            <span className="text-blue-600 dark:text-blue-455">💧 {language === "en" ? "WATER" : "ค่าน้ำประปา"}</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-455">⚡ {language === "en" ? "ELECTRICITY" : "ค่าไฟฟ้า"}</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {Number(r.rate_per_unit).toFixed(2)} ฿
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{r.effective_from}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">{r.effective_to || (language === "en" ? "Present" : "ปัจจุบัน")}</td>
                        <td className="p-3">
                          {r.is_active ? (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-455 border border-emerald-100 dark:border-emerald-900/30">
                              {language === "en" ? "Active" : "ใช้งานอยู่"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-50 dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800">
                              {language === "en" ? "Inactive" : "ยกเลิกแล้ว"}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {r.is_active && (
                            <button
                              onClick={() => handleDeactivate(r.id)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                              {language === "en" ? "Deactivate" : "ยกเลิกใช้งาน"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
