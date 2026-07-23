"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { WorkOrder, WorkOrderPriority, deriveAttentionStatus } from "@/features/work-order/types/work-order.types";
import { PageHeader, LoadingState, LocalizedDatePicker, LocalizedDateTimePicker } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { formatDate } from "@/shared/utils";

interface TechnicianProfile {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string;
  phone: string | null;
}

// -----------------------------------------------------------------------------
// Timezone Helpers (explicitly formatted in Asia/Bangkok)
// -----------------------------------------------------------------------------
function getBangkokParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map(p => [p.type, p.value]));
  
  return {
    year: parseInt(map.get("year") || "0", 10),
    month: parseInt(map.get("month") || "0", 10) - 1, // 0-indexed
    day: parseInt(map.get("day") || "0", 10),
    hour: parseInt(map.get("hour") || "0", 10),
    minute: parseInt(map.get("minute") || "0", 10),
    second: parseInt(map.get("second") || "0", 10),
  };
}

function getCalendarRange(date: Date, view: "MONTH" | "WEEK" | "DAY") {
  const parts = getBangkokParts(date);
  const localDate = new Date(Date.UTC(parts.year, parts.month, parts.day, 12, 0, 0));
  
  let start = new Date(localDate);
  let end = new Date(localDate);
  
  if (view === "MONTH") {
    // Start of month
    start = new Date(Date.UTC(parts.year, parts.month, 1, 0, 0, 0));
    const startDay = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - startDay);
    
    // End of month
    end = new Date(Date.UTC(parts.year, parts.month + 1, 0, 23, 59, 59));
    const endDay = end.getUTCDay();
    end.setUTCDate(end.getUTCDate() + (6 - endDay));
  } else if (view === "WEEK") {
    const dayOfWeek = localDate.getUTCDay();
    start = new Date(localDate);
    start.setUTCDate(localDate.getUTCDate() - dayOfWeek);
    start.setUTCHours(0, 0, 0, 0);
    
    end = new Date(localDate);
    end.setUTCDate(localDate.getUTCDate() + (6 - dayOfWeek));
    end.setUTCHours(23, 59, 59, 999);
  } else {
    start = new Date(localDate);
    start.setUTCHours(0, 0, 0, 0);
    
    end = new Date(localDate);
    end.setUTCHours(23, 59, 59, 999);
  }
  
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

function formatBangkokTime(dateStr: string) {
  const date = new Date(dateStr);
  const parts = getBangkokParts(date);
  const min = String(parts.minute).padStart(2, "0");
  const hr = String(parts.hour).padStart(2, "0");
  return `${hr}:${min}`;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function CalendarPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <CalendarContent />
      </Suspense>
    </MainLayout>
  );
}

const supabase = createClient();

