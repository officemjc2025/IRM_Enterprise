"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderPhoto, deriveAttentionStatus } from "@/features/work-order/types/work-order.types";
import { PageHeader, SearchInput, EmptyState, LoadingState, LocalizedDateTimePicker, SearchableSelect } from "@/shared/ui";
import { compareUnitNumbers } from "@/shared/utils";
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
  const [housekeepers, setHousekeepers] = useState<TechnicianProfile[]>([]);
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
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [attentionFilter, setAttentionFilter] = useState<string>("ALL");

  // Tab View
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");

  // Details Modal & Assignment State
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [priorityVal, setPriorityVal] = useState<WorkOrderPriority>("NORMAL");
  const [scheduledAtVal, setScheduledAtVal] = useState("");
  const [serviceTeamVal, setServiceTeamVal] = useState<"TECHNICIAN" | "HOUSEKEEPING">("TECHNICIAN");

  const [workPerformed, setWorkPerformed] = useState("");
  const [additionalWork, setAdditionalWork] = useState("");
  const [workerRemark, setWorkerRemark] = useState("");
  const [chargeAmountVal, setChargeAmountVal] = useState("");
  const [actualCostVal, setActualCostVal] = useState("");

  // State adjustment during render
  const [prevSelectedOrder, setPrevSelectedOrder] = useState<WorkOrder | null>(null);
  if (selectedOrder !== prevSelectedOrder) {
    setPrevSelectedOrder(selectedOrder);
    if (selectedOrder) {
      setWorkPerformed(selectedOrder.work_performed || "");
      setAdditionalWork(selectedOrder.additional_work || "");
      setWorkerRemark(selectedOrder.worker_remark || "");
      setChargeAmountVal(selectedOrder.charge_amount !== null && selectedOrder.charge_amount !== undefined ? selectedOrder.charge_amount.toString() : "");
      setActualCostVal(selectedOrder.actual_cost !== null && selectedOrder.actual_cost !== undefined ? selectedOrder.actual_cost.toString() : "");
    } else {
      setWorkPerformed("");
      setAdditionalWork("");
      setWorkerRemark("");
      setChargeAmountVal("");
      setActualCostVal("");
    }
  }

  // Create Ticket Modal State (Admin)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Plumbing");
  const [newPriority, setNewPriority] = useState<WorkOrderPriority>("NORMAL");
  const [newDescription, setNewDescription] = useState("");
  const [newPropertyId, setNewPropertyId] = useState("");
  const [newUnitId, setNewUnitId] = useState("");
  const [newServiceTeam, setNewServiceTeam] = useState<"TECHNICIAN" | "HOUSEKEEPING">("TECHNICIAN");
  const [newScheduledAt, setNewScheduledAt] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const editAssigneeOptions = React.useMemo(() => {
    const list = serviceTeamVal === "HOUSEKEEPING" ? housekeepers : technicians;
    return list.map(w => ({
      value: w.id,
      label: w.display_name || w.full_name || w.email,
      searchStr: `${w.display_name || ""} ${w.full_name || ""} ${w.email}`
    }));
  }, [serviceTeamVal, housekeepers, technicians]);

  const newAssigneeOptions = React.useMemo(() => {
    const list = newServiceTeam === "HOUSEKEEPING" ? housekeepers : technicians;
    return list.map(w => ({
      value: w.id,
      label: w.display_name || w.full_name || w.email,
      searchStr: `${w.display_name || ""} ${w.full_name || ""} ${w.email}`
    }));
  }, [newServiceTeam, housekeepers, technicians]);

  const newUnitOptions = React.useMemo(() => {
    return units
      .filter(u => u.property_id === newPropertyId)
      .map(u => ({
        value: u.id,
        label: `Unit ${u.unit_number}`,
        searchStr: `Unit ${u.unit_number}`
      }));
  }, [units, newPropertyId]);

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

        // Load housekeepers
        const { data: hks } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, email, phone")
          .eq("role", "housekeeping");
        setHousekeepers((hks as TechnicianProfile[]) || []);
      }

      // Load properties & units for Admin form
      const { data: props } = await supabase.from("properties").select("id, property_name_th, property_name_en");
      setProperties((props as PropertyOption[]) || []);

      const { data: uns } = await supabase.from("units").select("id, unit_number, property_id");
      const sortedUnits = ((uns as UnitOption[]) || []).sort((a, b) => compareUnitNumbers(a.unit_number, b.unit_number));
      setUnits(sortedUnits);

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
        service_team: newServiceTeam,
        assigned_to: newAssigneeId || null,
        scheduled_at: newScheduledAt || null,
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
        setNewServiceTeam("TECHNICIAN");
        setNewScheduledAt("");
        setNewAssigneeId("");
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

  const handleCancelWorkOrder = async (orderId: string) => {
    const reason = prompt(language === "en" ? "Specify cancellation reason (required):" : "ระบุเหตุผลการยกเลิกใบสั่งงาน (จำเป็น):");
    if (!reason || !reason.trim()) {
      alert(language === "en" ? "Cancellation reason is required." : "จำเป็นต้องระบุเหตุผลการยกเลิก");
      return;
    }

    try {
      const res = await fetch(`/api/v1/work-orders/${orderId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellation_reason: reason.trim() })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Work order cancelled successfully" : "ยกเลิกใบสั่งงานเสร็จสิ้น");
        setSelectedOrder(null);
        refreshData();
      } else {
        alert(json.message || "Failed to cancel work order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openAssignModal = (order: WorkOrder) => {
    setSelectedOrder(order);
    setAssigneeId(order.assigned_to || "");
    setPriorityVal(order.priority);
    setScheduledAtVal(order.scheduled_at ? new Date(order.scheduled_at).toISOString().slice(0, 16) : "");
    setServiceTeamVal(order.service_team);
  };

  const isAdmin = ["admin", "super_admin", "property_admin"].includes(role);
  const isTechnician = role === "technician";



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
    if (isTechnician && o.service_team !== "TECHNICIAN") return false;
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && o.priority !== priorityFilter) return false;
    if (categoryFilter !== "ALL" && o.category !== categoryFilter) return false;
    if (propertyFilter !== "ALL" && o.property_id !== propertyFilter) return false;
    if (techFilter !== "ALL" && o.assigned_to !== techFilter) return false;
    if (teamFilter !== "ALL" && o.service_team !== teamFilter) return false;
    return true;
  });

  // Tab splits
  const activeOrders = matchFiltered.filter((o) =>
    activeTab === "ACTIVE"
      ? ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"].includes(o.status)
      : ["CLOSED", "CANCELLED"].includes(o.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={language === "en" ? "Work Orders Dashboard" : "ระบบจัดการใบสั่งงาน"}
        />
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 transition"
          >
            {language === "en" ? "+ Create Work Order" : "+ สร้างใบสั่งงาน"}
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
          {/* Tabs: Active/History & Team Segmented Controls */}
          <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
            {/* Active/History Tabs */}
            <div className="flex gap-1 bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-lg">
              {(["ACTIVE", "HISTORY"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    activeTab === tab
                      ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  {tab === "ACTIVE"
                    ? language === "en" ? "Active Tickets" : "ใบสั่งงานที่กำลังดำเนินการ"
                    : language === "en" ? "Archived Logs" : "ประวัติที่ปิดไปแล้ว"}
                </button>
              ))}
            </div>

            {/* Team Segmentation Tabs (Visible to Admin/Manager only) */}
            {isAdmin && (
              <div className="flex gap-1 bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-lg border border-slate-200/40 dark:border-slate-700/20">
                {([
                  { value: "ALL", labelEn: "All Jobs", labelTh: "ทั้งหมด" },
                  { value: "TECHNICIAN", labelEn: "Technician", labelTh: "งานช่าง" },
                  { value: "HOUSEKEEPING", labelEn: "Housekeeping", labelTh: "งานแม่บ้าน" }
                ] as const).map((team) => (
                  <button
                    key={team.value}
                    onClick={() => setTeamFilter(team.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                      teamFilter === team.value
                        ? "bg-[#D4AF37] text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    {language === "en" ? team.labelEn : team.labelTh}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search bar */}
          <div className="w-full md:w-72">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={language === "en" ? "Search jobs..." : "ค้นหาใบสั่งงาน..."}
            />
          </div>
        </div>

        {/* Advanced Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2 border-t border-slate-50 dark:border-slate-700/50">

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

          {/* Attention status filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Action Required" : "สถานะที่ต้องดำเนินการ"}</span>
            <select
              value={attentionFilter}
              onChange={(e) => setAttentionFilter(e.target.value)}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              <option value="ALL">{language === "en" ? "ALL ATTENTION" : "ทั้งหมด"}</option>
              <option value="ACTION_REQUIRED">{language === "en" ? "ACTION REQUIRED" : "ต้องดำเนินการ"}</option>
              <option value="PENDING_RESCHEDULE">{language === "en" ? "PENDING RESCHEDULE" : "รออนุมัติเลื่อนนัด"}</option>
              <option value="NORMAL">{language === "en" ? "NORMAL" : "ปกติ"}</option>
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
                  <th className="p-4">{language === "en" ? "Attention" : "สถานะดำเนินการ"}</th>
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
                {language === "en" ? "Work Order Sheet" : "ใบสั่งงานอย่างเป็นทางการ"}
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
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Service Team" : "ทีมบริการ"}:</span>
                <span className="col-span-2 text-slate-800 dark:text-slate-200 font-semibold">{selectedOrder.service_team}</span>
              </div>
              {selectedOrder.scheduled_at && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Scheduled At" : "กำหนดเริ่มงาน"}:</span>
                  <span className="col-span-2 text-slate-500 font-mono text-xs">{new Date(selectedOrder.scheduled_at).toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-3">
                <span className="text-slate-400">{language === "en" ? "Acknowledgement" : "การตอบรับงาน"}:</span>
                <span className="col-span-2 text-slate-700 dark:text-slate-300 font-semibold">
                  {selectedOrder.acknowledged_at
                    ? `${language === "en" ? "Accepted at" : "ตอบรับเมื่อ"} ${new Date(selectedOrder.acknowledged_at).toLocaleString()}`
                    : (language === "en" ? "Pending Acceptance" : "ยังไม่ได้ตอบรับงาน")}
                </span>
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
              {!isAdmin && selectedOrder.charge_amount !== null && selectedOrder.charge_amount !== undefined && (
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Charge Amount" : "จำนวนเงินเรียกเก็บ"}:</span>
                  <span className="col-span-2 text-slate-700 dark:text-slate-300 font-bold">{selectedOrder.charge_amount} THB</span>
                </div>
              )}
              {selectedOrder.status === "CANCELLED" && (
                <div className="col-span-3 bg-red-50 dark:bg-red-950/20 p-2.5 rounded border border-red-200/50 text-red-700 dark:text-red-300 mt-2 text-xs">
                  <div className="font-bold">{language === "en" ? "Work Order Cancelled" : "ใบสั่งงานนี้ถูกยกเลิก"}</div>
                  {selectedOrder.cancellation_reason && (
                    <div className="mt-1">
                      <span className="font-semibold">{language === "en" ? "Reason" : "เหตุผล"}: </span>
                      {selectedOrder.cancellation_reason}
                    </div>
                  )}
                  {selectedOrder.cancelled_at && (
                    <div className="text-[10px] opacity-75 mt-0.5 font-mono">
                      {language === "en" ? "Cancelled at" : "ยกเลิกเมื่อ"}: {new Date(selectedOrder.cancelled_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Execution details inputs */}
            {(isTechnician && selectedOrder.status === "IN_PROGRESS" && selectedOrder.assigned_to === currentUser?.id) ? (
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
                    placeholder="Describe repair/work done..."
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

            {/* Photos Section */}
            <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-4">
              <WorkOrderPhotoSection
                orderId={selectedOrder.id}
                stage="BEFORE"
                photos={selectedOrder.photos?.filter((p) => p.photo_stage === "BEFORE") || []}
                canUpload={(isTechnician && selectedOrder.status === "IN_PROGRESS") || (isTechnician && selectedOrder.status === "ASSIGNED" && !!selectedOrder.acknowledged_at)}
                canDelete={isTechnician && selectedOrder.status === "IN_PROGRESS"}
                onRefresh={() => refreshOrderDetails(selectedOrder.id)}
              />
              <WorkOrderPhotoSection
                orderId={selectedOrder.id}
                stage="AFTER"
                photos={selectedOrder.photos?.filter((p) => p.photo_stage === "AFTER") || []}
                canUpload={isTechnician && selectedOrder.status === "IN_PROGRESS"}
                canDelete={isTechnician && selectedOrder.status === "IN_PROGRESS"}
                onRefresh={() => refreshOrderDetails(selectedOrder.id)}
              />
            </div>

            {/* Admin Controls Panel */}
            {isAdmin && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  🛠️ Admin Assignment Panel
                </span>
                
                {/* Service Team Selection */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Service Team" : "ทีมปฏิบัติงาน"}</label>
                  <select
                    value={serviceTeamVal}
                    onChange={(e) => {
                      const nextTeam = e.target.value as "TECHNICIAN" | "HOUSEKEEPING";
                      setServiceTeamVal(nextTeam);
                      setAssigneeId("");
                    }}
                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 outline-none"
                  >
                    <option value="TECHNICIAN">{language === "en" ? "TECHNICIAN" : "งานช่าง"}</option>
                    <option value="HOUSEKEEPING">{language === "en" ? "HOUSEKEEPING" : "งานแม่บ้าน"}</option>
                  </select>
                </div>

                {/* Assign Technician select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    {serviceTeamVal === "TECHNICIAN"
                      ? (language === "en" ? "Technician" : "ช่างเทคนิค")
                      : (language === "en" ? "Housekeeper" : "แม่บ้าน")}
                  </label>
                  <SearchableSelect
                    options={editAssigneeOptions}
                    value={assigneeId}
                    onChange={setAssigneeId}
                    placeholder="-- UNASSIGNED --"
                    searchPlaceholder={language === "en" ? "Search Worker..." : "ค้นหาชื่อผู้ปฏิบัติการ..."}
                    emptyMessage={language === "en" ? "No staff found" : "ไม่พบรายชื่อผู้ปฏิบัติงาน"}
                  />
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

                {/* Scheduled At Selection */}
                <LocalizedDateTimePicker
                  value={scheduledAtVal}
                  onChange={setScheduledAtVal}
                  locale={language}
                  label={language === "en" ? "Scheduled Date" : "กำหนดเริ่มงาน"}
                  className="col-span-1"
                />

                {/* Financial Fields */}
                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Charge Amount" : "จำนวนเงินเรียกเก็บ"}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={chargeAmountVal}
                      onChange={(e) => setChargeAmountVal(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Actual Cost" : "ต้นทุนจริง"}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={actualCostVal}
                      onChange={(e) => setActualCostVal(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                      placeholder="0.00"
                    />
                  </div>
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
                  {["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"].includes(selectedOrder.status) && (
                    <button
                      type="button"
                      onClick={() => handleCancelWorkOrder(selectedOrder.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition"
                    >
                      {language === "en" ? "Cancel Job" : "ยกเลิกใบสั่งงาน"}
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
                      {language === "en" ? "▶ Start Job" : "เริ่มงาน"}
                    </button>
                  )}

                  {selectedOrder.status === "IN_PROGRESS" && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
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
        <div 
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>
            
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Open New Work Order" : "เปิดใบสั่งงานใบใหม่"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "en" ? "Report a service request on behalf of a resident." : "เปิดคำสั่งงานบริการโดยนิติบุคคลโครงการ"}
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
                <SearchableSelect
                  options={newUnitOptions}
                  value={newUnitId}
                  onChange={setNewUnitId}
                  placeholder={language === "en" ? "-- SELECT UNIT --" : "-- เลือกห้องชุด --"}
                  searchPlaceholder={language === "en" ? "Search Unit..." : "ค้นหาห้องชุด..."}
                  emptyMessage={language === "en" ? "No units found" : "ไม่พบห้องชุด"}
                  disabled={!newPropertyId}
                  required
                />
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

              {/* Service Team & Scheduled Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === "en" ? "Service Team" : "ทีมปฏิบัติงาน"}</label>
                  <select
                    value={newServiceTeam}
                    onChange={(e) => {
                      const team = e.target.value as "TECHNICIAN" | "HOUSEKEEPING";
                      setNewServiceTeam(team);
                      setNewAssigneeId("");
                    }}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  >
                    <option value="TECHNICIAN">{language === "en" ? "Technician" : "งานช่าง"}</option>
                    <option value="HOUSEKEEPING">{language === "en" ? "Housekeeping" : "งานแม่บ้าน"}</option>
                  </select>
                </div>

                <LocalizedDateTimePicker
                  value={newScheduledAt}
                  onChange={setNewScheduledAt}
                  locale={language}
                  label={language === "en" ? "Scheduled Date" : "กำหนดเริ่มงาน"}
                  className="col-span-1"
                />
              </div>

              {/* Assignee Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {newServiceTeam === "TECHNICIAN"
                    ? (language === "en" ? "Assign Technician" : "มอบหมายช่างเทคนิค")
                    : (language === "en" ? "Assign Housekeeper" : "มอบหมายแม่บ้าน")}
                </label>
                <SearchableSelect
                  options={newAssigneeOptions}
                  value={newAssigneeId}
                  onChange={setNewAssigneeId}
                  placeholder="-- UNASSIGNED --"
                  searchPlaceholder={language === "en" ? "Search Worker..." : "ค้นหาชื่อผู้ปฏิบัติการ..."}
                  emptyMessage={language === "en" ? "No staff found" : "ไม่พบรายชื่อผู้ปฏิบัติงาน"}
                />
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
