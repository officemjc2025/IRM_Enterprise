"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { WorkOrder, WorkOrderStatus } from "@/features/work-order/types/work-order.types";
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

  const handleUpdateStatus = async (orderId: string, nextStatus: WorkOrderStatus) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
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
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
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
              {selectedOrder.description && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Description" : "รายละเอียด"}:</span>
                  <span className="col-span-2 text-slate-700 dark:text-slate-300 italic">{selectedOrder.description}</span>
                </div>
              )}
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
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{new Date(selectedOrder.scheduled_at).toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Requested At" : "แจ้งเรื่องเมื่อ"}:</span>
                <span className="col-span-2 text-slate-500 font-mono text-xs">{new Date(selectedOrder.requested_at).toLocaleString()}</span>
              </div>
              {selectedOrder.started_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Started At" : "เริ่มงานเมื่อ"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{new Date(selectedOrder.started_at).toLocaleString()}</span>
                </div>
              )}
              {selectedOrder.completed_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Completed At" : "เสร็จสิ้นเมื่อ"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{new Date(selectedOrder.completed_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Housekeeper Actions Panel */}
            {selectedOrder.assigned_to === currentUser?.id && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  🧹 Housekeeper Controls
                </span>

                <div className="flex gap-2">
                  {(selectedOrder.status === "ASSIGNED" || selectedOrder.status === "NEW") && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "IN_PROGRESS")}
                      className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition"
                    >
                      {language === "en" ? "▶ Start Job" : "เริ่มงานทำความสะอาด"}
                    </button>
                  )}

                  {selectedOrder.status === "IN_PROGRESS" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, "ON_HOLD")}
                        className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        {language === "en" ? "⏸ Pause Job" : "พักชั่วคราว (Hold)"}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, "COMPLETED")}
                        className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        {language === "en" ? "✅ Complete Job" : "งานเสร็จสิ้น"}
                      </button>
                    </>
                  )}

                  {selectedOrder.status === "ON_HOLD" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "IN_PROGRESS")}
                      className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition"
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
