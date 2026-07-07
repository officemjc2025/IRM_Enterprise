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

  const [allStays, setAllStays] = useState<Reservation[]>([]);
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
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "OUTSTANDING">("ALL");

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
        setAllStays(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, propertyFilter, searchQuery]);

  useEffect(() => {
    if (isAdmin) {
      const timer = setTimeout(() => {
        fetchStaysList();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, fetchStaysList]);

  // Centralized deriveStayAttention derivation logic in memory
  const stays = React.useMemo(() => {
    let list = allStays;
    if (statusFilter !== "ALL") {
      list = list.filter((stay) => {
        const currentP = stay.stay_charge_periods && stay.stay_charge_periods.length > 0
          ? stay.stay_charge_periods[stay.stay_charge_periods.length - 1] as StayChargePeriod
          : null;
        return currentP && currentP.overall_status === statusFilter;
      });
    }
    if (attentionFilter !== "ALL") {
      list = list.filter((stay) => {
        const currentP = stay.stay_charge_periods && stay.stay_charge_periods.length > 0
          ? stay.stay_charge_periods[stay.stay_charge_periods.length - 1] as StayChargePeriod
          : null;
        if (attentionFilter === "ACTION_REQUIRED") {
          return deriveStayAttention(stay, currentP) !== "NORMAL";
        }
        return deriveStayAttention(stay, currentP) === attentionFilter;
      });
    }
    return list;
  }, [allStays, statusFilter, attentionFilter]);

  // Operational metrics for summary cards & quick filter action
  const stats = React.useMemo(() => {
    let occupied = 0;
    let rentDue = 0;
    let rentOverdue = 0;
    let partialPayment = 0;
    let pendingUtilities = 0;
    let checkoutApproaching = 0;
    let checkoutOverdue = 0;
    let extensionPending = 0;
    let actionRequired = 0;

    const todayStr = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Bangkok" });
    const today = new Date(todayStr);
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    allStays.forEach((s: Reservation) => {
      occupied++;
      const currentP = s.stay_charge_periods && s.stay_charge_periods.length > 0
        ? s.stay_charge_periods[s.stay_charge_periods.length - 1] as StayChargePeriod
        : null;

      if (currentP) {
        if (currentP.overall_status === "PENDING" || currentP.overall_status === "NOT_READY") {
          rentDue++;
        }
        if (currentP.overall_status === "OVERDUE") {
          rentOverdue++;
        }
        if (currentP.overall_status === "PARTIALLY_PAID") {
          partialPayment++;
        }
        if (currentP.water_status === "PENDING" || currentP.electricity_status === "PENDING") {
          pendingUtilities++;
        }
      }

      const checkoutMs = new Date(s.check_out_at).getTime();
      const diffDays = (checkoutMs - todayMs) / (1000 * 60 * 60 * 24);
      if (diffDays < 0) {
        checkoutOverdue++;
      } else if (diffDays <= 7) {
        checkoutApproaching++;
      }

      const hasPendingExt = s.extensions && s.extensions.some(ext => ext.status === "PENDING_APPROVAL");
      if (hasPendingExt) {
        extensionPending++;
      }

      const att = deriveStayAttention(s, currentP);
      if (att && att !== "NORMAL") {
        actionRequired++;
      }
    });

    return {
      occupied,
      rentDue,
      rentOverdue,
      partialPayment,
      pendingUtilities,
      checkoutApproaching,
      checkoutOverdue,
      extensionPending,
      actionRequired
    };
  }, [allStays]);

  // High level Management Operational Summary (Section 18)
  const managerSummary = React.useMemo(() => {
    let totalOutstanding = 0;
    let totalOverdueOutstanding = 0;

    allStays.forEach((s: Reservation) => {
      const periods = s.stay_charge_periods || [];
      periods.forEach((p: StayChargePeriod) => {
        totalOutstanding += (p.outstanding_amount || 0);
        if (p.overall_status === "OVERDUE") {
          totalOverdueOutstanding += (p.outstanding_amount || 0);
        }
      });
    });

    return {
      totalOutstanding,
      totalOverdueOutstanding
    };
  }, [allStays]);

  // Operational Checkout Readiness Panel (Section 17)
  const readiness = React.useMemo(() => {
    if (!selectedStay) return null;

    let totalOutstanding = 0;
    let overdueCount = 0;
    let waterIncompleteCount = 0;
    let electricityIncompleteCount = 0;
    const pendingExt = selectedStay.extensions?.find(ext => ext.status === "PENDING_APPROVAL") || null;
    const attentionList = [];

    const periodsToScan = periods || [];
    periodsToScan.forEach(p => {
      totalOutstanding += (p.outstanding_amount || 0);
      if (p.overall_status === "OVERDUE") {
        overdueCount++;
      }
      if (p.water_status === "PENDING") {
        waterIncompleteCount++;
      }
      if (p.electricity_status === "PENDING") {
        electricityIncompleteCount++;
      }
    });

    const currentP = periodsToScan.length > 0 ? periodsToScan[periodsToScan.length - 1] : null;
    const att = deriveStayAttention(selectedStay, currentP);
    if (att && att !== "NORMAL") {
      attentionList.push(translateAttention(att, language));
    }

    return {
      totalOutstanding,
      overdueCount,
      waterIncompleteCount,
      electricityIncompleteCount,
      pendingExt,
      attentionList
    };
  }, [selectedStay, periods, language]);

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
    setTimelineFilter("ALL");
    fetchStayPeriods(stay.id);
  };

  const openPeriodEditWithFocus = (p: StayChargePeriod, focusField: "WATER" | "PAID" | null) => {
    openPeriodEdit(p);
    setTimeout(() => {
      if (focusField === "WATER") {
        document.getElementById("water-input-field")?.focus();
      } else if (focusField === "PAID") {
        document.getElementById("paid-input-field")?.focus();
      }
    }, 100);
  };

  const handleApproveExtension = async (extId: string, requestedAmount: number) => {
    const amountStr = prompt(
      language === "en"
        ? "Enter approved extension amount (THB):"
        : "ระบุจำนวนเงินที่อนุมัติสำหรับขยายเวลาพัก (บาท):",
      requestedAmount.toString()
    );
    if (amountStr === null) return;
    const approvedAmount = parseFloat(amountStr);
    if (isNaN(approvedAmount) || approvedAmount < 0) {
      alert(language === "en" ? "Invalid amount entered" : "จำนวนเงินไม่ถูกต้อง");
      return;
    }

    try {
      if (!selectedStay) return;
      const res = await fetch(`/api/v1/reservations/${selectedStay.id}/extensions/${extId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_amount: approvedAmount })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Extension approved, stay checkout date extended!" : "อนุมัติการต่ออายุและขยายวันสิ้นสุดสำเร็จ!");
        
        // Re-fetch the stay details to refresh state
        const updatedStayRes = await fetch(`/api/v1/stays`);
        const updatedStayJson = await updatedStayRes.json();
        if (updatedStayJson.success) {
          const list = updatedStayJson.data || [];
          setAllStays(list);
          const matching = list.find((s: Reservation) => s.id === selectedStay.id);
          if (matching) setSelectedStay(matching);
        }
      } else {
        alert(json.message || "Failed to approve extension");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckoutGuest = async () => {
    if (!selectedStay) return;
    
    const confirmMsg = language === "en"
      ? "Are you sure you want to checkout this guest?"
      : "คุณแน่ใจหรือไม่ว่าต้องการดำเนินการเช็คเอาต์ผู้เข้าพัก?";
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/v1/reservations/${selectedStay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CHECKED_OUT" })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Guest checked out successfully" : "เช็คเอาต์ผู้เข้าพักสำเร็จ");
        setSelectedStay(null);
        fetchStaysList();
      } else {
        alert(json.message || "Failed to checkout guest");
      }
    } catch (err) {
      console.error(err);
    }
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
        title={language === "en" ? "Active Stay Command Center" : "ศูนย์ควบคุมผู้เข้าพักอาศัยและรายได้งวด"}
      />

      {/* Active Stay Operational Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div 
          onClick={() => { setAttentionFilter("ALL"); setStatusFilter("ALL"); }}
          className={"p-4 bg-white dark:bg-slate-800 border rounded-2xl cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-400/85 transition-all shadow-sm " + (
            attentionFilter === "ALL" && statusFilter === "ALL" ? "border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/20 bg-indigo-50/10" : "border-slate-200/60 dark:border-slate-700/60"
          )}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{language === "en" ? "Currently Occupied" : "กำลังเข้าพัก"}</span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{stats.occupied}</div>
        </div>

        <div 
          onClick={() => { setAttentionFilter("ALL"); setStatusFilter("PENDING"); }}
          className={"p-4 bg-white dark:bg-slate-800 border rounded-2xl cursor-pointer hover:border-amber-400 dark:hover:border-amber-400/85 transition-all shadow-sm " + (
            statusFilter === "PENDING" ? "border-amber-500 dark:border-amber-400 ring-1 ring-amber-500/20 bg-amber-50/10" : "border-slate-200/60 dark:border-slate-700/60"
          )}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{language === "en" ? "Rent Due" : "ครบกำหนดชำระ"}</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.rentDue}</div>
        </div>

        <div 
          onClick={() => { setAttentionFilter("ALL"); setStatusFilter("OVERDUE"); }}
          className={"p-4 bg-white dark:bg-slate-800 border rounded-2xl cursor-pointer hover:border-rose-400 dark:hover:border-rose-400/85 transition-all shadow-sm " + (
            statusFilter === "OVERDUE" ? "border-rose-500 dark:border-rose-400 ring-1 ring-rose-500/20 bg-rose-50/10" : "border-slate-200/60 dark:border-slate-700/60"
          )}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{language === "en" ? "Overdue Rent" : "ค้างชำระค่าเช่า"}</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-455 mt-1">{stats.rentOverdue}</div>
        </div>

        <div 
          onClick={() => { setAttentionFilter("WATER_PENDING"); setStatusFilter("ALL"); }}
          className={"p-4 bg-white dark:bg-slate-800 border rounded-2xl cursor-pointer hover:border-sky-400 dark:hover:border-sky-400/85 transition-all shadow-sm " + (
            attentionFilter === "WATER_PENDING" ? "border-sky-500 dark:border-sky-400 ring-1 ring-sky-500/20 bg-sky-50/10" : "border-slate-200/60 dark:border-slate-700/60"
          )}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{language === "en" ? "Pending Meters" : "รอค่าน้ำ/ค่าไฟ"}</span>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{stats.pendingUtilities}</div>
        </div>

        <div 
          onClick={() => { setAttentionFilter("ACTION_REQUIRED"); setStatusFilter("ALL"); }}
          className={"p-4 bg-white dark:bg-slate-800 border rounded-2xl cursor-pointer hover:border-rose-600 dark:hover:border-rose-500 transition-all shadow-sm relative overflow-hidden " + (
            attentionFilter === "ACTION_REQUIRED" ? "border-rose-600 dark:border-rose-500 ring-1 ring-rose-500/20 bg-rose-50/10" : "border-slate-200/60 dark:border-slate-700/60"
          )}
        >
          {stats.actionRequired > 0 && (
            <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-rose-500 m-2 animate-pulse" />
          )}
          <span className="text-[10px] font-bold text-rose-500 dark:text-rose-455 uppercase tracking-wider block">{language === "en" ? "Action Required" : "ต้องดำเนินการ"}</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-500 mt-1">{stats.actionRequired}</div>
        </div>
      </div>

      {/* Manager Summary Card (Section 18) */}
      <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl p-4 flex flex-wrap gap-x-8 gap-y-3 justify-between items-center text-xs">
        <div>
          <span className="font-bold text-[#D4AF37] block uppercase text-[10px]">{language === "en" ? "Management Operational Summary" : "แผงควบคุมฝ่ายจัดการ (สรุปยอดปฏิบัติการ)"}</span>
          <span className="text-slate-400 text-[10px]">{language === "en" ? "Aggregated active stays outstanding amounts" : "ยอดหนี้ค้างชำระของห้องพักที่อยู่ระหว่างการเข้าพัก"}</span>
        </div>
        <div className="flex gap-x-8">
          <div>
            <span className="text-slate-400 block">{language === "en" ? "Total Outstanding" : "ยอดคงค้างสะสม"}:</span>
            <strong className="text-sm font-mono text-slate-800 dark:text-slate-250">{managerSummary.totalOutstanding.toLocaleString()} THB</strong>
          </div>
          <div>
            <span className="text-slate-400 block">{language === "en" ? "Total Overdue Outstanding" : "ยอดค้างชำระเกินกำหนด"}:</span>
            <strong className="text-sm font-mono text-rose-600 dark:text-rose-455">{managerSummary.totalOverdueOutstanding.toLocaleString()} THB</strong>
          </div>
        </div>
      </div>

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
                <option value="ALL">{language === "en" ? "ALL PROPERTIES" : "ทุกโครงการ"}</option>
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
                <option value="ALL">{language === "en" ? "ALL STATUSES" : "ทุกสถานะการชำระ"}</option>
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
                <option value="ALL">{language === "en" ? "ALL ATTENTION" : "ทุกสถานะติดตาม"}</option>
                <option value="ACTION_REQUIRED">{translateAttention("ACTION_REQUIRED", language)}</option>
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

            {(propertyFilter !== "ALL" || statusFilter !== "ALL" || attentionFilter !== "ALL" || searchQuery !== "") && (
              <button
                type="button"
                onClick={() => {
                  setPropertyFilter("ALL");
                  setStatusFilter("ALL");
                  setAttentionFilter("ALL");
                  setSearchQuery("");
                }}
                className="text-[10px] text-rose-600 dark:text-rose-455 font-bold hover:underline self-end mb-1.5"
              >
                {language === "en" ? "✕ Reset Filters" : "✕ ล้างตัวกรองทั้งหมด"}
              </button>
            )}
          </div>
          
          <div className="flex w-full md:w-64 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 bg-slate-50 dark:bg-slate-900 text-xs">
            <span className="text-slate-400 self-center px-1.5">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "en" ? "Search Unit / Guest..." : "ค้นหาห้องชุด / ชื่อลูกบ้าน..."}
              className="bg-transparent outline-none w-full text-slate-800 dark:text-slate-200"
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
                  <th className="p-4">{language === "en" ? "Check-in" : "วันที่เข้าพัก"}</th>
                  <th className="p-4">{language === "en" ? "Checkout" : "กำหนดออก"}</th>
                  <th className="p-4">{language === "en" ? "Current Period" : "รอบบิลปัจจุบัน"}</th>
                  <th className="p-4">{language === "en" ? "Rent" : "ค่าเช่า"}</th>
                  <th className="p-4">{language === "en" ? "Water" : "ค่าน้ำ"}</th>
                  <th className="p-4">{language === "en" ? "Elec" : "ค่าไฟ"}</th>
                  <th className="p-4">{language === "en" ? "Total" : "รวม"}</th>
                  <th className="p-4">{language === "en" ? "Paid" : "ชำระแล้ว"}</th>
                  <th className="p-4">{language === "en" ? "Outstanding" : "คงค้าง"}</th>
                  <th className="p-4">{language === "en" ? "Payment Status" : "สถานะการชำระ"}</th>
                  <th className="p-4">{language === "en" ? "Attention" : "ต้องดำเนินการ"}</th>
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
                        <div className="text-[10px] font-normal text-slate-400">
                          {s.property ? (language === "en" ? s.property.property_name_en || s.property.property_name_th : s.property.property_name_th) : (language === "en" ? "No Property" : "ยังไม่ระบุ")}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.primary_guest ? (s.primary_guest.first_name + " " + (s.primary_guest.last_name || "")) : "Guest"}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{s.reservation_number}</span>
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {formatDate(s.check_in_at, language)}
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {formatDate(s.check_out_at, language)}
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-650 dark:text-slate-400">
                        {currentP ? (formatDate(currentP.period_start, language) + " - " + formatDate(currentP.period_end, language)) : (language === "en" ? "No Current Period" : "ยังไม่มีรอบปัจจุบัน")}
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-700 dark:text-slate-355 font-bold">
                        {currentP ? currentP.rent_amount.toLocaleString() : (s.monthly_rate || 0).toLocaleString()} ฿
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-400">
                        {currentP && currentP.water_amount !== null ? currentP.water_amount.toLocaleString() + " ฿" : (language === "en" ? "Pending" : "ไม่มีข้อมูล")}
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-400">
                        {currentP && currentP.electricity_amount !== null ? currentP.electricity_amount.toLocaleString() + " ฿" : (language === "en" ? "Pending" : "ไม่มีข้อมูล")}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                        {currentP ? currentP.expected_total.toLocaleString() : 0} ฿
                      </td>
                      <td className="p-4 font-mono text-green-600 dark:text-green-400 font-semibold">
                        {currentP ? currentP.paid_amount.toLocaleString() : 0} ฿
                      </td>
                      <td className="p-4 font-mono font-bold text-red-655 dark:text-red-400 font-black">
                        {currentP ? currentP.outstanding_amount.toLocaleString() : 0} ฿
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          {currentP ? translatePaymentStatus(currentP.overall_status, language) : (language === "en" ? "N/A" : "ไม่มีข้อมูล")}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={"px-2 py-0.5 rounded font-bold text-[9px] uppercase " + (
                          attention === "RENT_OVERDUE" || attention === "CHECKOUT_OVERDUE"
                            ? "bg-red-100 text-red-800 border border-red-300 dark:bg-red-955/30 dark:text-red-400 dark:border-red-800"
                            : attention === "RENT_DUE_SOON" || attention === "RENT_DUE_TODAY"
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-955/30 dark:text-yellow-400 dark:border-yellow-800"
                            : attention === "WATER_PENDING" || attention === "ELECTRICITY_PENDING"
                            ? "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-955/30 dark:text-blue-400 dark:border-blue-800"
                            : "bg-slate-50 text-slate-450 dark:bg-slate-900 dark:text-slate-500"
                        )}>
                          {translateAttention(attention, language)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openStayDetails(s)}
                          className="px-2 py-1 border border-[#D4AF37] hover:bg-[#D4AF37]/5 text-xs font-semibold rounded text-[#D4AF37] transition font-bold"
                        >
                          {language === "en" ? "Manage Stay" : "จัดการการเข้าพัก"}
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

      {selectedStay && (() => {
        const r = readiness;
        if (!r) return null;
        const pendingExt = r.pendingExt;
        return (
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

              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3 text-xs">
                {/* 1. ข้อมูลการเข้าพัก */}
                <div className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/10">
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">
                    📋 {language === "en" ? "Stay Information" : "ข้อมูลการเข้าพัก"}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">{language === "en" ? "Billing Basis" : "เกณฑ์คำนวณ"}:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{translateBillingBasis(selectedStay.billing_basis, language)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{language === "en" ? "Monthly Rental Rate" : "อัตราค่าเช่ารายเดือน"}:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedStay.monthly_rate || 0} {selectedStay.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{language === "en" ? "Deposit" : "เงินประกัน/มัดจำ"}:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedStay.deposit_amount || 0} {selectedStay.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{language === "en" ? "Contract End Date" : "วันสิ้นสุดตามสัญญา"}:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatDate(selectedStay.check_out_at, language)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. ยอดคงค้างสะสม & Follow-up */}
              {(() => {
                const outstandingPeriods = periods.filter(p => p.outstanding_amount > 0);
                if (outstandingPeriods.length > 0) {
                  return (
                    <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-800/40 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-red-700 dark:text-red-400">
                          ⚠️ {language === "en" ? "Outstanding: " + outstandingPeriods.length + " periods" : "ค้างชำระ " + outstandingPeriods.length + " รอบ"}
                        </div>
                        <div className="text-[10px] text-red-655 dark:text-red-450 font-mono">
                          {language === "en" ? "Accumulated Balance" : "ยอดคงค้างสะสม"}: <strong>{outstandingPeriods.reduce((sum, p) => sum + p.outstanding_amount, 0).toLocaleString()} ฿</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTimelineFilter(timelineFilter === "OUTSTANDING" ? "ALL" : "OUTSTANDING")}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-sm transition"
                      >
                        {timelineFilter === "OUTSTANDING"
                          ? (language === "en" ? "Show All" : "ดูรอบทั้งหมด")
                          : (language === "en" ? "View Outstanding" : "ดูรอบที่ค้างชำระ")}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {/* 3. รอบค่าใช้จ่ายปัจจุบัน & ค่าน้ำ/ค่าไฟ/การชำระเงิน Quick Actions */}
              {(() => {
                const currentP = periods.length > 0 ? periods[periods.length - 1] : null;
                if (!currentP) return (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400 italic">
                    {language === "en" ? "No current billing period" : "ยังไม่มีรอบปัจจุบัน"}
                  </div>
                );

                return (
                  <div className="border border-[#D4AF37]/35 rounded-xl p-3 bg-[#D4AF37]/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-[#D4AF37] uppercase">
                        ⚡ {language === "en" ? "Current Billing Period" : "รอบค่าใช้จ่ายปัจจุบัน"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatMonthYear(currentP.period_start, language)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">{language === "en" ? "Rent" : "ค่าห้อง"}</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">{currentP.rent_amount.toLocaleString()} ฿</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">{language === "en" ? "Water" : "ค่าน้ำ"}</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">{currentP.water_amount !== null ? currentP.water_amount.toLocaleString() + " ฿" : (language === "en" ? "Pending" : "ยังไม่บันทึก")}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">{language === "en" ? "Electricity" : "ค่าไฟ"}</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">{currentP.electricity_amount !== null ? currentP.electricity_amount.toLocaleString() + " ฿" : (language === "en" ? "Pending" : "ยังไม่บันทึก")}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-1.5 border-t border-slate-100 dark:border-slate-700 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px]">{language === "en" ? "Total Expected" : "ยอดรวมประเมิน"}</span>
                        <strong className="text-slate-800 dark:text-slate-200">{currentP.expected_total.toLocaleString()} ฿</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">{language === "en" ? "Paid" : "ชำระแล้ว"}</span>
                        <strong className="text-green-600 font-bold">{currentP.paid_amount.toLocaleString()} ฿</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">{language === "en" ? "Outstanding" : "คงค้าง"}</span>
                        <strong className="text-red-600 font-bold">{currentP.outstanding_amount.toLocaleString()} ฿</strong>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openPeriodEditWithFocus(currentP, "WATER")}
                        className="flex-1 text-center bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-955/30 dark:text-sky-400 text-[10px] py-1.5 rounded transition font-bold border border-sky-200/50 dark:border-sky-850/40"
                      >
                        💧/⚡ {language === "en" ? "Record Utilities" : "บันทึกค่าน้ำ/ค่าไฟ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openPeriodEditWithFocus(currentP, "PAID")}
                        className="flex-1 text-center bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-955/30 dark:text-green-400 text-[10px] py-1.5 rounded transition font-bold border border-green-200/50 dark:border-green-850/40"
                      >
                        💰 {language === "en" ? "Record Payment" : "บันทึกการชำระ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openPeriodEditWithFocus(currentP, null)}
                        className="flex-1 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-900 dark:text-slate-355 text-[10px] py-1.5 rounded transition font-bold border border-slate-200 dark:border-slate-700"
                      >
                        ⚙ {language === "en" ? "View Period" : "ดูรายละเอียดรอบ"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Pending Extension Request Banner */}
              {pendingExt && (
                <div className="p-3 bg-pink-50 dark:bg-pink-955/20 border border-pink-200 dark:border-pink-850 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-pink-700 dark:text-pink-400">
                      📌 {language === "en" ? "Pending Extension Request" : "คำขอขยายเวลาพัก (ต่อพัก)"}
                    </span>
                    <button
                      onClick={() => handleApproveExtension(pendingExt.id, pendingExt.calculated_amount || selectedStay.monthly_rate || 0)}
                      className="px-2.5 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded text-[10px] font-bold shadow-sm transition"
                    >
                      {language === "en" ? "Approve Extension" : "อนุมัติขยายเวลาพัก"}
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                    <div>{language === "en" ? "Current Checkout" : "วันสิ้นสุดเดิม"}: <strong>{formatDate(selectedStay.check_out_at, language)}</strong></div>
                    <div>{language === "en" ? "Requested Checkout" : "วันสิ้นสุดที่ขอขยาย"}: <strong>{formatDate(pendingExt.requested_check_out_at, language)}</strong></div>
                    <div>{language === "en" ? "Requested Rate" : "อัตราค่าเช่างวดใหม่"}: <strong>{(pendingExt.calculated_amount || 0).toLocaleString() + " THB"}</strong></div>
                  </div>
                </div>
              )}

              {/* Checkout Readiness Panel (Section 17) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-700 dark:text-slate-200">
                    🛎️ {language === "en" ? "Checkout Readiness Summary" : "ความพร้อมก่อนเช็กเอาต์"}
                  </span>
                  <button
                    onClick={handleCheckoutGuest}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-sm transition"
                  >
                    {language === "en" ? "Process Checkout" : "ดำเนินการเช็กเอาต์"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-455 font-mono">
                  <div>{language === "en" ? "Total Outstanding" : "ยอดค้างชำระรวม"}: <strong className={r.totalOutstanding > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>{r.totalOutstanding.toLocaleString()} ฿</strong></div>
                  <div>{language === "en" ? "Overdue Periods" : "งวดที่เกินกำหนดชำระ"}: <strong className={r.overdueCount > 0 ? "text-red-600 font-bold" : "text-slate-600 dark:text-slate-400"}>{r.overdueCount + (language === "en" ? " periods" : " รอบ")}</strong></div>
                  <div>{language === "en" ? "Water Meter Missing" : "ค้างบันทึกค่าน้ำ"}: <strong className={r.waterIncompleteCount > 0 ? "text-amber-600 font-bold" : "text-slate-600 dark:text-slate-400"}>{r.waterIncompleteCount + (language === "en" ? " periods" : " รอบ")}</strong></div>
                  <div>{language === "en" ? "Electricity Meter Missing" : "ค้างบันทึกค่าไฟ"}: <strong className={r.electricityIncompleteCount > 0 ? "text-amber-600 font-bold" : "text-slate-600 dark:text-slate-400"}>{r.electricityIncompleteCount + (language === "en" ? " periods" : " รอบ")}</strong></div>
                </div>
                {r.attentionList.length > 0 && (
                  <div className="text-[10px] text-amber-700 dark:text-amber-450 bg-amber-50 dark:bg-amber-955/20 p-2 rounded">
                    ⚠️ {language === "en" ? "Attention Items" : "ประเด็นที่ต้องตรวจสอบ"}: {r.attentionList.join(", ")}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 block">
                    📅 {language === "en" ? "Monthly Charge Periods & Timeline" : "ประวัติรอบค่าใช้จ่าย (Timeline)"}
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
                  <span className="text-xs text-slate-400 italic block">{language === "en" ? "No monthly periods initialized" : "ยังไม่มีรอบบัญชี"}</span>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {periods
                      .filter((p) => {
                        if (timelineFilter === "OUTSTANDING") {
                          return p.outstanding_amount > 0;
                        }
                        return true;
                      })
                      .map((p) => {
                        const isOverdue = p.overall_status === "OVERDUE";
                        const needsMeter = p.water_status === "PENDING" || p.electricity_status === "PENDING";
                        const hasActionNeeded = isOverdue || needsMeter;

                        return (
                          <div 
                            key={p.id} 
                            className={"p-3 border rounded-xl space-y-2 text-xs transition-all " + (
                              hasActionNeeded 
                                ? "bg-amber-50/40 dark:bg-amber-955/10 border-amber-300 dark:border-amber-900" 
                                : "bg-slate-50 dark:bg-slate-900 border border-slate-200/50"
                            )}
                          >
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-700 dark:text-slate-200 text-xs">
                                รอบเดือน: {formatMonthYear(p.period_start, language)}
                              </span>
                              <div className="flex gap-1.5 items-center">
                                {hasActionNeeded && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-amber-500 text-white font-black animate-pulse">
                                    {language === "en" ? "ACTION REQUIRED" : "ต้องดำเนินการ"}
                                  </span>
                                )}
                                <span className={"px-2 py-0.5 rounded text-[9px] " + (
                                  p.overall_status === "PAID" ? "bg-green-100 text-green-800" :
                                  p.overall_status === "OVERDUE" ? "bg-red-100 text-red-800 animate-pulse" :
                                  "bg-yellow-100 text-yellow-800"
                                )}>
                                  {translatePaymentStatus(p.overall_status, language)}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-slate-500 dark:text-slate-455 font-mono">
                              <div>{language === "en" ? "Period Date" : "ช่วงเวลา"}: <strong>{formatDate(p.period_start, language)} - {formatDate(p.period_end, language)}</strong></div>
                              <div>{language === "en" ? "Due Date" : "ครบกำหนด"}: <strong>{formatDate(p.due_date, language)}</strong></div>
                              <div>{language === "en" ? "Rent" : "ค่าเช่า"}: <strong>{p.rent_amount.toLocaleString()} ฿</strong></div>
                              <div>{language === "en" ? "Discount" : "ส่วนลด"}: <strong>{p.discount_amount.toLocaleString()} ฿</strong></div>
                              <div>{language === "en" ? "Water" : "ค่าน้ำ"}: <strong>{p.water_amount !== null ? p.water_amount.toLocaleString() + " ฿" : (language === "en" ? "Missing" : "ยังไม่บันทึก")}</strong></div>
                              <div>{language === "en" ? "Electricity" : "ค่าไฟ"}: <strong>{p.electricity_amount !== null ? p.electricity_amount.toLocaleString() + " ฿" : (language === "en" ? "Missing" : "ยังไม่บันทึก")}</strong></div>
                            </div>

                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/50 text-[11px] font-mono">
                              <div>{language === "en" ? "Total Expected" : "ยอดประเมิน"}: <strong className="text-slate-700 dark:text-slate-355">{p.expected_total.toLocaleString()} ฿</strong></div>
                              <div>{language === "en" ? "Paid" : "ชำระแล้ว"}: <strong className="font-bold text-green-600">{p.paid_amount.toLocaleString()} ฿</strong></div>
                              <div>{language === "en" ? "Outstanding" : "ค้างชำระ"}: <strong className="text-red-655 font-bold">{p.outstanding_amount.toLocaleString()} ฿</strong></div>
                            </div>

                            <button
                              type="button"
                              onClick={() => openPeriodEdit(p)}
                              className="w-full text-center bg-slate-200/70 hover:bg-slate-250 text-slate-800 text-[10px] py-1 rounded transition mt-1 font-bold"
                            >
                              {language === "en" ? "Update Readings & Payment Status" : "บันทึกตัวเลขมิเตอร์และการรับเงิน"}
                            </button>
                          </div>
                        );
                      })}
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
                        id="water-input-field"
                        value={waterVal}
                        onChange={(e) => setWaterVal(e.target.value)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Water Status" : "สถานะค่าน้ำ"}</label>
                      <select
                        value={waterStat}
                        onChange={(e) => setWaterStat(e.target.value as UtilityStatus)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-semibold"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Electricity Charge Amount (THB)" : "จำนวนเงินค่าไฟ"}</label>
                      <input
                        type="number"
                        value={elecVal}
                        onChange={(e) => setElecVal(e.target.value)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Electricity Status" : "สถานะค่าไฟ"}</label>
                      <select
                        value={elecStat}
                        onChange={(e) => setElecStat(e.target.value as UtilityStatus)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-semibold"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="COMPLETED">COMPLETED</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Rent Status" : "สถานะค่าเช่าห้อง"}</label>
                      <select
                        value={rentStat}
                        onChange={(e) => setRentStat(e.target.value as RentStatus)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-semibold"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAID">PAID</option>
                        <option value="OVERDUE">OVERDUE</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Overall Period Status" : "สถานะรอบบิลรวม"}</label>
                      <select
                        value={overallStat}
                        onChange={(e) => setOverallStat(e.target.value as OverallStatus)}
                        className="p-1.5 border border-[#D4AF37] rounded dark:bg-slate-900 font-bold"
                      >
                        <option value="NOT_READY">NOT READY</option>
                        <option value="PENDING">PENDING</option>
                        <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                        <option value="PAID">PAID</option>
                        <option value="OVERDUE">OVERDUE</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Other Charges (THB)" : "ค่าใช้อื่นๆเพิ่มเติม"}</label>
                      <input
                        type="number"
                        value={otherVal}
                        onChange={(e) => setOtherVal(e.target.value)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Discounts Applied (THB)" : "ส่วนลดพิเศษ"}</label>
                      <input
                        type="number"
                        value={discVal}
                        onChange={(e) => setDiscVal(e.target.value)}
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Amount Paid by Resident (THB)" : "จำนวนเงินชำระจริงจากลูกบ้าน"}</label>
                      <input
                        type="number"
                        id="paid-input-field"
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
        );
      })()
}

    </div>
  );
}
