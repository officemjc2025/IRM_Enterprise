"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState, EmptyState, LocalizedDatePicker, SearchableSelect } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, compareUnitNumbers } from "@/shared/utils";
import { ServiceBooking, ServiceBookingStatus, ServiceBookingType, deriveBookingAttention } from "@/features/service-booking/types/service-booking.types";

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

interface PersonOption {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
}

interface WorkerProfile {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string;
}

export default function ServiceBookingsPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <ServiceBookingsContent />
      </Suspense>
    </MainLayout>
  );
}

const supabase = createClient();

function ServiceBookingsContent() {
  const { language } = useLanguage();

  const [role, setRole] = useState<string>("resident");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  
  // Filter States
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [attentionFilter, setAttentionFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");

  // Metadata Options
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [technicians, setTechnicians] = useState<WorkerProfile[]>([]);
  const [housekeepers, setHousekeepers] = useState<WorkerProfile[]>([]);

  // Dialog / Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);

  // Create Form States
  const [newPropId, setNewPropId] = useState("");
  const [newUnitId, setNewUnitId] = useState("");
  const [newCustId, setNewCustId] = useState("");
  const [newType, setNewType] = useState<ServiceBookingType>("ROOM_CLEANING");
  const [newStartDate, setNewStartDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newCustNote, setNewCustNote] = useState("");
  const [newAdminNote, setNewAdminNote] = useState("");
  const [newQuoted, setNewQuoted] = useState("");
  const [newConfirmed, setNewConfirmed] = useState("");

  // Edit Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editQuoted, setEditQuoted] = useState("");
  const [editConfirmed, setEditConfirmed] = useState("");

  // Detail Modal Actions inside selectedBooking
  const [customerNoteEdit, setCustomerNoteEdit] = useState("");
  const [adminNoteEdit, setAdminNoteEdit] = useState("");

  // Dispatch work order variables
  const [dispatchTeam, setDispatchTeam] = useState<"TECHNICIAN" | "HOUSEKEEPING">("HOUSEKEEPING");
  const [dispatchAssignee, setDispatchAssignee] = useState("");

  const newUnitOptions = React.useMemo(() => {
    return units
      .filter((u) => u.property_id === (role === "property_admin" ? propertyFilter : newPropId))
      .map(u => ({
        value: u.id,
        label: `Unit ${u.unit_number}`,
        searchStr: `Unit ${u.unit_number}`
      }));
  }, [units, role, propertyFilter, newPropId]);

  const newCustOptions = React.useMemo(() => {
    return persons.map(p => {
      const name = p.display_name || `${p.first_name} ${p.last_name || ""}`;
      return {
        value: p.id,
        label: name,
        searchStr: name
      };
    });
  }, [persons]);

  const dispatchAssigneeOptions = React.useMemo(() => {
    const list = dispatchTeam === "HOUSEKEEPING" ? housekeepers : technicians;
    return list.map(w => {
      const name = w.display_name || w.full_name || w.email || "Staff";
      return {
        value: w.id,
        label: name,
        searchStr: name
      };
    });
  }, [dispatchTeam, housekeepers, technicians]);

  const isAdmin = ["admin", "super_admin", "property_admin"].includes(role);

  useEffect(() => {
    async function initPage() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please login to access the Service Bookings system.");
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
          setError("Access Denied: You do not have permissions to access the Service Bookings console.");
          setLoading(false);
          return;
        }

        // Setup property filters for property admins
        if (resolvedRole === "property_admin") {
          if (profile?.property_id) {
            setPropertyFilter(profile.property_id);
            setNewPropId(profile.property_id);
          } else {
            setError("Access Denied: Property Admin has no property assigned.");
            setLoading(false);
            return;
          }
        }

        // Fetch properties, units, persons, and workers
        const [propsRes, unitsRes, personsRes, techsRes, housekeepersRes] = await Promise.all([
          supabase.from("properties").select("id, property_name_th, property_name_en"),
          supabase.from("units").select("id, unit_number, property_id"),
          supabase.from("persons").select("id, first_name, last_name, display_name").is("deleted_at", null),
          supabase.from("profiles").select("id, full_name, display_name, email").eq("role", "technician"),
          supabase.from("profiles").select("id, full_name, display_name, email").eq("role", "housekeeping")
        ]);

        setProperties(propsRes.data || []);
        const sortedUnits = (unitsRes.data || []).sort((a, b) => compareUnitNumbers(a.unit_number, b.unit_number));
        setUnits(sortedUnits);
        setPersons(personsRes.data || []);
        setTechnicians(techsRes.data || []);
        setHousekeepers(housekeepersRes.data || []);

        if (resolvedRole !== "property_admin" && propsRes.data && propsRes.data.length > 0) {
          setNewPropId(propsRes.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load metadata resources.");
      }
    }
    initPage();
  }, []);

  const fetchBookingsList = React.useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      let url = `/api/v1/service-bookings?property_id=${propertyFilter}&service_type=${typeFilter}&status=${statusFilter}`;
      if (startDateStr) url += `&start=${new Date(startDateStr).toISOString()}`;
      if (endDateStr) url += `&end=${new Date(endDateStr).toISOString()}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        let list: ServiceBooking[] = json.data || [];
        if (attentionFilter !== "ALL") {
          list = list.filter((b) => deriveBookingAttention(b) === attentionFilter);
        }
        setBookings(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, propertyFilter, typeFilter, statusFilter, startDateStr, endDateStr, searchQuery, attentionFilter]);

  useEffect(() => {
    if (isAdmin) {
      const timer = setTimeout(() => {
        fetchBookingsList();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, fetchBookingsList]);

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropId || !newUnitId || !newStartDate || !newStartTime) {
      alert("Please fill in all required fields.");
      return;
    }

    const bangkokTime = new Date(`${newStartDate}T${newStartTime}:00`);
    try {
      const res = await fetch("/api/v1/service-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: newPropId,
          unit_id: newUnitId,
          customer_person_id: newCustId || null,
          service_type: newType,
          requested_start_at: bangkokTime.toISOString(),
          customer_note: newCustNote.trim() || null,
          admin_note: newAdminNote.trim() || null,
          quoted_amount: newQuoted ? parseFloat(newQuoted) : null,
          confirmed_amount: newConfirmed ? parseFloat(newConfirmed) : null
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setNewUnitId("");
        setNewCustId("");
        setNewCustNote("");
        setNewAdminNote("");
        setNewQuoted("");
        setNewConfirmed("");
        fetchBookingsList();
        alert(language === "en" ? "Service booking created successfully." : "สร้างรายการจองบริการสำเร็จ");
      } else {
        alert(json.message || "Failed to create booking.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateNotes = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/v1/service-bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_note: adminNoteEdit,
          customer_note: customerNoteEdit
        })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedBooking(json.data);
        fetchBookingsList();
        alert(language === "en" ? "Notes updated successfully" : "บันทึกหมายเหตุเพิ่มเติมสำเร็จ");
      } else {
        alert(json.message || "Failed to update notes.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (bookingId: string, nextStatus: ServiceBookingStatus) => {
    try {
      const res = await fetch(`/api/v1/service-bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedBooking(json.data);
        fetchBookingsList();
      } else {
        alert(json.message || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    const startDateTime = new Date(`${editDate}T${editTime}:00`);

    try {
      const res = await fetch(`/api/v1/service-bookings/${selectedBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_start_at: startDateTime.toISOString(),
          quoted_amount: editQuoted ? parseFloat(editQuoted) : null,
          confirmed_amount: editConfirmed ? parseFloat(editConfirmed) : null
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Booking details updated successfully." : "แก้ไขข้อมูลการจองบริการสำเร็จ");
        setIsEditing(false);
        setSelectedBooking(json.data);
        fetchBookingsList();
      } else {
        alert(json.message || "Failed to update booking details.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const reason = prompt(language === "en" ? "Specify cancellation reason (required):" : "ระบุเหตุผลการยกเลิกการจอง (จำเป็น):");
    if (!reason || !reason.trim()) {
      alert(language === "en" ? "Cancellation reason is required." : "จำเป็นต้องระบุเหตุผลการยกเลิก");
      return;
    }

    try {
      const res = await fetch(`/api/v1/service-bookings/${bookingId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellation_reason: reason.trim() })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Booking cancelled successfully." : "ยกเลิกใบจองบริการเรียบร้อยแล้ว");
        setSelectedBooking(null);
        fetchBookingsList();
      } else {
        alert(json.message || "Failed to cancel booking.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispatchWorkOrder = async (bookingId: string) => {
    if (!confirm(language === "en" ? "Generate execution Work Order for this booking?" : "สร้างใบงานสำหรับรายการจองนี้?")) return;
    try {
      const res = await fetch(`/api/v1/service-bookings/${bookingId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_team: dispatchTeam,
          assigned_to: dispatchAssignee || null
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Work order dispatched successfully." : "ออกใบสั่งปฏิบัติงานสำเร็จ");
        // Reload details
        const detRes = await fetch(`/api/v1/service-bookings/${bookingId}`);
        const detJson = await detRes.json();
        if (detJson.success) {
          setSelectedBooking(detJson.data);
        }
        fetchBookingsList();
      } else {
        alert(json.message || "Failed to dispatch work order.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openBookingDetails = (b: ServiceBooking) => {
    setSelectedBooking(b);
    setCustomerNoteEdit(b.customer_note || "");
    setAdminNoteEdit(b.admin_note || "");
    setDispatchAssignee("");
    setDispatchTeam("HOUSEKEEPING");

    // Reset editing states
    setIsEditing(false);
    setEditDate(b.requested_start_at ? b.requested_start_at.slice(0, 10) : "");
    setEditTime(b.requested_start_at ? b.requested_start_at.slice(11, 16) : "12:00");
    setEditQuoted(b.quoted_amount ? b.quoted_amount.toString() : "");
    setEditConfirmed(b.confirmed_amount ? b.confirmed_amount.toString() : "");
  };



  if (error && !isAdmin) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-md">
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
          {language === "en" ? "Access Denied" : "ปฏิเสธการเข้าถึง"}
        </h2>
        <p className="text-slate-500 dark:text-slate-350">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={language === "en" ? "Service Bookings Workspace" : "ระบบจองและคำขอบริการห้องชุด"}
        />
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 transition"
        >
          {language === "en" ? "+ New Booking" : "+ จองบริการห้องพัก"}
        </button>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Property Filter */}
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

            {/* Service Type Filter */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Service Type" : "ประเภทบริการ"}</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL TYPES</option>
                <option value="ROOM_CLEANING">ROOM CLEANING</option>
                <option value="ROOM_SERVICE">ROOM SERVICE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Lifecycle Status" : "สถานะวงจรการจอง"}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL LIFECYCLE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_CONFIRMATION">PENDING CONFIRMATION</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="WORK_ORDER_CREATED">WORK ORDER CREATED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            {/* Attention Status Filter */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Action Required" : "สถานะดำเนินการ"}</span>
              <select
                value={attentionFilter}
                onChange={(e) => setAttentionFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL ATTENTION</option>
                <option value="PENDING_CONFIRMATION">{language === "en" ? "Pending Confirmation" : "รอยืนยันการจอง"}</option>
                <option value="CONFIRMED_NOT_DISPATCHED">{language === "en" ? "Confirmed (Pending Work Order)" : "ยืนยันแล้ว รอสร้างใบงาน"}</option>
                <option value="WORK_ORDER_CREATED">{language === "en" ? "Work Order Dispatched" : "สร้างใบงานแล้ว"}</option>
                <option value="CANCELLED">{language === "en" ? "Cancelled" : "ยกเลิกแล้ว"}</option>
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="w-full md:w-64">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{language === "en" ? "Search text" : "คำค้นหา"}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "en" ? "Booking # or Unit..." : "ค้นหาจากรหัสหรือห้อง..."}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none w-full"
            />
          </div>
        </div>

        {/* Date Ranges bounds */}
        <div className="flex gap-4 border-t border-slate-100 dark:border-slate-700/50 pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{language === "en" ? "Start Date" : "วันที่เริ่มต้น"}</span>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{language === "en" ? "End Date" : "วันที่สิ้นสุด"}</span>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <EmptyState message={language === "en" ? "No service bookings matched filters" : "ไม่พบประวัติรายการจองบริการ"} />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === "en" ? "Booking Reference" : "รหัสใบจองบริการ"}</th>
                  <th className="p-4">{language === "en" ? "Service" : "บริการ"}</th>
                  <th className="p-4">{language === "en" ? "Room & Property" : "ห้องชุด / โครงการ"}</th>
                  <th className="p-4">{language === "en" ? "Appointment Date" : "เวลานัดหมาย"}</th>
                  <th className="p-4">{language === "en" ? "Status" : "สถานะ"}</th>
                  <th className="p-4">{language === "en" ? "Attention" : "ประเด็นงาน"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "ดำเนินการ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {bookings.map((b) => {
                  const propName = b.property
                    ? language === "en" ? b.property.property_name_en || b.property.property_name_th : b.property.property_name_th
                    : "-";
                  const attention = deriveBookingAttention(b);

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {b.booking_number}
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {b.service_type}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          Unit {b.unit?.unit_number || "-"}
                        </div>
                        <span className="text-xs text-slate-400">{propName}</span>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {formatDateTime(b.requested_start_at, language)}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          {b.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                          attention === "PENDING_CONFIRMATION"
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300 animate-pulse"
                            : attention === "CONFIRMED_NOT_DISPATCHED"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : attention === "WORK_ORDER_CREATED"
                            ? "bg-green-100 text-green-800"
                            : attention === "CANCELLED"
                            ? "bg-slate-100 text-slate-400"
                            : "bg-slate-50 text-slate-400"
                        }`}>
                          {attention === "PENDING_CONFIRMATION" ? (language === "en" ? "Pending Confirmation" : "รอยืนยันการจอง") :
                           attention === "CONFIRMED_NOT_DISPATCHED" ? (language === "en" ? "Confirmed (No Dispatch)" : "ยืนยันแล้ว รอสร้างใบงาน") :
                           attention === "WORK_ORDER_CREATED" ? (language === "en" ? "Work Order Dispatched" : "สร้างใบงานแล้ว") :
                           attention === "CANCELLED" ? (language === "en" ? "Cancelled" : "ยกเลิกแล้ว") :
                           (language === "en" ? "Normal" : "ปกติ")}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openBookingDetails(b)}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-350 transition"
                        >
                          {language === "en" ? "Manage / Details" : "จัดการ / รายละเอียด"}
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

      {/* -------------------------------------------------------------------------
          CREATE BOOKING MODAL
          ------------------------------------------------------------------------- */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <form
            onSubmit={handleCreateBooking}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full max-h-[95vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4"
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "New Service Booking" : "สร้างรายการจองบริการใหม่"}
              </h3>
            </div>

            <div className="space-y-3">
              {/* Property Choice */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Property" : "โครงการ"}</label>
                <select
                  value={role === "property_admin" ? propertyFilter : newPropId}
                  disabled={role === "property_admin"}
                  onChange={(e) => setNewPropId(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Choice */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Unit / Room" : "ห้องชุด"}</label>
                <SearchableSelect
                  options={newUnitOptions}
                  value={newUnitId}
                  onChange={setNewUnitId}
                  placeholder={language === "en" ? "-- SELECT ROOM --" : "-- เลือกห้องชุด --"}
                  searchPlaceholder={language === "en" ? "Search Unit..." : "ค้นหาห้องชุด..."}
                  emptyMessage={language === "en" ? "No units found" : "ไม่พบห้องชุด"}
                  required
                />
              </div>

              {/* Customer Choice */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Customer (Person)" : "ลูกค้าผู้เข้าพัก (บุคคล)"}</label>
                <SearchableSelect
                  options={newCustOptions}
                  value={newCustId}
                  onChange={setNewCustId}
                  placeholder={language === "en" ? "-- EXTERNAL GUEST / UNREGISTERED --" : "-- บุคคลภายนอก / ผู้เข้าพักทั่วไป --"}
                  searchPlaceholder={language === "en" ? "Search Guest Name..." : "ค้นหาชื่อผู้เข้าพัก..."}
                  emptyMessage={language === "en" ? "No guests found" : "ไม่พบข้อมูลบุคคล"}
                />
              </div>

              {/* Service Type */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Service Type" : "ประเภทบริการ"}</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ServiceBookingType)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full"
                >
                  <option value="ROOM_CLEANING">ROOM CLEANING</option>
                  <option value="ROOM_SERVICE">ROOM SERVICE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <LocalizedDatePicker
                  value={newStartDate}
                  onChange={setNewStartDate}
                  required
                  locale={language}
                  label={language === "en" ? "Date" : "วันที่"}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Time" : "เวลา"}</label>
                  <input
                    type="time"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none font-bold text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Financial entries */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Quoted Amount (THB)" : "จำนวนเสนอราคา"}</label>
                  <input
                    type="number"
                    value={newQuoted}
                    onChange={(e) => setNewQuoted(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="e.g. 1000"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Confirmed Amount (THB)" : "ยอดชำระที่ยืนยัน"}</label>
                  <input
                    type="number"
                    value={newConfirmed}
                    onChange={(e) => setNewConfirmed(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="e.g. 1000"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Customer Note" : "บันทึกจากลูกค้า"}</label>
                <textarea
                  value={newCustNote}
                  onChange={(e) => setNewCustNote(e.target.value)}
                  rows={2}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                  placeholder="e.g. Needs cleaning supplies..."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Admin Note (Internal)" : "บันทึกภายใน (แอดมิน)"}</label>
                <textarea
                  value={newAdminNote}
                  onChange={(e) => setNewAdminNote(e.target.value)}
                  rows={2}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                  placeholder="e.g. Confirmed with manager..."
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold py-2.5 rounded-lg transition mt-2"
            >
              {language === "en" ? "Save Booking" : "บันทึกการจองบริการ"}
            </button>
          </form>
        </div>
      )}

      {/* -------------------------------------------------------------------------
          BOOKING DETAIL & DISPATCH WORKSPACE MODAL
          ------------------------------------------------------------------------- */}
      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4"
          >
            <button
              onClick={() => setSelectedBooking(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Service Booking Sheet" : "ใบแสดงการจองบริการ"}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Booking Reference: {selectedBooking.booking_number}
              </p>
            </div>

            {isEditing ? (
              <form onSubmit={handleEditBooking} className="border-t border-b border-slate-100 dark:border-slate-700 py-3 space-y-3 text-xs">
                <span className="font-bold text-[#D4AF37]">{language === "en" ? "Edit Booking Details" : "แก้ไขรายละเอียดการนัดหมาย"}</span>
                <div className="grid grid-cols-2 gap-2">
                  <LocalizedDatePicker
                    value={editDate}
                    onChange={setEditDate}
                    required
                    locale={language}
                    label={language === "en" ? "Date" : "วันที่"}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Time" : "เวลา"}</label>
                    <input
                      type="time"
                      required
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none font-bold text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Quoted Amount (THB)" : "จำนวนเสนอราคา"}</label>
                    <input
                      type="number"
                      value={editQuoted}
                      onChange={(e) => setEditQuoted(e.target.value)}
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Confirmed Amount (THB)" : "ยอดชำระที่ยืนยัน"}</label>
                    <input
                      type="number"
                      value={editConfirmed}
                      onChange={(e) => setEditConfirmed(e.target.value)}
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#D4AF37] text-white text-xs font-bold py-2 rounded shadow"
                  >
                    {language === "en" ? "Save Changes" : "บันทึกการแก้ไข"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded"
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="border-t border-b border-slate-100 dark:border-slate-700 py-3 space-y-2.5 text-sm">
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Service Type" : "บริการ"}:</span>
                  <span className="col-span-2 font-semibold text-slate-850 dark:text-slate-200">{selectedBooking.service_type}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Property & Unit" : "โครงการ / ห้อง"}:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    Unit {selectedBooking.unit?.unit_number} (
                    {selectedBooking.property
                      ? language === "en" ? selectedBooking.property.property_name_en || selectedBooking.property.property_name_th : selectedBooking.property.property_name_th
                      : "-"}
                    )
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Customer" : "ผู้จอง"}:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {selectedBooking.customer
                      ? selectedBooking.customer.display_name || `${selectedBooking.customer.first_name} ${selectedBooking.customer.last_name || ""}`
                      : (language === "en" ? "External / Unregistered Guest" : "ผู้เข้าพักทั่วไป")}
                  </span>
                </div>
                <div className="grid grid-cols-3 items-center">
                  <span className="text-slate-400">{language === "en" ? "Schedule Date" : "วันที่นัดหมาย"}:</span>
                  <div className="col-span-2 flex justify-between items-center">
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                      {formatDateTime(selectedBooking.requested_start_at, language)}
                    </span>
                    {!selectedBooking.work_order_id && !["COMPLETED", "CANCELLED"].includes(selectedBooking.status) && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border"
                      >
                        {language === "en" ? "Edit" : "แก้ไข"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Lifecycle Status" : "สถานะ"}:</span>
                  <span className="col-span-2 font-bold text-xs">{selectedBooking.status}</span>
                </div>
                
                {/* Financial boundaries */}
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Amounts (THB)" : "ยอดการเงิน (บาท)"}:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    Quoted: {selectedBooking.quoted_amount || 0} | Confirmed: {selectedBooking.confirmed_amount || 0}
                  </span>
                </div>

                {/* Linked Work Order section */}
                {selectedBooking.work_order_id && (
                  <div className="grid grid-cols-3 bg-green-50/50 dark:bg-green-950/20 p-1.5 rounded border border-green-200/50">
                    <span className="text-green-600 font-bold">{language === "en" ? "Work Order" : "ใบสั่งงานปฏิบัติ"}:</span>
                    <span className="col-span-2 font-semibold text-xs text-green-700 dark:text-green-300">
                      ID: {selectedBooking.work_order_id} ({selectedBooking.work_order?.status || "ASSIGNED"})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Notes edit section */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Customer Note" : "บันทึกจากลูกค้า"}</label>
                <textarea
                  value={customerNoteEdit}
                  onChange={(e) => setCustomerNoteEdit(e.target.value)}
                  rows={2}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Admin Note (Internal)" : "บันทึกของแอดมิน"}</label>
                <textarea
                  value={adminNoteEdit}
                  onChange={(e) => setAdminNoteEdit(e.target.value)}
                  rows={2}
                  className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs dark:bg-slate-900 outline-none"
                />
              </div>
              <button
                onClick={() => handleUpdateNotes(selectedBooking.id)}
                className="w-full bg-slate-200 hover:bg-slate-350 text-slate-800 text-xs font-bold py-1 rounded transition"
              >
                {language === "en" ? "Save Notes" : "อัปเดตบันทึกช่วยจำ"}
              </button>
            </div>

            {/* Actions workflow */}
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedBooking.status === "PENDING_CONFIRMATION" && (
                <button
                  onClick={() => handleUpdateStatus(selectedBooking.id, "CONFIRMED")}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 rounded transition"
                >
                  {language === "en" ? "Confirm Appointment" : "ยืนยันการจอง"}
                </button>
              )}
              {["PENDING_CONFIRMATION", "CONFIRMED"].includes(selectedBooking.status) && (
                <button
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1.5 rounded transition"
                >
                  {language === "en" ? "Cancel Booking" : "ยกเลิกการจอง"}
                </button>
              )}
            </div>

            {/* Dispatch / Convert to Work Order Area */}
            {selectedBooking.status === "CONFIRMED" && !selectedBooking.work_order_id && (
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
                <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block">
                  🚀 {language === "en" ? "Dispatch Service Job" : "สั่งงานและออกใบงานปฏิบัติการ"}
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Execution Team" : "ทีมปฏิบัติงาน"}</label>
                    <select
                      value={dispatchTeam}
                      onChange={(e) => {
                        setDispatchTeam(e.target.value as "TECHNICIAN" | "HOUSEKEEPING");
                        setDispatchAssignee("");
                      }}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none"
                    >
                      <option value="TECHNICIAN">TECHNICIAN</option>
                      <option value="HOUSEKEEPING">HOUSEKEEPING</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Assign Worker" : "ระบุผู้ปฏิบัติงาน"}</label>
                    <SearchableSelect
                      options={dispatchAssigneeOptions}
                      value={dispatchAssignee}
                      onChange={setDispatchAssignee}
                      placeholder={language === "en" ? "-- Unassigned --" : "-- ยังไม่มอบหมายบุคคล --"}
                      searchPlaceholder={language === "en" ? "Search Worker..." : "ค้นหาผู้ปฏิบัติงาน..."}
                      emptyMessage={language === "en" ? "No staff found" : "ไม่พบรายชื่อผู้ปฏิบัติการ"}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleDispatchWorkOrder(selectedBooking.id)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded transition"
                >
                  {language === "en" ? "Create Work Order" : "สร้างใบงานปฏิบัติการ (Dispatch)"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
