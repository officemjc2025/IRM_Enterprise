"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { WorkOrder, WorkOrderStatus, WorkOrderPhoto, AttentionStatus, deriveAttentionStatus } from "@/features/work-order/types/work-order.types";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

function HousekeepingDashboardInner() {
  const { language } = useLanguage();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState({ open: 0, inProgress: 0, completedToday: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);

  const [workPerformed, setWorkPerformed] = useState("");
  const [additionalWork, setAdditionalWork] = useState("");
  const [workerRemark, setWorkerRemark] = useState("");

  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newRescheduleDate, setNewRescheduleDate] = useState("");
  const [newRescheduleTime, setNewRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setWorkPerformed(selectedOrder.work_performed || "");
      setAdditionalWork(selectedOrder.additional_work || "");
      setWorkerRemark(selectedOrder.worker_remark || "");
    } else {
      setWorkPerformed("");
      setAdditionalWork("");
      setWorkerRemark("");
    }
    setShowRescheduleForm(false);
    setNewRescheduleDate("");
    setNewRescheduleTime("");
    setRescheduleReason("");
  }, [selectedOrder]);

  const formatBangkokTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return new Intl.DateTimeFormat(language === "en" ? "en-US" : "th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(dateStr));
    } catch (e) {
      return new Date(dateStr).toLocaleString();
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      await refreshData();
    } catch (err) {
      console.error(err);
      setError("Failed to load housekeeping dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      // Fetch Housekeeping Orders (the API automatically scopes to assigned housekeeping jobs)
      const res = await fetch("/api/v1/work-orders");
      const json = await res.json();
      if (json.success) {
        setWorkOrders(json.data);
      }

      // Fetch Summary
      const sumRes = await fetch("/api/v1/work-orders/summary");
      const sumJson = await sumRes.json();
      if (sumJson.success) {
        setSummary(sumJson.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadInitialData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshOrderDetails = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedOrder(json.data);
      }
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: WorkOrderStatus) => {
    if (nextStatus === "COMPLETED" && !workPerformed.trim()) {
      alert(language === "en" ? "Please fill in the Work Performed details before completing." : "กรุณาระบุรายละเอียดงานที่ปฏิบัติก่อนเสร็จสิ้นงาน");
      return;
    }

    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: nextStatus,
          work_performed: workPerformed.trim() || null,
          additional_work: additionalWork.trim() || null,
          worker_remark: workerRemark.trim() || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(json.data);
        }
        refreshData();
      } else {
        alert(json.message || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcknowledge = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: currentUser?.id,
        }),
      });

      const json = await res.json();
      if (json.success) {
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(json.data);
        }
        refreshData();
      } else {
        alert(json.message || "Failed to acknowledge job");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDraft = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          work_performed: workPerformed.trim() || null,
          additional_work: additionalWork.trim() || null,
          worker_remark: workerRemark.trim() || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(json.data);
        }
        alert(language === "en" ? "Draft saved successfully" : "บันทึกร่างสำเร็จ");
        refreshData();
      } else {
        alert(json.message || "Failed to save draft");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Search filter
  const searchedOrders = workOrders.filter((o) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const code = o.work_order_code.toLowerCase();
    const title = o.title.toLowerCase();
    const desc = (o.description || "").toLowerCase();
    const unit = (o.unit?.unit_number || "").toLowerCase();

    return (
      code.includes(term) ||
      title.includes(term) ||
      desc.includes(term) ||
      unit.includes(term)
    );
  });

  // Tab splits (Housekeeping view has ASSIGNED, IN_PROGRESS, ON_HOLD, COMPLETED in ACTIVE tab)
  const activeOrders = searchedOrders.filter((o) =>
    activeTab === "ACTIVE"
      ? ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(o.status)
      : ["CLOSED", "CANCELLED"].includes(o.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={language === "en" ? "Housekeeping Workspace" : "พื้นที่ทำงานแม่บ้าน"}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "Jobs Assigned" : "งานที่ได้รับมอบหมาย"}
          </span>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 block">
            {summary.open}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "In Progress" : "กำลังดำเนินการ"}
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 block">
            {summary.inProgress}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "Completed Today" : "เสร็จสิ้นวันนี้"}
          </span>
          <span className="text-xl font-bold text-green-600 dark:text-green-400 mt-1 block">
            {summary.completedToday}
          </span>
        </div>
      </div>

      {/* Filters and Search Panel */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Tabs */}
          <div className="flex gap-2 w-full md:w-auto">
            {(["ACTIVE", "HISTORY"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition ${
                  activeTab === tab
                    ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {tab === "ACTIVE"
                  ? language === "en" ? "Active Jobs" : "งานที่กำลังดำเนินการ"
                  : language === "en" ? "Archived Logs" : "ประวัติงานที่เสร็จสิ้น"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="w-full md:w-72">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={language === "en" ? "Search jobs..." : "ค้นหางาน..."}
            />
          </div>
        </div>
      </div>

      {/* Main List Table */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm w-full text-center">
          {error}
        </div>
      ) : activeOrders.length === 0 ? (
        <EmptyState message={language === "en" ? "No housekeeping jobs assigned" : "ไม่พบประวัติงานแม่บ้าน"} />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === "en" ? "Code" : "รหัสงาน"}</th>
                  <th className="p-4">{language === "en" ? "Task / Category" : "รายละเอียดปัญหา"}</th>
                  <th className="p-4">{language === "en" ? "Property & Room" : "ห้องชุด / โครงการ"}</th>
                  <th className="p-4">{language === "en" ? "Priority" : "ความสำคัญ"}</th>
                  <th className="p-4">{language === "en" ? "Status" : "สถานะ"}</th>
                  <th className="p-4">{language === "en" ? "Attention" : "สถานะดำเนินการ"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "การควบคุม"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {activeOrders.map((wo) => {
                  const propName = wo.property
                    ? language === "en" ? wo.property.name_en || wo.property.name_th : wo.property.name_th
                    : "-";

                  return (
                    <tr key={wo.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {wo.work_order_code}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {wo.title}
                        </div>
                        <span className="text-xs text-slate-400">
                          {wo.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          Unit {wo.unit?.unit_number || "-"}
                        </div>
                        <span className="text-xs text-slate-400">{propName}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                          wo.priority === "URGENT"
                            ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                            : wo.priority === "HIGH"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
                            : wo.priority === "NORMAL"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                            : "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400"
                        }`}>
                          {wo.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                          wo.status === "NEW"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400"
                            : wo.status === "ASSIGNED"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400"
                            : wo.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                            : wo.status === "COMPLETED" || wo.status === "CLOSED"
                            ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-500"
                        }`}>
                          {wo.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                          (() => {
                            const attStatus = deriveAttentionStatus(wo);
                            return attStatus === "PENDING_RESCHEDULE_APPROVAL"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400 border border-yellow-300 animate-pulse font-bold"
                              : attStatus === "RESCHEDULE_REJECTED"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                              : attStatus === "RESCHEDULE_APPROVED"
                              ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                              : attStatus === "CANCELLED"
                              ? "bg-slate-100 text-slate-500 dark:bg-slate-900"
                              : "bg-slate-50 text-slate-400 dark:bg-slate-900";
                          })()
                        }`}>
                          {(() => {
                            const attStatus = deriveAttentionStatus(wo);
                            return attStatus === "PENDING_RESCHEDULE_APPROVAL" ? (language === "en" ? "PENDING RESCHEDULE" : "รออนุมัติเลื่อนนัด") :
                              attStatus === "RESCHEDULE_REJECTED" ? (language === "en" ? "REJECTED" : "คำขอเลื่อนถูกปฏิเสธ") :
                              attStatus === "RESCHEDULE_APPROVED" ? (language === "en" ? "APPROVED" : "อนุมัติเลื่อนนัดแล้ว") :
                              attStatus === "CANCELLED" ? (language === "en" ? "CANCELLED" : "ยกเลิกคำขอ") :
                              (language === "en" ? "NORMAL" : "ปกติ");
                          })()}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedOrder(wo)}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-300 transition"
                        >
                          {language === "en" ? "Open Sheet" : "เปิดใบสั่งงาน"}
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

      {/* Details & Job Control Modal */}
      {selectedOrder && (
        <div 
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
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
                {language === "en" ? "Housekeeping Job Sheet" : "ใบงานทำความสะอาดและดูแลห้องชุด"}
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
                <span className="text-slate-400">{language === "en" ? "Original Scope" : "ขอบเขตดั้งเดิม"}:</span>
                <span className="col-span-2 text-slate-700 dark:text-slate-300 italic">{selectedOrder.description || "-"}</span>
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
              {selectedOrder.scheduled_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Scheduled At" : "กำหนดเริ่มงาน"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{formatBangkokTime(selectedOrder.scheduled_at)}</span>
                </div>
              )}
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Acknowledgement" : "การตอบรับงาน"}:</span>
                <span className="col-span-2 text-slate-700 dark:text-slate-300 font-semibold">
                  {selectedOrder.acknowledged_at
                    ? `${language === "en" ? "Accepted at" : "ตอบรับเมื่อ"} ${formatBangkokTime(selectedOrder.acknowledged_at)}`
                    : (language === "en" ? "Pending Acceptance" : "ยังไม่ได้ตอบรับงาน")}
                </span>
              </div>
              {selectedOrder.started_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Started At" : "เริ่มงานเมื่อ"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{formatBangkokTime(selectedOrder.started_at)}</span>
                </div>
              )}
              {selectedOrder.completed_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Completed At" : "เสร็จสิ้นเมื่อ"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{formatBangkokTime(selectedOrder.completed_at)}</span>
                </div>
              )}
            </div>

            {/* Execution details inputs */}
            {(selectedOrder.status === "IN_PROGRESS" && selectedOrder.assigned_to === currentUser?.id) ? (
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  📝 {language === "en" ? "Execution details" : "รายละเอียดการปฏิบัติงาน"}
                </span>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Work Performed (Required)" : "งานที่ทำ (จำเป็น)"}</label>
                  <textarea
                    required
                    value={workPerformed}
                    onChange={(e) => setWorkPerformed(e.target.value)}
                    rows={2}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="Describe cleaning/work done..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Additional Work" : "งานเพิ่มเติม"}</label>
                  <textarea
                    value={additionalWork}
                    onChange={(e) => setAdditionalWork(e.target.value)}
                    rows={2}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="Describe extra work done..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Worker Remark" : "หมายเหตุผู้ทำ"}</label>
                  <textarea
                    value={workerRemark}
                    onChange={(e) => setWorkerRemark(e.target.value)}
                    rows={2}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="Internal worker comments..."
                  />
                </div>
              </div>
            ) : (
              (selectedOrder.work_performed || selectedOrder.additional_work || selectedOrder.worker_remark) && (
                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    📝 {language === "en" ? "Execution details" : "รายละเอียดการปฏิบัติงาน"}
                  </span>
                  {selectedOrder.work_performed && (
                    <div>
                      <span className="text-slate-400 font-bold">{language === "en" ? "Work Performed" : "งานที่ทำ"}: </span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{selectedOrder.work_performed}</span>
                    </div>
                  )}
                  {selectedOrder.additional_work && (
                    <div>
                      <span className="text-slate-400 font-bold">{language === "en" ? "Additional Work" : "งานเพิ่มเติม"}: </span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedOrder.additional_work}</span>
                    </div>
                  )}
                  {selectedOrder.worker_remark && (
                    <div>
                      <span className="text-slate-400 font-bold">{language === "en" ? "Worker Remark" : "หมายเหตุ"}: </span>
                      <span className="text-slate-700 dark:text-slate-300">{selectedOrder.worker_remark}</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Rescheduling Section */}
            {selectedOrder.assigned_to === currentUser?.id && (
              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  ⏰ {language === "en" ? "Schedule Management" : "การจัดการเวลานัดหมาย"}
                </span>

                {/* Pending Request Indicator */}
                {selectedOrder.schedule_changes?.find((sc) => sc.status === "PENDING") ? (
                  (() => {
                    const pendingReq = selectedOrder.schedule_changes.find((sc) => sc.status === "PENDING")!;
                    return (
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-2.5 rounded-lg text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-yellow-800 dark:text-yellow-400">
                          ⚠️ {language === "en" ? "Pending Reschedule Request" : "มีคำขอเลื่อนเวลาที่รอการอนุมัติ"}
                        </div>
                        <div>
                          <strong>{language === "en" ? "Requested Time" : "เวลาที่ขอเลื่อน"}:</strong>{" "}
                          <span className="font-mono">{formatBangkokTime(pendingReq.requested_scheduled_at)}</span>
                        </div>
                        <div>
                          <strong>{language === "en" ? "Reason" : "เหตุผล"}:</strong> {pendingReq.reason}
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(language === "en" ? "Are you sure you want to cancel this request?" : "ยืนยันยกเลิกคำขอเลื่อนงาน?")) return;
                            try {
                              const res = await fetch(`/api/v1/work-orders/${selectedOrder.id}/schedule-changes`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  change_id: pendingReq.id,
                                  status: "CANCELLED"
                                }),
                              });
                              const json = await res.json();
                              if (json.success) {
                                refreshOrderDetails(selectedOrder.id);
                              } else {
                                alert(json.message || "Failed to cancel request");
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="w-full mt-1.5 py-1 text-center bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded text-[10px] transition"
                        >
                          ✕ {language === "en" ? "Cancel Request" : "ยกเลิกคำขอ"}
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  !showRescheduleForm ? (
                    <button
                      onClick={() => setShowRescheduleForm(true)}
                      className="w-full py-1.5 text-center border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded font-semibold text-xs transition text-slate-700 dark:text-slate-300"
                    >
                      {language === "en" ? "Request Reschedule" : "ขอเลื่อนวัน/เวลาปฏิบัติงาน"}
                    </button>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{language === "en" ? "New Schedule Request" : "สร้างคำขอเลื่อนงาน"}</span>
                        <button onClick={() => setShowRescheduleForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold">✕</button>
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase">{language === "en" ? "Date" : "วันที่"}</label>
                          <input
                            type="date"
                            value={newRescheduleDate}
                            onChange={(e) => setNewRescheduleDate(e.target.value)}
                            className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase">{language === "en" ? "Time" : "เวลา"}</label>
                          <input
                            type="time"
                            value={newRescheduleTime}
                            onChange={(e) => setNewRescheduleTime(e.target.value)}
                            className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">{language === "en" ? "Reason (Required)" : "เหตุผลการเลื่อนงาน (จำเป็น)"}</label>
                        <textarea
                          required
                          value={rescheduleReason}
                          onChange={(e) => setRescheduleReason(e.target.value)}
                          rows={2}
                          className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                          placeholder="Why is reschedule needed?"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!newRescheduleDate || !newRescheduleTime) {
                            alert(language === "en" ? "Date and Time are required" : "กรุณาระบุวันที่และเวลา");
                            return;
                          }
                          if (!rescheduleReason.trim()) {
                            alert(language === "en" ? "Reason is required" : "กรุณาระบุเหตุผล");
                            return;
                          }
                          setRescheduleSaving(true);
                          try {
                            const newDateTime = new Date(`${newRescheduleDate}T${newRescheduleTime}`).toISOString();
                            const res = await fetch(`/api/v1/work-orders/${selectedOrder.id}/schedule-changes`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                requested_scheduled_at: newDateTime,
                                reason: rescheduleReason
                              }),
                            });
                            const json = await res.json();
                            if (json.success) {
                              setShowRescheduleForm(false);
                              refreshOrderDetails(selectedOrder.id);
                            } else {
                              alert(json.message || "Failed to request reschedule");
                            }
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setRescheduleSaving(false);
                          }
                        }}
                        disabled={rescheduleSaving}
                        className="w-full py-1.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold rounded-lg transition"
                      >
                        {rescheduleSaving ? "Submitting..." : (language === "en" ? "Submit Request" : "ส่งคำขอเลื่อนงาน")}
                      </button>
                    </div>
                  )
                )}

                {/* Historical Changes List */}
                {selectedOrder.schedule_changes && selectedOrder.schedule_changes.filter(c => c.status !== "PENDING").length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{language === "en" ? "Schedule History" : "ประวัติการเลื่อนงาน"}</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {selectedOrder.schedule_changes.filter(c => c.status !== "PENDING").map((c) => (
                        <div key={c.id} className="p-1.5 bg-slate-50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800 rounded text-[10px] space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{formatBangkokTime(c.requested_scheduled_at)}</span>
                            <span className={`font-bold px-1 rounded-[3px] text-[8px] ${
                              c.status === "APPROVED" ? "bg-green-100 text-green-800" :
                              c.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"
                            }`}>{c.status}</span>
                          </div>
                          <div className="text-slate-500">{language === "en" ? "Reason" : "เหตุผล"}: {c.reason}</div>
                          {c.review_remark && <div className="text-[#D4AF37] italic">{language === "en" ? "Remark" : "หมายเหตุ"}: {c.review_remark}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Photos Section */}
            <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-4">
              <WorkOrderPhotoSection
                orderId={selectedOrder.id}
                stage="BEFORE"
                photos={selectedOrder.photos?.filter((p) => p.photo_stage === "BEFORE") || []}
                canUpload={selectedOrder.status === "IN_PROGRESS" || (selectedOrder.status === "ASSIGNED" && !!selectedOrder.acknowledged_at)}
                canDelete={selectedOrder.status === "IN_PROGRESS"}
                onRefresh={() => refreshOrderDetails(selectedOrder.id)}
              />
              <WorkOrderPhotoSection
                orderId={selectedOrder.id}
                stage="AFTER"
                photos={selectedOrder.photos?.filter((p) => p.photo_stage === "AFTER") || []}
                canUpload={selectedOrder.status === "IN_PROGRESS"}
                canDelete={selectedOrder.status === "IN_PROGRESS"}
                onRefresh={() => refreshOrderDetails(selectedOrder.id)}
              />
            </div>

            {/* Housekeeper Actions Panel */}
            {selectedOrder.assigned_to === currentUser?.id && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  🧹 Housekeeper Controls
                </span>

                <div className="flex flex-col gap-2">
                  {selectedOrder.status === "ASSIGNED" && !selectedOrder.acknowledged_at && (
                    <button
                      onClick={() => handleAcknowledge(selectedOrder.id)}
                      className="w-full px-3 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold rounded-lg transition"
                    >
                      {language === "en" ? "Acknowledge & Accept Job" : "ตอบรับและยอมรับงาน"}
                    </button>
                  )}

                  {selectedOrder.status === "ASSIGNED" && selectedOrder.acknowledged_at && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "IN_PROGRESS")}
                      className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition"
                    >
                      {language === "en" ? "▶ Start Job" : "เริ่มงานทำความสะอาด"}
                    </button>
                  )}

                  {selectedOrder.status === "IN_PROGRESS" && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, "ON_HOLD")}
                          className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg transition"
                        >
                          {language === "en" ? "⏸ Pause Job" : "พักงาน (Hold)"}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, "COMPLETED")}
                          className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition"
                        >
                          {language === "en" ? "✅ Complete Job" : "งานเสร็จสิ้น"}
                        </button>
                      </div>
                      <button
                        onClick={() => handleSaveDraft(selectedOrder.id)}
                        className="w-full px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition"
                      >
                        {language === "en" ? "💾 Save Draft" : "บันทึกร่าง"}
                      </button>
                    </div>
                  )}

                  {selectedOrder.status === "ON_HOLD" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "IN_PROGRESS")}
                      className="w-full px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition"
                    >
                      {language === "en" ? "▶ Resume Job" : "ทำความสะอาดต่อ"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Modal close buttons */}
            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {language === "en" ? "Dismiss" : "ปิด"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HousekeepingDashboardPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <HousekeepingDashboardInner />
      </Suspense>
    </MainLayout>
  );
}

function WorkOrderPhotoSection({ 
  orderId, 
  stage, 
  photos, 
  canUpload, 
  canDelete, 
  onRefresh 
}: { 
  orderId: string; 
  stage: "BEFORE" | "AFTER"; 
  photos: WorkOrderPhoto[]; 
  canUpload: boolean; 
  canDelete: boolean; 
  onRefresh: () => void; 
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photo_stage", stage);

      const res = await fetch(`/api/v1/work-orders/${orderId}/photos`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        onRefresh();
      } else {
        alert(json.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}/photos?photo_id=${photoId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        onRefresh();
      } else {
        alert(json.message || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
        {stage === "BEFORE" ? "Before Work Photos" : "After Work Photos"}
      </span>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <PhotoThumbnail key={p.id} path={p.storage_path} onDelete={canDelete ? () => handleDelete(p.id) : undefined} />
        ))}
        {canUpload && (
          <label className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#D4AF37] rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer transition text-slate-400 hover:text-slate-600 h-20 bg-slate-50 dark:bg-slate-900/30">
            <input type="file" accept="image/*" capture="environment" onChange={handleUpload} className="hidden" disabled={uploading} />
            {uploading ? (
              <span className="text-[10px] font-semibold animate-pulse">Uploading...</span>
            ) : (
              <>
                <span className="text-lg">📷</span>
                <span className="text-[9px] font-semibold mt-1">Add Photo</span>
              </>
            )}
          </label>
        )}
      </div>
    </div>
  );
}

function PhotoThumbnail({ path, onDelete }: { path: string; onDelete?: () => void }) {
  const supabase = createClient();
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    supabase.storage.from("work-orders").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  }, [path, supabase]);

  if (!url) {
    return <div className="bg-slate-100 dark:bg-slate-900 animate-pulse rounded-lg h-20" />;
  }

  return (
    <div className="relative group rounded-lg overflow-hidden h-20 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
      <img src={url} alt="Job thumbnail" className="w-full h-full object-cover" />
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-[8px] font-bold shadow opacity-0 group-hover:opacity-100 transition duration-150"
        >
          ✕
        </button>
      )}
    </div>
  );
}