function CalendarContent() {
  const { language } = useLanguage();

  const [role, setRole] = useState<string>("resident");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeDate, setActiveDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<"MONTH" | "WEEK" | "DAY">("WEEK");
  const [teamFilter, setTeamFilter] = useState<"ALL" | "TECHNICIAN" | "HOUSEKEEPING">("ALL");

  const [scheduledOrders, setScheduledOrders] = useState<WorkOrder[]>([]);
  const [unscheduledOrders, setUnscheduledOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal / Detail States
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [housekeepers, setHousekeepers] = useState<TechnicianProfile[]>([]);

  // Editing / Action States inside details modal
  const [assigneeId, setAssigneeId] = useState("");
  const [priorityVal, setPriorityVal] = useState<WorkOrderPriority>("NORMAL");
  const [scheduledAtVal, setScheduledAtVal] = useState("");
  const [serviceTeamVal, setServiceTeamVal] = useState<"TECHNICIAN" | "HOUSEKEEPING" | "INSPECTION_TEAM" | "SUPERVISOR">("TECHNICIAN");
  const [chargeAmountVal, setChargeAmountVal] = useState("");
  const [actualCostVal, setActualCostVal] = useState("");
  const [adminReviewRemark, setAdminReviewRemark] = useState("");
  const [workerReschedDate, setWorkerReschedDate] = useState("");

  const isAdmin = ["admin", "super_admin", "property_admin"].includes(role);
  const isTechnician = role === "technician";
  const isHousekeeper = role === "housekeeping";

  useEffect(() => {
    async function loadUserAndMetadata() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please login to access the operational calendar.");
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, property_id")
          .eq("id", user.id)
          .single();

        const resolvedRole = profile?.role || "resident";
        setRole(resolvedRole);

        if (resolvedRole === "resident") {
          setError("Access Denied: Resident accounts do not have access to the Operational Calendar.");
          setLoading(false);
          return;
        }

        // Hardcode team filters for workers
        if (resolvedRole === "technician") {
          setTeamFilter("TECHNICIAN");
        } else if (resolvedRole === "housekeeping") {
          setTeamFilter("HOUSEKEEPING");
        }

        // Load metadata options for Admin assignment editing
        if (["admin", "super_admin", "property_admin"].includes(resolvedRole)) {
          const [techsRes, housekeepersRes] = await Promise.all([
            supabase.from("profiles").select("id, full_name, display_name, email, phone").eq("role", "technician"),
            supabase.from("profiles").select("id, full_name, display_name, email, phone").eq("role", "housekeeping"),
          ]);
          setTechnicians(techsRes.data || []);
          setHousekeepers(housekeepersRes.data || []);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to initialize user session");
      }
    }
    loadUserAndMetadata();
  }, []);

  // Fetch range-based calendar data & unscheduled jobs list
  const refreshCalendarData = React.useCallback(async () => {
    if (role === "resident") return;
    try {
      setLoading(true);
      const range = getCalendarRange(activeDate, viewMode);
      
      // 1. Fetch range-bounded calendar jobs
      const calendarUrl = `/api/v1/work-orders?start=${range.start}&end=${range.end}&service_team=${teamFilter}`;
      const resCal = await fetch(calendarUrl);
      const jsonCal = await resCal.json();
      
      if (!jsonCal.success) {
        throw new Error(jsonCal.message || "Failed to load scheduled work orders");
      }
      setScheduledOrders(jsonCal.data || []);

      // 2. Fetch all active work orders without start/end to discover unscheduled jobs
      const allUrl = `/api/v1/work-orders?service_team=${teamFilter}`;
      const resAll = await fetch(allUrl);
      const jsonAll = await resAll.json();
      
      if (jsonAll.success) {
        const allJobs: WorkOrder[] = jsonAll.data || [];
        // Unscheduled are those where scheduled_at is null and not completed/closed/cancelled
        const unscheduled = allJobs.filter((o) => !o.scheduled_at && !["COMPLETED", "CLOSED", "CANCELLED"].includes(o.status));
        setUnscheduledOrders(unscheduled);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to load operational calendar data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeDate, viewMode, teamFilter, role]);

  useEffect(() => {
    if (role !== "resident") {
      const timer = setTimeout(() => {
        refreshCalendarData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [role, refreshCalendarData]);

  // Sync state when details modal opens
  const openOrderDetails = (order: WorkOrder) => {
    setSelectedOrder(order);
    setAssigneeId(order.assigned_to || "");
    setPriorityVal(order.priority || "NORMAL");
    setScheduledAtVal(order.scheduled_at ? new Date(order.scheduled_at).toISOString().slice(0, 16) : "");
    setServiceTeamVal(order.service_team || "TECHNICIAN");
    setChargeAmountVal(order.charge_amount !== null && order.charge_amount !== undefined ? String(order.charge_amount) : "");
    setActualCostVal(order.actual_cost !== null && order.actual_cost !== undefined ? String(order.actual_cost) : "");
    setAdminReviewRemark("");
    setWorkerReschedDate("");
  };

  const refreshOrderDetails = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`);
      const json = await res.json();
      if (json.success) {
        openOrderDetails(json.data);
      }
      refreshCalendarData();
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------------------------------------------------------
  // Operational Action Handlers (Acknowledge, Start, Pause, Resume, Complete)
  // -----------------------------------------------------------------------------
  const handleAdminAssign = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: assigneeId || null,
          priority: priorityVal,
          service_team: serviceTeamVal,
          scheduled_at: scheduledAtVal ? new Date(scheduledAtVal).toISOString() : null,
          charge_amount: chargeAmountVal ? parseFloat(chargeAmountVal) : null,
          actual_cost: actualCostVal ? parseFloat(actualCostVal) : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Work order updated successfully" : "อัปเดตใบสั่งงานเสร็จสิ้น");
        refreshOrderDetails(orderId);
      } else {
        alert(json.message || "Failed to save assignments");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseTicket = async (orderId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to close this work order?" : "คุณแน่ใจหรือไม่ว่าต้องการปิดงานใบสั่งงานนี้?")) return;
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      const json = await res.json();
      if (json.success) {
        refreshOrderDetails(orderId);
      } else {
        alert(json.message || "Failed to close ticket");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reschedule actions (History/Review)
  const handleReviewRequest = async (changeId: string, targetStatus: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/v1/work-orders/${selectedOrder?.id}/schedule-changes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_id: changeId,
          status: targetStatus,
          review_remark: adminReviewRemark
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAdminReviewRemark("");
        refreshOrderDetails(selectedOrder!.id);
      } else {
        alert(json.message || "Failed to process reschedule request");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWorkerReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as HTMLFormElement;
    const timeInput = (target.elements.namedItem("reschedTime") as HTMLInputElement).value;
    const reasonInput = (target.elements.namedItem("reschedReason") as HTMLInputElement).value;

    if (!workerReschedDate || !timeInput || !reasonInput.trim()) {
      alert("Please fill in all reschedule request fields.");
      return;
    }

    const bangkokTime = new Date(`${workerReschedDate}T${timeInput}:00`);
    try {
      const res = await fetch(`/api/v1/work-orders/${selectedOrder?.id}/schedule-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_scheduled_at: bangkokTime.toISOString(),
          reason: reasonInput.trim()
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Reschedule request submitted successfully." : "ยื่นคำขอเลื่อนวันเวลาปฏิบัติงานสำเร็จ");
        refreshOrderDetails(selectedOrder!.id);
      } else {
        alert(json.message || "Failed to submit request");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelRequest = async (changeId: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to cancel this reschedule request?" : "ยืนยันการยกเลิกคำขอเลื่อนเวลานี้?")) return;
    try {
      const res = await fetch(`/api/v1/work-orders/${selectedOrder?.id}/schedule-changes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change_id: changeId,
          status: "CANCELLED"
        }),
      });
      const json = await res.json();
      if (json.success) {
        refreshOrderDetails(selectedOrder!.id);
      } else {
        alert(json.message || "Failed to cancel reschedule request");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------------------------------------------------------
  // Navigation / Date math helpers
  // -----------------------------------------------------------------------------
  const handlePrev = () => {
    const nextDate = new Date(activeDate);
    if (viewMode === "MONTH") {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else if (viewMode === "WEEK") {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setDate(nextDate.getDate() - 1);
    }
    setActiveDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(activeDate);
    if (viewMode === "MONTH") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (viewMode === "WEEK") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    setActiveDate(nextDate);
  };

  const handleToday = () => {
    setActiveDate(new Date());
  };

  // Determine title text for calendar active range
  const getRangeTitleText = () => {
    const parts = getBangkokParts(activeDate);
    const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthsTh = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    
    if (viewMode === "MONTH") {
      return language === "en" 
        ? `${monthsEn[parts.month]} ${parts.year}`
        : `${monthsTh[parts.month]} พ.ศ. ${parts.year + 543}`;
    } else if (viewMode === "WEEK") {
      // Find start and end Sunday to Saturday
      const startRange = new Date(activeDate);
      startRange.setDate(activeDate.getDate() - activeDate.getDay());
      const endRange = new Date(startRange);
      endRange.setDate(startRange.getDate() + 6);
      
      const sParts = getBangkokParts(startRange);
      const eParts = getBangkokParts(endRange);
      
      return language === "en"
        ? `${sParts.day} ${monthsEn[sParts.month]} - ${eParts.day} ${monthsEn[eParts.month]} ${eParts.year}`
        : `${sParts.day} ${monthsTh[sParts.month]} - ${eParts.day} ${monthsTh[eParts.month]} พ.ศ. ${eParts.year + 543}`;
    } else {
      return language === "en"
        ? `${parts.day} ${monthsEn[parts.month]} ${parts.year}`
        : `${parts.day} ${monthsTh[parts.month]} พ.ศ. ${parts.year + 543}`;
    }
  };

  if (error && role === "resident") {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-md">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
          {language === "en" ? "Access Denied" : "ปฏิเสธการเข้าถึง"}
        </h2>
        <p className="text-slate-500 dark:text-slate-300">{error}</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------------
  // Render Day Events stack helper
  // -----------------------------------------------------------------------------
  const renderDayEvents = (targetDate: Date) => {
    const targetParts = getBangkokParts(targetDate);
    
    const dayJobs = scheduledOrders.filter((wo) => {
      if (!wo.scheduled_at) return false;
      const jobParts = getBangkokParts(new Date(wo.scheduled_at));
      return jobParts.year === targetParts.year && jobParts.month === targetParts.month && jobParts.day === targetParts.day;
    });

    // Sort chronologically by scheduled_at
    const sortedJobs = [...dayJobs].sort((a, b) => {
      return new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime();
    });

    if (sortedJobs.length === 0) {
      return null;
    }

    return (
      <div className="space-y-1.5 mt-1 overflow-y-auto max-h-36 pr-1">
        {sortedJobs.map((wo) => {
          const attStatus = deriveAttentionStatus(wo);
          const timeText = formatBangkokTime(wo.scheduled_at!);
          
          return (
            <div
              key={wo.id}
              onClick={(e) => {
                e.stopPropagation();
                openOrderDetails(wo);
              }}
              className={`p-1.5 rounded text-[11px] font-semibold transition cursor-pointer select-none border ${
                attStatus === "PENDING_RESCHEDULE_APPROVAL"
                  ? "bg-yellow-100/90 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400 border-yellow-300 animate-pulse font-bold"
                  : wo.service_team === "TECHNICIAN"
                  ? "bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-300 border-blue-200/40"
                  : "bg-purple-50 text-purple-900 dark:bg-purple-950/30 dark:text-purple-300 border-purple-200/40"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[9px]">{timeText}</span>
                <span className={`px-1 text-[8px] font-extrabold rounded ${
                  wo.service_team === "TECHNICIAN" ? "bg-blue-200 text-blue-800" : "bg-purple-200 text-purple-800"
                }`}>
                  {wo.service_team === "TECHNICIAN" ? "ช่าง" : "แม่บ้าน"}
                </span>
              </div>
              <div className="truncate mt-0.5" title={wo.title}>
                {wo.title}
              </div>
              <div className="text-[9px] opacity-75 truncate">
                Unit {wo.unit?.unit_number || "-"}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Calendar Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <PageHeader
          title={language === "en" ? "Operational Calendar" : "ปฏิทินปฏิบัติการงานบริการ"}
        />
        
        {/* Navigation Actions */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={handlePrev}
              className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs font-bold transition"
            >
              ◀
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs font-bold transition border-l border-r border-slate-100 dark:border-slate-700"
            >
              {language === "en" ? "Today" : "วันนี้"}
            </button>
            <button
              onClick={handleNext}
              className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xs font-bold transition"
            >
              ▶
            </button>
          </div>

          {/* View Selector Month/Week/Day */}
          <div className="flex bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-lg border border-slate-200/40">
            {(["MONTH", "WEEK", "DAY"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setViewMode(view)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === view
                    ? "bg-[#D4AF37] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {view === "MONTH" ? (language === "en" ? "Month" : "รายเดือน") :
                 view === "WEEK" ? (language === "en" ? "Week" : "รายสัปดาห์") :
                 (language === "en" ? "Day" : "รายวัน")}
              </button>
            ))}
          </div>

          {/* Admin Team Filter */}
          {isAdmin && (
            <div className="flex bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-lg border border-slate-200/40">
              {(["ALL", "TECHNICIAN", "HOUSEKEEPING"] as const).map((team) => (
                <button
                  key={team}
                  onClick={() => setTeamFilter(team)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    teamFilter === team
                      ? "bg-slate-800 dark:bg-slate-700 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  {team === "ALL" ? (language === "en" ? "All Teams" : "ทั้งหมด") :
                   team === "TECHNICIAN" ? (language === "en" ? "Technician" : "งานช่าง") :
                   (language === "en" ? "Housekeeping" : "งานแม่บ้าน")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {getRangeTitleText()}
        </h2>
        <span className="text-xs text-[#D4AF37] font-mono tracking-wider font-bold bg-[#D4AF37]/5 px-2.5 py-1 rounded-full">
          Asia/Bangkok Timezone
        </span>
      </div>

      {/* Primary Layout Split: Calendar Grid + Unscheduled Side Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Calendar Grid Area (Span 3 on large screens) */}
        <div className="lg:col-span-3">
          {loading ? (
            <LoadingState />
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm p-4 overflow-hidden">
              
              {/* MONTH VIEW */}
              {viewMode === "MONTH" && (
                <div className="space-y-2">
                  {/* Grid Headers Sun-Sat */}
                  <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                      <div key={dayName} className={idx === 0 || idx === 6 ? "text-red-400" : ""}>
                        {dayName}
                      </div>
                    ))}
                  </div>

                  {/* Month Days Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const range = getCalendarRange(activeDate, "MONTH");
                      const days: Date[] = [];
                      const cursor = new Date(range.start);
                      const activeParts = getBangkokParts(activeDate);

                      while (cursor.toISOString() <= range.end) {
                        days.push(new Date(cursor));
                        cursor.setUTCDate(cursor.getUTCDate() + 1);
                      }

                      return days.map((day, idx) => {
                        const parts = getBangkokParts(day);
                        const isCurrentMonth = parts.month === activeParts.month;
                        
                        return (
                          <div
                            key={idx}
                            className={`min-h-[110px] p-2 border border-slate-100 dark:border-slate-700 rounded-lg flex flex-col justify-between transition ${
                              isCurrentMonth 
                                ? "bg-slate-50/30 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                                : "bg-slate-100/40 dark:bg-slate-900/20 text-slate-400 dark:text-slate-600"
                            }`}
                          >
                            <span className="text-[10px] font-bold font-mono">
                              {parts.day}
                            </span>
                            <div className="flex-1">
                              {renderDayEvents(day)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {/* WEEK VIEW (Vertical columns format) */}
              {viewMode === "WEEK" && (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                  {(() => {
                    const range = getCalendarRange(activeDate, "WEEK");
                    const days: Date[] = [];
                    const cursor = new Date(range.start);

                    while (cursor.toISOString() <= range.end) {
                      days.push(new Date(cursor));
                      cursor.setUTCDate(cursor.getUTCDate() + 1);
                    }

                    const daysOfWeekLabel = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const daysOfWeekLabelTh = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];

                    return days.map((day, idx) => {
                      const parts = getBangkokParts(day);
                      const isToday = new Date().toDateString() === day.toDateString();

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col p-3 border border-slate-100 dark:border-slate-700 rounded-xl min-h-[300px] transition ${
                            isToday
                              ? "bg-slate-50 dark:bg-slate-900/40 border-[#D4AF37]/50 shadow-sm"
                              : "bg-slate-50/30 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                          }`}
                        >
                          <div className="border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                              {language === "en" ? daysOfWeekLabel[idx] : daysOfWeekLabelTh[idx]}
                            </span>
                            <span className="text-sm font-extrabold font-mono mt-0.5 block">
                              {parts.day}/{parts.month + 1}
                            </span>
                          </div>
                          <div className="flex-1">
                            {renderDayEvents(day)}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* DAY VIEW (Detailed Chronological List) */}
              {viewMode === "DAY" && (
                <div className="space-y-4">
                  {(() => {
                    const targetParts = getBangkokParts(activeDate);
                    const dayJobs = scheduledOrders.filter((wo) => {
                      if (!wo.scheduled_at) return false;
                      const jobParts = getBangkokParts(new Date(wo.scheduled_at));
                      return jobParts.year === targetParts.year && jobParts.month === targetParts.month && jobParts.day === targetParts.day;
                    });

                    const sortedJobs = [...dayJobs].sort((a, b) => {
                      return new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime();
                    });

                    if (sortedJobs.length === 0) {
                      return (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-semibold text-xs">
                          {language === "en" ? "No service jobs scheduled for this day" : "ไม่มีใบสั่งงานที่กำหนดไว้สำหรับวันนี้"}
                        </div>
                      );
                    }

                    return (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {sortedJobs.map((wo) => {
                          const timeText = formatBangkokTime(wo.scheduled_at!);
                          const attStatus = deriveAttentionStatus(wo);

                          return (
                            <div
                              key={wo.id}
                              onClick={() => openOrderDetails(wo)}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition ${
                                attStatus === "PENDING_RESCHEDULE_APPROVAL" ? "border-l-4 border-yellow-400 bg-yellow-50/20" : ""
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                <span className="text-sm font-bold font-mono text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                  {timeText}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                                      {wo.title}
                                    </h4>
                                    <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded ${
                                      wo.service_team === "TECHNICIAN" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30" : "bg-purple-100 text-purple-800 dark:bg-purple-900/30"
                                    }`}>
                                      {wo.service_team === "TECHNICIAN" ? (language === "en" ? "Technician" : "งานช่าง") : (language === "en" ? "Housekeeping" : "งานแม่บ้าน")}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                    Code: {wo.work_order_code} | Unit {wo.unit?.unit_number} | {wo.property ? (language === "en" ? wo.property.name_en : wo.property.name_th) : "-"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                                {/* Attention badge */}
                                {attStatus !== "NORMAL" && (
                                  <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                                    attStatus === "PENDING_RESCHEDULE_APPROVAL"
                                      ? "bg-yellow-100 text-yellow-800 border border-yellow-300 animate-pulse"
                                      : attStatus === "RESCHEDULE_REJECTED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-green-100 text-green-800"
                                  }`}>
                                    {attStatus === "PENDING_RESCHEDULE_APPROVAL" ? (language === "en" ? "PENDING RESCHEDULE" : "รออนุมัติเลื่อนนัด") :
                                     attStatus === "RESCHEDULE_REJECTED" ? (language === "en" ? "REJECTED" : "คำขอเลื่อนถูกปฏิเสธ") :
                                     (language === "en" ? "APPROVED" : "อนุมัติเลื่อนนัดแล้ว")}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                  wo.status === "COMPLETED" || wo.status === "CLOSED" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"
                                }`}>
                                  {wo.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Right Side: Unscheduled Jobs Area (Counts and Lists) */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-3">
              ⚠️ {language === "en" ? "Unscheduled Jobs" : "งานยังไม่กำหนดเวลา"}
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-700 rounded-xl p-3 text-center">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Technician</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {unscheduledOrders.filter(o => o.service_team === "TECHNICIAN").length}
                </span>
              </div>
              <div className="bg-purple-50/40 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-700 rounded-xl p-3 text-center">
                <span className="text-[9px] font-bold text-slate-400 block uppercase">Housekeeping</span>
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {unscheduledOrders.filter(o => o.service_team === "HOUSEKEEPING").length}
                </span>
              </div>
            </div>

            {/* Unscheduled list */}
            {unscheduledOrders.length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 font-semibold text-xs border-t border-slate-50 dark:border-slate-700/50 pt-4">
                {language === "en" ? "All active jobs scheduled!" : "งานที่อยู่ทั้งหมดกำหนดเวลาแล้ว"}
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 border-t border-slate-50 dark:border-slate-700/50 pt-3">
                {unscheduledOrders.map((wo) => (
                  <div
                    key={wo.id}
                    onClick={() => openOrderDetails(wo)}
                    className="p-2 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition flex items-center justify-between text-xs"
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                        {wo.title}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">
                        Unit {wo.unit?.unit_number || "-"}
                      </span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      wo.service_team === "TECHNICIAN" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                    }`}>
                      {wo.service_team === "TECHNICIAN" ? "ช่าง" : "แม่บ้าน"}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* -------------------------------------------------------------------------
          Unified Details & Actions Modal (Synced to exact business rules)
          ------------------------------------------------------------------------- */}
      {selectedOrder && (
        <div 
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4"
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Work Order Sheet" : "ใบสั่งงานและข้อมูล"}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Code: {selectedOrder.work_order_code}
              </p>
            </div>

            {/* Description section */}
            <div className="border-t border-b border-slate-100 dark:border-slate-700 py-3 space-y-2.5 text-sm">
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Title" : "หัวข้อ"}:</span>
                <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{selectedOrder.title}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Category" : "หมวดหมู่"}:</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200 font-semibold">{selectedOrder.category}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Property" : "โครงการ"}:</span>
                <span className="col-span-2 text-slate-700 dark:text-slate-300">
                  {selectedOrder.property
                    ? language === "en" ? selectedOrder.property.name_en || selectedOrder.property.name_th : selectedOrder.property.name_th
                    : "-"}
                </span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Room" : "ห้องชุด"}:</span>
                <span className="col-span-2 font-mono text-slate-700 dark:text-slate-300">Unit {selectedOrder.unit?.unit_number}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Service Team" : "ทีมบริการ"}:</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200 font-semibold">{selectedOrder.service_team}</span>
              </div>
              {selectedOrder.scheduled_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Scheduled At" : "กำหนดเริ่มงาน"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">
                    {formatDate(selectedOrder.scheduled_at, language)} {formatBangkokTime(selectedOrder.scheduled_at)}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Status" : "สถานะ"}:</span>
                <span className="col-span-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{selectedOrder.status}</span>
              </div>
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Acknowledgement" : "การตอบรับงาน"}:</span>
                <span className="col-span-2 text-slate-700 dark:text-slate-300 font-semibold">
                  {selectedOrder.acknowledged_at
                    ? `${language === "en" ? "Accepted at" : "ตอบรับเมื่อ"} ${new Date(selectedOrder.acknowledged_at).toLocaleString()}`
                    : (language === "en" ? "Pending Acceptance" : "ยังไม่ได้ตอบรับงาน")}
                </span>
              </div>
            </div>

            {/* Admin-only edit controls */}
            {isAdmin && (
              <div className="space-y-3 pt-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  ⚙️ {language === "en" ? "Admin Controls" : "แผงควบคุมแอดมิน"}
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Assignee" : "มอบหมายให้"}</label>
                    <select
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                    >
                      <option value="">{language === "en" ? "Unassigned" : "ยังไม่ระบุช่าง"}</option>
                      {selectedOrder.service_team === "TECHNICIAN" ? (
                        technicians.map((t) => (
                          <option key={t.id} value={t.id}>{t.full_name || t.display_name}</option>
                        ))
                      ) : (
                        housekeepers.map((h) => (
                          <option key={h.id} value={h.id}>{h.full_name || h.display_name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Priority" : "ความสำคัญ"}</label>
                    <select
                      value={priorityVal}
                      onChange={(e) => setPriorityVal(e.target.value as WorkOrderPriority)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                    >
                      <option value="LOW">LOW</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <LocalizedDateTimePicker
                    value={scheduledAtVal}
                    onChange={setScheduledAtVal}
                    locale={language}
                    label={language === "en" ? "Scheduled At" : "กำหนดวันเวลา"}
                    className="col-span-1"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Service Team" : "ประเภทงาน"}</label>
                    <select
                      value={serviceTeamVal}
                      onChange={(e) => setServiceTeamVal(e.target.value as "TECHNICIAN" | "HOUSEKEEPING" | "INSPECTION_TEAM" | "SUPERVISOR")}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                    >
                      <option value="TECHNICIAN">TECHNICIAN</option>
                      <option value="HOUSEKEEPING">HOUSEKEEPING</option>
                      <option value="INSPECTION_TEAM">INSPECTION TEAM</option>
                      <option value="SUPERVISOR">SUPERVISOR</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Charge Amount (THB)" : "เงินเรียกเก็บ"}</label>
                    <input
                      type="number"
                      value={chargeAmountVal}
                      onChange={(e) => setChargeAmountVal(e.target.value)}
                      className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Actual Cost (THB)" : "ต้นทุนจริง"}</label>
                    <input
                      type="number"
                      value={actualCostVal}
                      onChange={(e) => setActualCostVal(e.target.value)}
                      className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                      placeholder="e.g. 200"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminAssign(selectedOrder.id)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded transition"
                  >
                    {language === "en" ? "Save Assignments" : "บันทึกการจัดสรรงาน"}
                  </button>
                  {selectedOrder.status === "COMPLETED" && (
                    <button
                      onClick={() => handleCloseTicket(selectedOrder.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded transition"
                    >
                      {language === "en" ? "Close Ticket" : "ปิดงานโดยสมบูรณ์"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Reschedule request form for workers */}
            {((isTechnician && selectedOrder.service_team === "TECHNICIAN") || (isHousekeeper && selectedOrder.service_team === "HOUSEKEEPING")) && (
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  ⏰ {language === "en" ? "Submit Reschedule Request" : "ขอยื่นเลื่อนเวลาปฏิบัติงาน"}
                </span>

                <form onSubmit={handleWorkerReschedule} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <LocalizedDatePicker
                      value={workerReschedDate}
                      onChange={setWorkerReschedDate}
                      required
                      locale={language}
                      label={language === "en" ? "New Date" : "วันที่ใหม่"}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "New Time" : "เวลาใหม่"}</label>
                      <input
                        type="time"
                        name="reschedTime"
                        required
                        className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Reason (Required)" : "เหตุผล (จำเป็น)"}</label>
                    <textarea
                      name="reschedReason"
                      required
                      rows={2}
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                      placeholder="Specify reasons..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold py-1.5 rounded transition"
                  >
                    {language === "en" ? "Send Reschedule Request" : "ส่งคำขอเลื่อนเวลา"}
                  </button>
                </form>
              </div>
            )}

            {/* Reschedule request reviews & History logs */}
            {selectedOrder.schedule_changes && selectedOrder.schedule_changes.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  📜 {language === "en" ? "Schedule History & Review" : "ประวัติการขอเลื่อนนัดและการอนุมัติ"}
                </span>

                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {selectedOrder.schedule_changes.map((change) => {
                    const isChangePending = change.status === "PENDING";
                    return (
                      <div
                        key={change.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          isChangePending
                            ? "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200"
                            : "bg-slate-50 dark:bg-slate-900/20 border-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDate(change.requested_scheduled_at, language)} {formatBangkokTime(change.requested_scheduled_at)}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-extrabold text-[8px] ${
                            change.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800 border border-yellow-300 animate-pulse"
                              : change.status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : change.status === "CANCELLED"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {change.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 italic">
                          Reason: {change.reason}
                        </p>
                        {change.review_remark && (
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-semibold">
                            Admin remark: {change.review_remark}
                          </p>
                        )}

                        {/* Admin approval buttons */}
                        {isAdmin && isChangePending && (
                          <div className="mt-2.5 space-y-2">
                            <input
                              type="text"
                              placeholder={language === "en" ? "Optional review remark..." : "บันทึกหมายเหตุความคิดเห็นแอดมิน..."}
                              value={adminReviewRemark}
                              onChange={(e) => setAdminReviewRemark(e.target.value)}
                              className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded text-[10px] outline-none dark:bg-slate-900"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReviewRequest(change.id, "APPROVED")}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1 rounded transition"
                              >
                                {language === "en" ? "Approve" : "อนุมัติ"}
                              </button>
                              <button
                                onClick={() => handleReviewRequest(change.id, "REJECTED")}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-1 rounded transition"
                              >
                                {language === "en" ? "Reject" : "ปฏิเสธ"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Worker cancellation button */}
                        {!isAdmin && isChangePending && change.requested_by === currentUser?.id && (
                          <button
                            onClick={() => handleCancelRequest(change.id)}
                            className="mt-2 w-full bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold py-1 rounded transition"
                          >
                            {language === "en" ? "Cancel Request" : "ยกเลิกคำขอเลื่อน"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
