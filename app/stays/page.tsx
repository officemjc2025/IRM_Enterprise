"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState, EmptyState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { Reservation } from "@/features/reservation/types/reservation.types";
import { StayChargePeriod, OverallStatus, RentStatus, UtilityStatus, deriveStayAttention } from "@/features/reservation/types/stay.types";
import { 
  formatDate, 
  formatMonthYear, 
  translateBillingBasis, 
  translatePaymentStatus, 
  translateUtilityStatus, 
  translateAttention 
} from "@/shared/utils";

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

export default function StaysPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <StaysContent />
      </Suspense>
    </MainLayout>
  );
}

const supabase = createClient();

function StaysContent() {
  const { language } = useLanguage();

  const [role, setRole] = useState<string>("resident");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stays, setStays] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);

  // Filter States
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [attentionFilter, setAttentionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Details Modal States
  const [selectedStay, setSelectedStay] = useState<Reservation | null>(null);
  const [periods, setPeriods] = useState<StayChargePeriod[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<StayChargePeriod | null>(null);

  // Period Update Form States
  const [waterVal, setWaterVal] = useState("");
  const [waterStat, setWaterStat] = useState<UtilityStatus>("PENDING");
  const [elecVal, setElecVal] = useState("");
  const [elecStat, setElecStat] = useState<UtilityStatus>("PENDING");
  const [rentStat, setRentStat] = useState<RentStatus>("PENDING");
  const [overallStat, setOverallStat] = useState<OverallStatus>("PENDING");
  const [otherVal, setOtherVal] = useState("");
  const [discVal, setDiscVal] = useState("");
  const [paidVal, setPaidVal] = useState("");
  const [periodNote, setPeriodNote] = useState("");

  const isAdmin = ["admin", "super_admin", "property_admin"].includes(role);

  useEffect(() => {
    async function initPage() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please login to access stays tracking.");
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, property_id")
          .eq("id", user.id)
          .single();

        const resolvedRole = profile?.role || "resident";
        setRole(resolvedRole);

        if (!["admin", "super_admin", "property_admin"].includes(resolvedRole)) {
          setError("Access Denied: You do not have permissions to view stays tracking.");
          setLoading(false);
          return;
        }

        // Setup property filters for property admins
        if (resolvedRole === "property_admin") {
          if (profile?.property_id) {
            setPropertyFilter(profile.property_id);
          } else {
            setError("Access Denied: Property Admin has no property assigned.");
            setLoading(false);
            return;
          }
        }

        // Fetch properties
        const { data: props } = await supabase.from("properties").select("id, property_name_th, property_name_en");
        setProperties(props || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load metadata resources.");
      }
    }
    initPage();
  }, []);

  const fetchStaysList = React.useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      let url = `/api/v1/stays?property_id=${propertyFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        let list: Reservation[] = json.data || [];
        
        if (attentionFilter !== "ALL") {
          list = list.filter((stay) => {
            const currentP = stay.stay_charge_periods && stay.stay_charge_periods.length > 0
              ? stay.stay_charge_periods[stay.stay_charge_periods.length - 1] as StayChargePeriod
              : null;
            return deriveStayAttention(stay, currentP) === attentionFilter;
          });
        }

        if (statusFilter !== "ALL") {
          list = list.filter((stay) => {
            const currentP = stay.stay_charge_periods && stay.stay_charge_periods.length > 0
              ? stay.stay_charge_periods[stay.stay_charge_periods.length - 1] as StayChargePeriod
              : null;
            return currentP && currentP.overall_status === statusFilter;
          });
        }

        setStays(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, propertyFilter, searchQuery, attentionFilter, statusFilter]);

  useEffect(() => {
    if (isAdmin) {
      const timer = setTimeout(() => {
        fetchStaysList();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, fetchStaysList]);

  const fetchStayPeriods = async (stayId: string) => {
    try {
      setLoadingPeriods(true);
      const res = await fetch(`/api/v1/stays/${stayId}/periods`);
      const json = await res.json();
      if (json.success) {
        setPeriods(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handleGeneratePeriods = async (stayId: string) => {
    try {
      const res = await fetch(`/api/v1/stays/${stayId}/periods`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Stay charge periods generated successfully" : "สร้างงวดบัญชีติดตามผู้เช่ารายเดือนสำเร็จ");
        fetchStayPeriods(stayId);
        fetchStaysList();
      } else {
        alert(json.message || "Failed to generate periods");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openStayDetails = (stay: Reservation) => {
    setSelectedStay(stay);
    setSelectedPeriod(null);
    fetchStayPeriods(stay.id);
  };

  const openPeriodEdit = (p: StayChargePeriod) => {
    setSelectedPeriod(p);
    setWaterVal(p.water_amount !== null ? p.water_amount.toString() : "");
    setWaterStat(p.water_status);
    setElecVal(p.electricity_amount !== null ? p.electricity_amount.toString() : "");
    setElecStat(p.electricity_status);
    setRentStat(p.rent_status);
    setOverallStat(p.overall_status);
    setOtherVal(p.other_amount.toString());
    setDiscVal(p.discount_amount.toString());
    setPaidVal(p.paid_amount.toString());
    setPeriodNote(p.note || "");
  };

  const handleUpdatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStay || !selectedPeriod) return;

    try {
      const res = await fetch(`/api/v1/stays/${selectedStay.id}/periods/${selectedPeriod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          water_amount: waterVal,
          water_status: waterStat,
          electricity_amount: elecVal,
          electricity_status: elecStat,
          rent_status: rentStat,
          overall_status: overallStat,
          other_amount: otherVal,
          discount_amount: discVal,
          paid_amount: paidVal,
          note: periodNote
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Period charges updated successfully" : "บันทึกการปรับปรุงค่าใช้จ่ายประจำงวดสำเร็จ");
        setSelectedPeriod(null);
        fetchStayPeriods(selectedStay.id);
        fetchStaysList();
      } else {
        alert(json.message || "Failed to update period");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (error && !isAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-md">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
          {language === "en" ? "Access Denied" : "ปฏิเสธการเข้าถึง"}
        </h2>
        <p className="text-slate-500 dark:text-slate-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={language === "en" ? "Active Stay Monthly Tracking" : "ระบบติดตามสัญญาและรายได้ประจำงวด"}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Property" : "โครงการ"}</span>
              <select
                value={propertyFilter}
                disabled={role === "property_admin"}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL PROPERTIES</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Payment Status" : "สถานะชำระเงิน"}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="PENDING">{translatePaymentStatus("PENDING", language)}</option>
                <option value="PARTIALLY_PAID">{translatePaymentStatus("PARTIALLY_PAID", language)}</option>
                <option value="PAID">{translatePaymentStatus("PAID", language)}</option>
                <option value="OVERDUE">{translatePaymentStatus("OVERDUE", language)}</option>
                <option value="NOT_READY">{translatePaymentStatus("NOT_READY", language)}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Stay Attention" : "สถานะสัญญาที่ต้องติดตาม"}</span>
              <select
                value={attentionFilter}
                onChange={(e) => setAttentionFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL ATTENTION</option>
                <option value="RENT_DUE_SOON">{translateAttention("RENT_DUE_SOON", language)}</option>
                <option value="RENT_DUE_TODAY">{translateAttention("RENT_DUE_TODAY", language)}</option>
                <option value="RENT_OVERDUE">{translateAttention("RENT_OVERDUE", language)}</option>
                <option value="WATER_PENDING">{translateAttention("WATER_PENDING", language)}</option>
                <option value="ELECTRICITY_PENDING">{translateAttention("ELECTRICITY_PENDING", language)}</option>
                <option value="EXTENSION_PENDING">{translateAttention("EXTENSION_PENDING", language)}</option>
                <option value="UPCOMING_CHECKOUT">{translateAttention("UPCOMING_CHECKOUT", language)}</option>
                <option value="CHECKOUT_OVERDUE">{translateAttention("CHECKOUT_OVERDUE", language)}</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-64">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{language === "en" ? "Search" : "ค้นหา"}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "en" ? "Guest or Room #..." : "ชื่อลูกบ้านหรือเลขห้อง..."}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none w-full"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : stays.length === 0 ? (
        <EmptyState message={language === "en" ? "No stays match filters" : "ไม่พบรายการผู้พักอาศัยที่ตรงกับการค้นหา"} />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === "en" ? "Room" : "ห้องชุด"}</th>
                  <th className="p-4">{language === "en" ? "Occupant" : "ผู้เข้าพัก"}</th>
                  <th className="p-4 font-mono">{language === "en" ? "Res #" : "เลขใบจอง"}</th>
                  <th className="p-4">{language === "en" ? "Stay Period" : "ระยะเวลาพัก"}</th>
                  <th className="p-4">{language === "en" ? "Rent" : "ค่าห้อง"}</th>
                  <th className="p-4">{language === "en" ? "Utilities" : "น้ำ / ไฟ"}</th>
                  <th className="p-4">{language === "en" ? "Expected" : "ยอดรวมประเมิน"}</th>
                  <th className="p-4">{language === "en" ? "Outstanding" : "ค้างชำระ"}</th>
                  <th className="p-4">{language === "en" ? "Status" : "สถานะงวด"}</th>
                  <th className="p-4">{language === "en" ? "Stay Attention" : "ประเด็นที่ต้องติดตาม"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "จัดการ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {stays.map((s) => {
                  const currentP = s.stay_charge_periods && s.stay_charge_periods.length > 0
                    ? s.stay_charge_periods[s.stay_charge_periods.length - 1] as StayChargePeriod
                    : null;
                  const attention = deriveStayAttention(s, currentP);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-100">
                        Unit {s.unit?.unit_number}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.primary_guest ? `${s.primary_guest.first_name} ${s.primary_guest.last_name || ""}` : "Guest"}
                        </div>
                        <span className="text-[10px] text-slate-400">{s.property ? s.property.property_name_th : "-"}</span>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-500">
                        {s.reservation_number}
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {formatDate(s.check_in_at, language)} - {formatDate(s.check_out_at, language)}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-350">
                        {s.monthly_rate || 0} THB
                      </td>
                      <td className="p-4 text-xs">
                        {currentP ? (
                          <span>
                            💧{currentP.water_amount || 0} / ⚡{currentP.electricity_amount || 0}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {currentP ? currentP.expected_total : 0} THB
                      </td>
                      <td className="p-4 font-mono font-bold text-red-600 dark:text-red-400">
                        {currentP ? currentP.outstanding_amount : 0} THB
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          {currentP ? translatePaymentStatus(currentP.overall_status, language) : "N/A"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                          attention === "RENT_OVERDUE" || attention === "CHECKOUT_OVERDUE"
                            ? "bg-red-100 text-red-800 border border-red-300"
                            : attention === "RENT_DUE_SOON" || attention === "RENT_DUE_TODAY"
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                            : attention === "WATER_PENDING" || attention === "ELECTRICITY_PENDING"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-slate-50 text-slate-400"
                        }`}>
                          {translateAttention(attention, language)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openStayDetails(s)}
                          className="px-2 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-350 transition"
                        >
                          {language === "en" ? "Detail & Billings" : "การชำระและงวดเงิน"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedStay && (
        <div
          onClick={() => setSelectedStay(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4"
          >
            <button
              onClick={() => setSelectedStay(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Active Stay Ledger Workspace" : "คลังข้อมูลผังงวดผู้เข้าพักรายห้อง"}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Stay Reference: Unit {selectedStay.unit?.unit_number} ({selectedStay.reservation_number})
              </p>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#D4AF37]/5 p-2.5 rounded border border-[#D4AF37]/10">
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Billing Basis" : "เกณฑ์คำนวณ"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-250">{translateBillingBasis(selectedStay.billing_basis, language)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Monthly Rental Rate" : "อัตราค่าเช่ารายเดือน"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-250">{selectedStay.monthly_rate || 0} {selectedStay.currency}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Deposit" : "เงินประกัน/มัดจำ"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-250">{selectedStay.deposit_amount || 0} {selectedStay.currency}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{language === "en" ? "Stay Period" : "วันสิ้นสุดตามสัญญา"}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-250">{formatDate(selectedStay.check_out_at, language)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 block">
                  📅 {language === "en" ? "Monthly Charge Periods & Timeline" : "รายการและประวัติตามรอบดิวชำระเงินรายเดือน"}
                </span>
                <button
                  onClick={() => handleGeneratePeriods(selectedStay.id)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded text-[10px] font-bold"
                >
                  {language === "en" ? "↺ Regenerate Stays Periods" : "↺ เรียกเก็บเงินงวดรอบเดือน"}
                </button>
              </div>

              {loadingPeriods ? (
                <LoadingState />
              ) : periods.length === 0 ? (
                <span className="text-xs text-slate-400 italic block">{language === "en" ? "No monthly periods initialized" : "ยังไม่มีงวดดิวชำระรายรอบเดือน ให้คลิกปุ่มเรียกเก็บเงิน"}</span>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {periods.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-700 dark:text-slate-200 text-xs">
                          รอบเดือน: {formatMonthYear(p.period_start, language)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] ${
                          p.overall_status === "PAID" ? "bg-green-100 text-green-800" :
                          p.overall_status === "OVERDUE" ? "bg-red-100 text-red-800 animate-pulse" :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {translatePaymentStatus(p.overall_status, language)}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-500">
                        <div>{language === "en" ? "Rent" : "ค่าห้อง"}: <strong>{p.rent_amount}</strong></div>
                        <div>{language === "en" ? "Water" : "ค่าน้ำ"}: <strong>{p.water_amount !== null ? `${p.water_amount} (${translateUtilityStatus(p.water_status, language)})` : "Pending"}</strong></div>
                        <div>{language === "en" ? "Electricity" : "ค่าไฟ"}: <strong>{p.electricity_amount !== null ? `${p.electricity_amount} (${translateUtilityStatus(p.electricity_status, language)})` : "Pending"}</strong></div>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/50 text-[11px]">
                        <div>{language === "en" ? "Expected" : "ยอดประเมิน"}: <strong className="font-mono text-slate-700 dark:text-slate-300">{p.expected_total}</strong></div>
                        <div>{language === "en" ? "Paid" : "ชำระแล้ว"}: <strong className="font-mono text-green-600">{p.paid_amount}</strong></div>
                        <div>{language === "en" ? "Outstanding" : "ค้างชำระ"}: <strong className="font-mono text-red-600">{p.outstanding_amount}</strong></div>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {language === "en" ? "Due Date" : "ครบกำหนด"}: {formatDate(p.due_date, language)}
                      </div>

                      <button
                        onClick={() => openPeriodEdit(p)}
                        className="w-full text-center bg-slate-200/70 hover:bg-slate-250 text-slate-800 text-[10px] py-1 rounded transition mt-1 font-bold"
                      >
                        {language === "en" ? "Update Readings & Payment Status" : "บันทึกตัวเลขมิเตอร์และการรับเงิน"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedPeriod && (
              <form onSubmit={handleUpdatePeriod} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5">
                  <span className="font-bold text-[#D4AF37]">
                    ⚙ {language === "en" ? "Configure Period Data" : "ปรับปรุงค่าใช้จ่ายและค่าน้ำค่าไฟรายงวด"}
                  </span>
                  <button type="button" onClick={() => setSelectedPeriod(null)} className="text-slate-400 text-xs">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Water Charge Amount (THB)" : "จำนวนเงินค่าน้ำ"}</label>
                    <input
                      type="number"
                      value={waterVal}
                      onChange={(e) => setWaterVal(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-bold"
                      placeholder="e.g. 150"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Water Status" : "สถานะน้ำ"}</label>
                    <select
                      value={waterStat}
                      onChange={(e) => setWaterStat(e.target.value as UtilityStatus)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="PENDING">{translateUtilityStatus("PENDING", language)}</option>
                      <option value="READY">{translateUtilityStatus("READY", language)}</option>
                      <option value="PAID">{translateUtilityStatus("PAID", language)}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Electricity Charge Amount (THB)" : "จำนวนเงินค่าไฟ"}</label>
                    <input
                      type="number"
                      value={elecVal}
                      onChange={(e) => setElecVal(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-bold"
                      placeholder="e.g. 800"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Electricity Status" : "สถานะไฟ"}</label>
                    <select
                      value={elecStat}
                      onChange={(e) => setElecStat(e.target.value as UtilityStatus)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="PENDING">{translateUtilityStatus("PENDING", language)}</option>
                      <option value="READY">{translateUtilityStatus("READY", language)}</option>
                      <option value="PAID">{translateUtilityStatus("PAID", language)}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Rent Status" : "สถานะค่าเช่า"}</label>
                    <select
                      value={rentStat}
                      onChange={(e) => setRentStat(e.target.value as RentStatus)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="PENDING">{translatePaymentStatus("PENDING", language)}</option>
                      <option value="PAID">{translatePaymentStatus("PAID", language)}</option>
                      <option value="OVERDUE">{translatePaymentStatus("OVERDUE", language)}</option>
                      <option value="WAIVED">{translatePaymentStatus("WAIVED", language)}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Overall Status" : "สถานะรวมรอบบิล"}</label>
                    <select
                      value={overallStat}
                      onChange={(e) => setOverallStat(e.target.value as OverallStatus)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-bold"
                    >
                      <option value="NOT_READY">{translatePaymentStatus("NOT_READY", language)}</option>
                      <option value="PENDING">{translatePaymentStatus("PENDING", language)}</option>
                      <option value="PARTIALLY_PAID">{translatePaymentStatus("PARTIALLY_PAID", language)}</option>
                      <option value="PAID">{translatePaymentStatus("PAID", language)}</option>
                      <option value="OVERDUE">{translatePaymentStatus("OVERDUE", language)}</option>
                      <option value="WAIVED">{translatePaymentStatus("WAIVED", language)}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Other Charges (THB)" : "ค่าใชจ่ายอื่นเพิ่มเติม"}</label>
                    <input
                      type="number"
                      value={otherVal}
                      onChange={(e) => setOtherVal(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Discount (THB)" : "ส่วนลดค่าน้ำไฟ"}</label>
                    <input
                      type="number"
                      value={discVal}
                      onChange={(e) => setDiscVal(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900"
                    />
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Amount Paid by Resident (THB)" : "จำนวนเงินชำระจริงจากลูกบ้าน"}</label>
                    <input
                      type="number"
                      value={paidVal}
                      onChange={(e) => setPaidVal(e.target.value)}
                      className="p-1.5 border border-[#D4AF37] rounded dark:bg-slate-900 font-bold font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Operational payment notes" : "หมายเหตุรับชำระ"}</label>
                    <input
                      type="text"
                      value={periodNote}
                      onChange={(e) => setPeriodNote(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none w-full"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold py-2 rounded transition shadow-md shadow-[#D4AF37]/10"
                >
                  {language === "en" ? "Save Period billing details" : "บันทึกและคำนวณยอดชำระ"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
