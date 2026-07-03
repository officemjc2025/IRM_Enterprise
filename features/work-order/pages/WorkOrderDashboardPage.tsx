"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { WorkOrder, WorkOrderStatus, WorkOrderPriority } from "@/features/work-order/types/work-order.types";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

interface TechnicianProfile {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string;
  phone: string | null;
}

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

interface UnitOption {
  id: string;
  unit_number: string;
  property_id: string;
}

function WorkOrderDashboardInner() {
  const { language } = useLanguage();
  const supabase = createClient();

  const [role, setRole] = useState<string>("resident");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [summary, setSummary] = useState({ open: 0, inProgress: 0, completedToday: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [techFilter, setTechFilter] = useState<string>("ALL");

  // Tab View
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");

  // Details Modal & Assignment State
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [priorityVal, setPriorityVal] = useState<WorkOrderPriority>("NORMAL");

  // Create Ticket Modal State (Admin)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Plumbing");
  const [newPriority, setNewPriority] = useState<WorkOrderPriority>("NORMAL");
  const [newDescription, setNewDescription] = useState("");
  const [newPropertyId, setNewPropertyId] = useState("");
  const [newUnitId, setNewUnitId] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      // Get profile role
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (p) setRole(p.role);

        // Load technicians
        const { data: techs } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, email, phone")
          .eq("role", "technician");
        setTechnicians((techs as TechnicianProfile[]) || []);
      }

      // Load properties & units for Admin form
      const { data: props } = await supabase.from("properties").select("id, property_name_th, property_name_en");
      setProperties((props as PropertyOption[]) || []);

      const { data: uns } = await supabase.from("units").select("id, unit_number, property_id");
      setUnits((uns as UnitOption[]) || []);

      await refreshData();
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      // Fetch Orders
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSaving(true);

    if (!newPropertyId || !newUnitId || !newTitle.trim() || !newCategory) {
      setCreateError("All required fields must be filled.");
      setCreateSaving(false);
      return;
    }

    try {
      const payload = {
        property_id: newPropertyId,
        unit_id: newUnitId,
        title: newTitle.trim(),
        category: newCategory,
        priority: newPriority,
        description: newDescription.trim() || null,
      };

      const res = await fetch("/api/v1/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewPropertyId("");
        setNewUnitId("");
        refreshData();
      } else {
        setCreateError(json.message || "Failed to create work order");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setCreateError(msg);
    } finally {
      setCreateSaving(false);
    }
  };

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
        alert(json.message || "Failed to update state");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminAssign = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: assigneeId || null,
          priority: priorityVal,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSelectedOrder(json.data);
        refreshData();
        alert(language === "en" ? "Work order updated successfully" : "อัปเดตใบสั่งงานเสร็จสิ้น");
      } else {
        alert(json.message || "Failed to update assignments");
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
        setSelectedOrder(json.data);
        refreshData();
      } else {
        alert(json.message || "Failed to close ticket");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openAssignModal = (order: WorkOrder) => {
    setSelectedOrder(order);
    setAssigneeId(order.assigned_to || "");
    setPriorityVal(order.priority);
  };

  const filteredUnits = units.filter((u) => u.property_id === newPropertyId);

  // Search filter
  const searchedOrders = workOrders.filter((o) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const code = o.work_order_code.toLowerCase();
    const title = o.title.toLowerCase();
    const desc = (o.description || "").toLowerCase();
    const unit = (o.unit?.unit_number || "").toLowerCase();
    const resident = o.resident_assignment?.person
      ? (o.resident_assignment.person.display_name || `${o.resident_assignment.person.first_name} ${o.resident_assignment.person.last_name || ""}`).toLowerCase()
      : "";
    const techName = o.assignee ? (o.assignee.first_name || "").toLowerCase() : "";

    return (
      code.includes(term) ||
      title.includes(term) ||
      desc.includes(term) ||
      unit.includes(term) ||
      resident.includes(term) ||
      techName.includes(term)
    );
  });

  // Filters Panel matching
  const matchFiltered = searchedOrders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && o.priority !== priorityFilter) return false;
    if (categoryFilter !== "ALL" && o.category !== categoryFilter) return false;
    if (propertyFilter !== "ALL" && o.property_id !== propertyFilter) return false;
    if (techFilter !== "ALL" && o.assigned_to !== techFilter) return false;
    return true;
  });

  // Tab splits
  const activeOrders = matchFiltered.filter((o) =>
    activeTab === "ACTIVE"
      ? ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(o.status)
      : ["CLOSED", "CANCELLED"].includes(o.status)
  );

  const isAdmin = ["admin", "super_admin", "property_admin"].includes(role);
  const isTechnician = role === "technician";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={language === "en" ? "Work Order Dashboard" : "ระบบจัดการใบสั่งซ่อมบำรุง"}
        />
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 transition"
          >
            {language === "en" ? "+ Create Ticket" : "+ เปิดใบสั่งงาน"}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "Open Requests" : "รายการแจ้งเข้ามา"}
          </span>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1 block">
            {summary.open}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "In Progress" : "กำลังซ่อมแซม"}
          </span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 block">
            {summary.inProgress}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "Completed Today" : "เสร็จสิ้นในวันนี้"}
          </span>
          <span className="text-xl font-bold text-green-600 dark:text-green-400 mt-1 block">
            {summary.completedToday}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {language === "en" ? "Overdue Tickets" : "เลยกำหนดการดำเนินการ"}
          </span>
          <span className="text-xl font-bold text-red-600 dark:text-red-400 mt-1 block">
            {summary.overdue}
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
                  ? language === "en" ? "Active Tickets" : "ใบสั่งงานที่กำลังดำเนินการ"
                  : language === "en" ? "Archived Logs" : "ประวัติที่ปิดไปแล้ว"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="w-full md:w-72">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={language === "en" ? "Search tickets..." : "ค้นหาใบสั่งซ่อม..."}
            />
          </div>
        </div>

        {/* Advanced Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-50 dark:border-slate-700/50">
          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Status" : "สถานะ"}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              <option value="ALL">ALL STATUS</option>
              <option value="NEW">NEW</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="ON_HOLD">ON HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Priority" : "ความสำคัญ"}</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              <option value="ALL">ALL PRIORITY</option>
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          {/* Category filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Category" : "หมวดหมู่"}</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              <option value="ALL">ALL CATEGORIES</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Security">Security</option>
              <option value="Carpentry">Carpentry</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Property filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Property" : "โครงการ"}</span>
            <select
              value={propertyFilter}
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

          {/* Technician filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Technician" : "ช่างเทคนิค"}</span>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              <option value="ALL">ALL TECHNICIANS</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || t.display_name}
                </option>
              ))}
            </select>
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
        <EmptyState message={language === "en" ? "No work orders matched filters" : "ไม่พบประวัติใบสั่งซ่อมบำรุง"} />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === "en" ? "Code" : "รหัสงาน"}</th>
                  <th className="p-4">{language === "en" ? "Issue / Category" : "รายละเอียดปัญหา"}</th>
                  <th className="p-4">{language === "en" ? "Property & Room" : "ห้องชุด / โครงการ"}</th>
                  <th className="p-4">{language === "en" ? "Priority" : "ความสำคัญ"}</th>
                  <th className="p-4">{language === "en" ? "Status" : "สถานะ"}</th>
                  <th className="p-4">{language === "en" ? "Technician" : "ผู้ดำเนินงาน"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "การควบคุม"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {activeOrders.map((wo) => {
                  const propName = wo.property
                    ? language === "en" ? wo.property.name_en || wo.property.name_th : wo.property.name_th
                    : "-";
                  const techName = wo.assignee
                    ? wo.assignee.first_name
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
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                        {techName}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openAssignModal(wo)}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-300 transition"
                        >
                          {language === "en" ? "Manage" : "จัดการและข้อมูล"}
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

      {/* Details & Assignment Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Work Order Sheet" : "ใบสั่งซ่อมบำรุงอย่างเป็นทางการ"}
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
                  <span className="text-slate-400">{language === "en" ? "Completed At" : "ซ่อมเสร็จเมื่อ"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{new Date(selectedOrder.completed_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Admin Controls Panel */}
            {isAdmin && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  🛠️ Admin Assignment Panel
                </span>
                
                {/* Assign Technician select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Technician</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 outline-none"
                  >
                    <option value="">-- UNASSIGNED --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Selection */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Priority</label>
                  <select
                    value={priorityVal}
                    onChange={(e) => setPriorityVal(e.target.value as WorkOrderPriority)}
                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {selectedOrder.status === "COMPLETED" && (
                    <button
                      type="button"
                      onClick={() => handleCloseTicket(selectedOrder.id)}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold transition"
                    >
                      {language === "en" ? "Close & Seal Job" : "ปิดงานซ่อมแซม"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAdminAssign(selectedOrder.id)}
                    className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded text-xs font-semibold hover:bg-slate-700 transition"
                  >
                    {language === "en" ? "Apply Changes" : "บันทึกการมอบหมาย"}
                  </button>
                </div>
              </div>
            )}

            {/* Technician Actions Panel */}
            {isTechnician && selectedOrder.assigned_to === currentUser?.id && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  🔧 Technician Job Controls
                </span>

                <div className="flex gap-2">
                  {selectedOrder.status === "ASSIGNED" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, "IN_PROGRESS")}
                      className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition"
                    >
                      {language === "en" ? "▶ Start Job" : "เริ่มงาน"}
                    </button>
                  )}

                  {selectedOrder.status === "IN_PROGRESS" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, "ON_HOLD")}
                        className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        {language === "en" ? "⏸ Pause Job" : "พักการทำงาน (Hold)"}
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
                      {language === "en" ? "▶ Resume Job" : "ทำงานต่อ"}
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

      {/* Admin Ticket Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>
            
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Open New Work Order Ticket" : "เปิดใบสั่งซ่อมบำรุงใบใหม่"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "en" ? "Report a maintenance request on behalf of a resident." : "เปิดคำแจ้งงานบำรุงรักษาโดยนิติบุคคลโครงการ"}
              </p>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {createError && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {createError}
                </div>
              )}

              {/* Property Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === "en" ? "Property" : "โครงการ"}</label>
                <select
                  required
                  value={newPropertyId}
                  onChange={(e) => {
                    setNewPropertyId(e.target.value);
                    setNewUnitId("");
                  }}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                >
                  <option value="">-- SELECT PROPERTY --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === "en" ? "Room Unit" : "ห้องชุด"}</label>
                <select
                  required
                  disabled={!newPropertyId}
                  value={newUnitId}
                  onChange={(e) => setNewUnitId(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none disabled:opacity-50"
                >
                  <option value="">-- SELECT UNIT --</option>
                  {filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === "en" ? "Issue Title" : "หัวข้อใบงาน"}</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Broken Pipe"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  >
                    <option value="Plumbing">Plumbing</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Security">Security</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as WorkOrderPriority)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none resize-none"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 disabled:opacity-50 transition"
                >
                  {createSaving ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkOrderDashboardPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <WorkOrderDashboardInner />
      </Suspense>
    </MainLayout>
  );
}
