"use client";

import React, { useEffect, useState, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState, EmptyState, LocalizedDatePicker } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { Reservation, ReservationStatus, ReservationType, BillingBasis, PricingMethod, ReservationExtension, deriveReservationAttention } from "@/features/reservation/types/reservation.types";
import { 
  formatDate, 
  translateReservationType, 
  translateBillingBasis, 
  translateReservationStatus, 
  translateExtensionPricing, 
  translateAttention 
} from "@/shared/utils";

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
  role: string;
}

export default function ReservationsPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <ReservationsContent />
      </Suspense>
    </MainLayout>
  );
}

const supabase = createClient();

function ReservationsContent() {
  const { language } = useLanguage();

  const [role, setRole] = useState<string>("resident");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reservations, setReservations] = useState<Reservation[]>([]);

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
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);

  // Dialog / Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [selectedExtensions, setSelectedExtensions] = useState<ReservationExtension[]>([]);

  // Create Form States
  const [newPropId, setNewPropId] = useState("");
  const [newUnitId, setNewUnitId] = useState("");
  const [newCustId, setNewCustId] = useState("");
  const [newType, setNewType] = useState<ReservationType>("RENTAL_GUEST");
  const [newBasis, setNewBasis] = useState<BillingBasis>("MONTHLY");
  const [newCheckInDate, setNewCheckInDate] = useState("");
  const [newCheckInTime] = useState("14:00");
  const [newCheckOutDate, setNewCheckOutDate] = useState("");
  const [newCheckOutTime] = useState("12:00");
  const [newAdults, setNewAdults] = useState("1");
  const [newChildren, setNewChildren] = useState("0");
  const [newMonthlyRate, setNewMonthlyRate] = useState("");
  const [newDailyRate, setNewDailyRate] = useState("");
  const [newBaseAmount, setNewBaseAmount] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newDeposit, setNewDeposit] = useState("");
  const [newCalcTotal, setNewCalcTotal] = useState("");
  const [newApprovedTotal, setNewApprovedTotal] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [newExtRef, setNewExtRef] = useState("");
  const [newGuestNote, setNewGuestNote] = useState("");
  const [newInternalNote, setNewInternalNote] = useState("");

  // Edit / Update Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editCheckInDate, setEditCheckInDate] = useState("");
  const [editCheckOutDate, setEditCheckOutDate] = useState("");
  const [editUnitId, setEditUnitId] = useState("");

  // Availability Indicator
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // Dispatch Work Order Form States (Inside details modal)
  const [dispatchTitle, setDispatchTitle] = useState("");
  const [dispatchDesc, setDispatchDesc] = useState("");
  const [dispatchCategory, setDispatchCategory] = useState("Cleaning");
  const [dispatchPriority, setDispatchPriority] = useState("NORMAL");
  const [dispatchTeam, setDispatchTeam] = useState<"TECHNICIAN" | "HOUSEKEEPING">("HOUSEKEEPING");
  const [dispatchAssignee, setDispatchAssignee] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [dispatchTime, setDispatchTime] = useState("10:00");

  // Extension Request Form States (Inside details modal)
  const [extDate, setExtDate] = useState("");
  const [extMethod, setExtMethod] = useState<PricingMethod>("HALF_MONTH");
  const [extReason, setExtReason] = useState("");
  const [extCalcAmount, setExtCalcAmount] = useState<number>(0);
  const [extApprovedAmount, setExtApprovedAmount] = useState("");

  // Approval Overlay State
  const [activeExtForApproval, setActiveExtForApproval] = useState<ReservationExtension | null>(null);
  const [approvalInputAmount, setApprovalInputAmount] = useState("");

  const isAdmin = ["admin", "super_admin", "property_admin"].includes(role);

  useEffect(() => {
    async function initPage() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please login to access the Room Reservations console.");
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
          setError("Access Denied: You do not have permissions to view the Room Reservations Management Console.");
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
        const [propsRes, unitsRes, personsRes, workersRes] = await Promise.all([
          supabase.from("properties").select("id, property_name_th, property_name_en"),
          supabase.from("units").select("id, unit_number, property_id"),
          supabase.from("persons").select("id, first_name, last_name, display_name").is("deleted_at", null),
          supabase.from("profiles").select("id, full_name, display_name, role").in("role", ["technician", "housekeeping"])
        ]);

        setProperties(propsRes.data || []);
        setUnits(unitsRes.data || []);
        setPersons(personsRes.data || []);
        setWorkers(workersRes.data || []);

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

  const fetchReservationsList = React.useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      let url = `/api/v1/reservations?property_id=${propertyFilter}&reservation_type=${typeFilter}&status=${statusFilter}`;
      if (startDateStr) url += `&start=${new Date(startDateStr).toISOString()}`;
      if (endDateStr) url += `&end=${new Date(endDateStr).toISOString()}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        let list: Reservation[] = json.data || [];
        if (attentionFilter !== "ALL") {
          list = list.filter((r) => deriveReservationAttention(r) === attentionFilter);
        }
        setReservations(list);
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
        fetchReservationsList();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, fetchReservationsList]);

  useEffect(() => {
    if (!newUnitId || !newCheckInDate || !newCheckOutDate) {
      const timer = setTimeout(() => {
        setAvailabilityMessage("");
        setIsAvailable(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const checkIn = new Date(`${newCheckInDate}T${newCheckInTime}:00`).toISOString();
    const checkOut = new Date(`${newCheckOutDate}T${newCheckOutTime}:00`).toISOString();

    if (new Date(checkOut) <= new Date(checkIn)) {
      const timer = setTimeout(() => {
        setAvailabilityMessage(language === "en" ? "Check-out must be after check-in" : "วันเวลาเช็คเอาท์ต้องอยู่หลังเช็คอิน");
        setIsAvailable(false);
      }, 0);
      return () => clearTimeout(timer);
    }

    async function checkAvailability() {
      try {
        setAvailabilityChecking(true);
        const res = await fetch(`/api/v1/reservations/availability?unit_id=${newUnitId}&check_in_at=${checkIn}&check_out_at=${checkOut}`);
        const json = await res.json();
        if (json.success) {
          setIsAvailable(json.available);
          setAvailabilityMessage(
            json.available
              ? language === "en" ? "✓ Unit is available!" : "✓ ห้องชุดนี้ว่างสำหรับการจอง"
              : language === "en" ? "✕ Room conflict detected for dates" : "✕ ตารางห้องพักทับซ้อนกับการจองอื่น"
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAvailabilityChecking(false);
      }
    }
    checkAvailability();
  }, [newUnitId, newCheckInDate, newCheckInTime, newCheckOutDate, newCheckOutTime, language]);

  // Recommended Stay Price Calculator (State adjustment during render)
  const [prevPriceCalcInputs, setPrevPriceCalcInputs] = useState({
    newBasis, newMonthlyRate, newDailyRate, newDiscount, newCheckInDate, newCheckOutDate
  });
  if (
    newBasis !== prevPriceCalcInputs.newBasis ||
    newMonthlyRate !== prevPriceCalcInputs.newMonthlyRate ||
    newDailyRate !== prevPriceCalcInputs.newDailyRate ||
    newDiscount !== prevPriceCalcInputs.newDiscount ||
    newCheckInDate !== prevPriceCalcInputs.newCheckInDate ||
    newCheckOutDate !== prevPriceCalcInputs.newCheckOutDate
  ) {
    setPrevPriceCalcInputs({ newBasis, newMonthlyRate, newDailyRate, newDiscount, newCheckInDate, newCheckOutDate });
    const monthlyVal = parseFloat(newMonthlyRate) || 0;
    const dailyVal = parseFloat(newDailyRate) || 0;
    const discVal = parseFloat(newDiscount) || 0;

    let base = 0;
    if (newBasis === "MONTHLY") {
      base = monthlyVal;
    } else if (newBasis === "DAILY" && newCheckInDate && newCheckOutDate) {
      const start = new Date(newCheckInDate);
      const end = new Date(newCheckOutDate);
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      base = dailyVal * days;
    }

    setNewBaseAmount(base.toString());
    const total = Math.max(0, base - discVal);
    setNewCalcTotal(total.toString());
    setNewApprovedTotal(total.toString());
  }

  // Recommended Extension Price Calculator (State adjustment during render)
  const [prevExtCalcInputs, setPrevExtCalcInputs] = useState({
    selectedResId: selectedRes?.id, extDate, extMethod
  });
  if (
    selectedRes?.id !== prevExtCalcInputs.selectedResId ||
    extDate !== prevExtCalcInputs.extDate ||
    extMethod !== prevExtCalcInputs.extMethod
  ) {
    setPrevExtCalcInputs({ selectedResId: selectedRes?.id, extDate, extMethod });
    if (!selectedRes || !extDate) {
      setExtCalcAmount(0);
      setExtApprovedAmount("0");
    } else {
      const prevCheckout = new Date(selectedRes.check_out_at);
      const newCheckout = new Date(`${extDate}T12:00:00`);
      const diffTime = newCheckout.getTime() - prevCheckout.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (days <= 0) {
        setExtCalcAmount(0);
        setExtApprovedAmount("0");
      } else {
        const monthlyVal = selectedRes.monthly_rate || 0;
        const dailyVal = selectedRes.daily_rate || 0;

        let amount = 0;
        if (extMethod === "HALF_MONTH") {
          amount = monthlyVal / 2;
        } else if (extMethod === "FULL_MONTH") {
          amount = monthlyVal;
        } else if (extMethod === "DAILY_PRORATE") {
          if (dailyVal > 0) {
            amount = dailyVal * days;
          } else {
            amount = 0;
          }
        } else {
          amount = 0;
        }

        setExtCalcAmount(amount);
        setExtApprovedAmount(amount.toString());
      }
    }
  }

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropId || !newUnitId || !newCheckInDate || !newCheckOutDate) {
      alert("Please fill in all required fields.");
      return;
    }

    if (isAvailable === false) {
      alert(language === "en" ? "Cannot book due to date conflict." : "ไม่สามารถบันทึกการจองได้เนื่องจากเวลากระทบยอดกับใบจองอื่น");
      return;
    }

    const checkIn = new Date(`${newCheckInDate}T${newCheckInTime}:00`);
    const checkOut = new Date(`${newCheckOutDate}T${newCheckOutTime}:00`);

    try {
      const res = await fetch("/api/v1/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: newPropId,
          unit_id: newUnitId,
          primary_guest_person_id: newCustId || null,
          reservation_type: newType,
          billing_basis: newBasis,
          check_in_at: checkIn.toISOString(),
          check_out_at: checkOut.toISOString(),
          adult_count: parseInt(newAdults),
          child_count: parseInt(newChildren),
          monthly_rate: newMonthlyRate ? parseFloat(newMonthlyRate) : null,
          daily_rate: newDailyRate ? parseFloat(newDailyRate) : null,
          base_rental_amount: newBaseAmount ? parseFloat(newBaseAmount) : null,
          discount_amount: newDiscount ? parseFloat(newDiscount) : 0.00,
          deposit_amount: newDeposit ? parseFloat(newDeposit) : 0.00,
          calculated_total_amount: newCalcTotal ? parseFloat(newCalcTotal) : null,
          approved_total_amount: newApprovedTotal ? parseFloat(newApprovedTotal) : null,
          booking_channel: newChannel.trim() || null,
          external_reference: newExtRef.trim() || null,
          guest_note: newGuestNote.trim() || null,
          internal_note: newInternalNote.trim() || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setNewUnitId("");
        setNewCustId("");
        setNewGuestNote("");
        setNewInternalNote("");
        setNewMonthlyRate("");
        setNewDailyRate("");
        setNewDiscount("");
        setNewDeposit("");
        setNewChannel("");
        setNewExtRef("");
        fetchReservationsList();
        alert(language === "en" ? "Room reservation created successfully." : "สร้างรายการจองห้องพักสำเร็จ");
      } else {
        alert(json.message || "Failed to create reservation.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (resId: string, nextStatus: ReservationStatus) => {
    try {
      const res = await fetch(`/api/v1/reservations/${resId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedRes(json.data);
        fetchReservationsList();
      } else {
        alert(json.message || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes) return;

    try {
      const res = await fetch(`/api/v1/reservations/${selectedRes.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in_at: new Date(`${editCheckInDate}T12:00:00`).toISOString(),
          check_out_at: new Date(`${editCheckOutDate}T12:00:00`).toISOString(),
          unit_id: editUnitId
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Stay details updated successfully." : "แก้ไขข้อมูลสัญญาสำเร็จ");
        setIsEditing(false);
        setSelectedRes(json.data);
        fetchReservationsList();
      } else {
        alert(json.message || "Failed to update stay details.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelReservation = async (resId: string) => {
    const reason = prompt(language === "en" ? "Specify cancellation reason (required):" : "ระบุเหตุผลการยกเลิกสัญญา (จำเป็น):");
    if (!reason || !reason.trim()) {
      alert(language === "en" ? "Cancellation reason is required." : "จำเป็นต้องระบุเหตุผลการยกเลิก");
      return;
    }

    try {
      const res = await fetch(`/api/v1/reservations/${resId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellation_reason: reason.trim() })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Reservation cancelled successfully." : "ยกเลิกสัญญาเช่าเรียบร้อยแล้ว");
        setSelectedRes(null);
        fetchReservationsList();
      } else {
        alert(json.message || "Failed to cancel reservation.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispatchWorkOrder = async (resId: string) => {
    if (!dispatchTitle || !dispatchDate) {
      alert("Please fill in title and schedule date.");
      return;
    }

    const scheduledTime = new Date(`${dispatchDate}T${dispatchTime}:00`);

    try {
      const res = await fetch(`/api/v1/reservations/${resId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dispatchTitle,
          description: dispatchDesc,
          service_team: dispatchTeam,
          scheduled_at: scheduledTime.toISOString(),
          assigned_to: dispatchAssignee || null,
          priority: dispatchPriority,
          category: dispatchCategory
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Work order dispatched successfully." : "สั่งงานและสร้างใบสั่งงานสำเร็จ");
        setDispatchTitle("");
        setDispatchDesc("");
        setDispatchAssignee("");
        const detRes = await fetch(`/api/v1/reservations/${resId}`);
        const detJson = await detRes.json();
        if (detJson.success) {
          setSelectedRes(detJson.data);
        }
        fetchReservationsList();
      } else {
        alert(json.message || "Failed to dispatch work order.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequestExtension = async (resId: string) => {
    if (!extDate || !extReason) {
      alert("Please select target checkout date and provide override reason.");
      return;
    }

    try {
      const res = await fetch(`/api/v1/reservations/${resId}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_check_out_at: new Date(`${extDate}T12:00:00`).toISOString(),
          pricing_method: extMethod,
          calculated_amount: extCalcAmount,
          approved_amount: parseFloat(extApprovedAmount) || 0,
          reason: extReason
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Stay checkout extension requested successfully." : "ยื่นคำขอขยายระยะเวลาพักสำเร็จ");
        setExtDate("");
        setExtReason("");
        fetchExtensionsList(resId);
      } else {
        alert(json.message || "Failed to request extension.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExtensionsList = async (resId: string) => {
    try {
      const res = await fetch(`/api/v1/reservations/${resId}/extensions`);
      const json = await res.json();
      if (json.success) {
        setSelectedExtensions(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveExtension = async (resId: string, extId: string) => {
    try {
      const res = await fetch(`/api/v1/reservations/${resId}/extensions/${extId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_amount: parseFloat(approvalInputAmount) || 0 })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Extension approved, stay checkout date extended!" : "อนุมัติขยายระยะเวลาและปรับปรุงห้องสำเร็จ");
        setActiveExtForApproval(null);
        const detRes = await fetch(`/api/v1/reservations/${resId}`);
        const detJson = await detRes.json();
        if (detJson.success) {
          setSelectedRes(detJson.data);
        }
        fetchExtensionsList(resId);
        fetchReservationsList();
      } else {
        alert(json.message || "Failed to approve extension");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openReservationDetails = (res: Reservation) => {
    setSelectedRes(res);
    setDispatchTitle("");
    setDispatchDesc("");
    setDispatchAssignee("");
    setDispatchDate("");
    setDispatchCategory("Cleaning");
    setDispatchPriority("NORMAL");
    setDispatchTeam("HOUSEKEEPING");
    setExtDate("");
    setExtReason("");
    
    // Reset editing states
    setIsEditing(false);
    setEditCheckInDate(res.check_in_at ? res.check_in_at.slice(0, 10) : "");
    setEditCheckOutDate(res.check_out_at ? res.check_out_at.slice(0, 10) : "");
    setEditUnitId(res.unit_id || "");

    fetchExtensionsList(res.id);
  };

  const filteredUnits = units.filter((u) => u.property_id === (role === "property_admin" ? propertyFilter : newPropId));
  const filteredWorkers = workers.filter((w) => w.role.toUpperCase() === dispatchTeam);

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
      <div className="flex items-center justify-between">
        <PageHeader
          title={language === "en" ? "Long-Stay Rentals Console" : "ระบบจัดการผู้เช่าระยะยาว"}
        />
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 transition"
        >
          {language === "en" ? "+ New Rental Stay" : "+ ทำใบจองห้องเช่า"}
        </button>
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
                <option value="ALL">ALL PROPERTIES</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Stay Type" : "ประเภทการจอง"}</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL TYPES</option>
                <option value="RENTAL_GUEST">{translateReservationType("RENTAL_GUEST", language)}</option>
                <option value="OWNER_STAY">{translateReservationType("OWNER_STAY", language)}</option>
                <option value="MANAGEMENT_USE">{translateReservationType("MANAGEMENT_USE", language)}</option>
                <option value="OTHER">{translateReservationType("OTHER", language)}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Stay Status" : "สถานะการเข้าพัก"}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="DRAFT">{translateReservationStatus("DRAFT", language)}</option>
                <option value="PENDING_CONFIRMATION">{translateReservationStatus("PENDING_CONFIRMATION", language)}</option>
                <option value="CONFIRMED">{translateReservationStatus("CONFIRMED", language)}</option>
                <option value="CHECKED_IN">{translateReservationStatus("CHECKED_IN", language)}</option>
                <option value="CHECKED_OUT">{translateReservationStatus("CHECKED_OUT", language)}</option>
                <option value="CANCELLED">{translateReservationStatus("CANCELLED", language)}</option>
                <option value="NO_SHOW">{translateReservationStatus("NO_SHOW", language)}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === "en" ? "Attention State" : "ความสำคัญที่ต้องติดตาม"}</span>
              <select
                value={attentionFilter}
                onChange={(e) => setAttentionFilter(e.target.value)}
                className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs font-semibold outline-none"
              >
                <option value="ALL">ALL ATTENTION</option>
                <option value="PENDING_CONFIRMATION">{translateAttention("PENDING_CONFIRMATION", language)}</option>
                <option value="UPCOMING_CHECK_IN">{translateAttention("UPCOMING_CHECK_IN", language)}</option>
                <option value="CURRENTLY_IN_HOUSE">{translateAttention("CURRENTLY_IN_HOUSE", language)}</option>
                <option value="CANCELLED">{translateAttention("CANCELLED", language)}</option>
                <option value="NO_SHOW">{translateAttention("NO_SHOW", language)}</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-64">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{language === "en" ? "Search fields" : "ช่องค้นหา"}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "en" ? "Reservation #, Guest, Unit..." : "รหัสใบจอง, ลูกค้า, ห้อง..."}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none w-full"
            />
          </div>
        </div>

        <div className="flex gap-4 border-t border-slate-100 dark:border-slate-700/50 pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{language === "en" ? "Check-in from" : "เช็คอินเริ่มต้น"}</span>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="p-1 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none text-xs"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">{language === "en" ? "Check-in to" : "เช็คอินสิ้นสุด"}</span>
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
      ) : reservations.length === 0 ? (
        <EmptyState message={language === "en" ? "No stay reservations matched filters" : "ไม่พบประวัติรายการจองห้องพัก"} />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === "en" ? "Res Number" : "รหัสใบจอง"}</th>
                  <th className="p-4">{language === "en" ? "Type" : "ประเภท"}</th>
                  <th className="p-4">{language === "en" ? "Room & Property" : "ห้องชุด / โครงการ"}</th>
                  <th className="p-4">{language === "en" ? "Check-in Date" : "วันที่เช็คอิน"}</th>
                  <th className="p-4">{language === "en" ? "Check-out Date" : "วันที่เช็คเอาท์"}</th>
                  <th className="p-4">{language === "en" ? "Billing Basis" : "เกณฑ์คำนวณเงิน"}</th>
                  <th className="p-4">{language === "en" ? "Approved Total" : "ยอดที่อนุมัติ"}</th>
                  <th className="p-4">{language === "en" ? "Attention" : "ความสำคัญ"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "ดำเนินการ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {reservations.map((r) => {
                  const propName = r.property
                    ? language === "en" ? r.property.property_name_en || r.property.property_name_th : r.property.property_name_th
                    : "-";
                  const attention = deriveReservationAttention(r);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {r.reservation_number}
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {translateReservationType(r.reservation_type, language)}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          Unit {r.unit?.unit_number || "-"}
                        </div>
                        <span className="text-xs text-slate-400">{propName}</span>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {formatDate(r.check_in_at, language)}
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {formatDate(r.check_out_at, language)}
                      </td>
                      <td className="p-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {translateBillingBasis(r.billing_basis, language)}
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {r.approved_total_amount || 0} {r.currency}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                          attention === "PENDING_CONFIRMATION"
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300 animate-pulse"
                            : attention === "UPCOMING_CHECK_IN"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : attention === "CURRENTLY_IN_HOUSE"
                            ? "bg-green-100 text-green-800"
                            : attention === "CANCELLED"
                            ? "bg-slate-100 text-slate-400"
                            : "bg-slate-50 text-slate-400"
                        }`}>
                          {translateAttention(attention, language)}
                        </span>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openReservationDetails(r)}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-300 transition"
                        >
                          {language === "en" ? "Review Stay & Extensions" : "ตรวจสอบและขอต่อสัญญา"}
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

      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <form
            onSubmit={handleCreateReservation}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4"
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
                {language === "en" ? "New Stay Booking" : "สร้างใบจองห้องพัก ( Stay Booking )"}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex flex-col gap-1 col-span-2">
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

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Unit / Room" : "ห้องชุด"}</label>
                <select
                  value={newUnitId}
                  onChange={(e) => setNewUnitId(e.target.value)}
                  required
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="">{language === "en" ? "-- SELECT ROOM --" : "-- เลือกห้องชุด --"}</option>
                  {filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Reservation Type" : "ประเภทการพัก"}</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ReservationType)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full"
                >
                  <option value="RENTAL_GUEST">{translateReservationType("RENTAL_GUEST", language)}</option>
                  <option value="OWNER_STAY">{translateReservationType("OWNER_STAY", language)}</option>
                  <option value="MANAGEMENT_USE">{translateReservationType("MANAGEMENT_USE", language)}</option>
                  <option value="OTHER">{translateReservationType("OTHER", language)}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Billing Basis" : "เกณฑ์คำนวณค่าเช่า"}</label>
                <select
                  value={newBasis}
                  onChange={(e) => setNewBasis(e.target.value as BillingBasis)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full font-bold"
                >
                  <option value="MONTHLY">{translateBillingBasis("MONTHLY", language)}</option>
                  <option value="DAILY">{translateBillingBasis("DAILY", language)}</option>
                  <option value="CUSTOM">{translateBillingBasis("CUSTOM", language)}</option>
                </select>
              </div>

              <LocalizedDatePicker
                value={newCheckInDate}
                onChange={setNewCheckInDate}
                required
                locale={language}
                label={language === "en" ? "Planned Check-in Date" : "วันที่เข้าพัก (Check-in)"}
              />

              <LocalizedDatePicker
                value={newCheckOutDate}
                onChange={setNewCheckOutDate}
                required
                locale={language}
                label={language === "en" ? "Planned Check-out Date" : "วันที่สิ้นสุด (Check-out)"}
              />

              {availabilityMessage && (
                <div className={`col-span-2 p-2 rounded text-xs font-semibold ${isAvailable ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {availabilityChecking ? "Checking unit calendar..." : availabilityMessage}
                </div>
              )}

              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Primary Guest Profile" : "ลูกค้าผู้พักหลัก (บุคคล)"}</label>
                <select
                  value={newCustId}
                  onChange={(e) => setNewCustId(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full"
                >
                  <option value="">{language === "en" ? "-- EXTERNAL GUEST / NEW RENTAL --" : "-- ลูกค้านอก / ยังไม่ลงทะเบียนบุคคล --"}</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || `${p.first_name} ${p.last_name || ""}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Adult Count" : "จำนวนผู้ใหญ่"}</label>
                <input
                  type="number"
                  value={newAdults}
                  onChange={(e) => setNewAdults(e.target.value)}
                  min="0"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Child Count" : "จำนวนเด็ก"}</label>
                <input
                  type="number"
                  value={newChildren}
                  onChange={(e) => setNewChildren(e.target.value)}
                  min="0"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                />
              </div>

              {(newBasis === "MONTHLY" || newBasis === "CUSTOM") && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Monthly Rental Rate" : "อัตราค่าเช่ารายเดือน"}</label>
                  <input
                    type="number"
                    value={newMonthlyRate}
                    onChange={(e) => setNewMonthlyRate(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none font-bold"
                    placeholder="e.g. 15000"
                  />
                </div>
              )}
              {(newBasis === "DAILY" || newBasis === "CUSTOM") && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Daily Extension Rate" : "อัตรารายวัน"}</label>
                  <input
                    type="number"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none font-bold"
                    placeholder="e.g. 600"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Base Rental Amount" : "ราคารวมตั้งต้น"}</label>
                <input
                  type="number"
                  value={newBaseAmount}
                  disabled
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-100 outline-none font-bold text-slate-700"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Discount (THB)" : "ส่วนลด"}</label>
                <input
                  type="number"
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                  placeholder="e.g. 500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Deposit (THB)" : "เงินมัดจำ"}</label>
                <input
                  type="number"
                  value={newDeposit}
                  onChange={(e) => setNewDeposit(e.target.value)}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                  placeholder="e.g. 1000"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Calculated Total" : "ยอดคำนวณ"}</label>
                <input
                  type="number"
                  value={newCalcTotal}
                  disabled
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-slate-100 outline-none font-bold text-slate-700"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Approved Total" : "ยอดที่อนุมัติจริง"}</label>
                <input
                  type="number"
                  value={newApprovedTotal}
                  onChange={(e) => setNewApprovedTotal(e.target.value)}
                  className="p-2 border border-[#D4AF37] dark:border-[#D4AF37] rounded-lg text-xs dark:bg-slate-900 outline-none font-bold"
                />
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Booking Channel & Partner Ref" : "ช่องทางขาย & รหัสอ้างอิงระบบภายนอก"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="e.g. Airbnb / Direct"
                  />
                  <input
                    type="text"
                    value={newExtRef}
                    onChange={(e) => setNewExtRef(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                    placeholder="e.g. #REF-9988"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Guest Notes" : "หมายเหตุของแขก"}</label>
                <textarea
                  value={newGuestNote}
                  onChange={(e) => setNewGuestNote(e.target.value)}
                  rows={2}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Internal Admin Notes" : "หมายเหตุแอดมิน (บันทึกภายใน)"}</label>
                <textarea
                  value={newInternalNote}
                  onChange={(e) => setNewInternalNote(e.target.value)}
                  rows={2}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold py-2.5 rounded-lg transition mt-2 shadow-md shadow-[#D4AF37]/10"
            >
              {language === "en" ? "Save Reservation" : "บันทึกข้อมูลการจองห้องพัก"}
            </button>
          </form>
        </div>
      )}

      {selectedRes && (
        <div
          onClick={() => setSelectedRes(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4"
          >
            <button
              onClick={() => setSelectedRes(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Rental Stay Record" : "ข้อมูลรายละเอียดผู้เช่า"}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Res Reference: {selectedRes.reservation_number}
              </p>
            </div>

            {isEditing ? (
              <form onSubmit={handleEditReservation} className="border-t border-b border-slate-100 dark:border-slate-700 py-3 space-y-3 text-xs">
                <span className="font-bold text-[#D4AF37]">{language === "en" ? "Edit Stay Details" : "แก้ไขข้อมูลรายละเอียดการจอง"}</span>
                <div className="grid grid-cols-2 gap-2">
                  <LocalizedDatePicker
                    value={editCheckInDate}
                    onChange={setEditCheckInDate}
                    required
                    locale={language}
                    label={language === "en" ? "Check-in Date" : "วันที่เข้าพัก"}
                  />
                  <LocalizedDatePicker
                    value={editCheckOutDate}
                    onChange={setEditCheckOutDate}
                    required
                    locale={language}
                    label={language === "en" ? "Check-out Date" : "วันที่ออกสัญญา"}
                  />
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Room / Unit" : "ห้องชุด"}</label>
                    <select
                      value={editUnitId}
                      onChange={(e) => setEditUnitId(e.target.value)}
                      required
                      className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none w-full"
                    >
                      {filteredUnits.map((u) => (
                        <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
                      ))}
                    </select>
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
              <div className="border-t border-b border-slate-100 dark:border-slate-700 py-3 space-y-2.5 text-xs">
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Stay Type / Basis" : "ประเภทและเกณฑ์คำนวณ"}:</span>
                  <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">
                    {translateReservationType(selectedRes.reservation_type, language)} ({translateBillingBasis(selectedRes.billing_basis, language)})
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Room & Project" : "ห้องชุด / โครงการ"}:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200 font-semibold">
                    Unit {selectedRes.unit?.unit_number} (
                    {selectedRes.property
                      ? language === "en" ? selectedRes.property.property_name_en || selectedRes.property.property_name_th : selectedRes.property.property_name_th
                      : "-"}
                    )
                  </span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Primary Guest" : "ชื่อผู้เช่าหลัก"}:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {selectedRes.primary_guest
                      ? selectedRes.primary_guest.display_name || `${selectedRes.primary_guest.first_name} ${selectedRes.primary_guest.last_name || ""}`
                      : (language === "en" ? "External rental stay" : "ลูกค้านอกทั่วไป")}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center">
                  <span className="text-slate-400 font-bold">{language === "en" ? "Stay Dates" : "วันเริ่มและวันสิ้นสุดสัญญา"}:</span>
                  <div className="col-span-2 flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-850 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-1 rounded">
                      In: {formatDate(selectedRes.check_in_at, language)} <br />
                      Out: {formatDate(selectedRes.check_out_at, language)}
                    </span>
                    {["DRAFT", "PENDING_CONFIRMATION", "CONFIRMED"].includes(selectedRes.status) && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border"
                      >
                        {language === "en" ? "Edit Dates" : "แก้ไขเวลา/ห้อง"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3">
                  <span className="text-slate-400">{language === "en" ? "Stay Status" : "สถานะสัญญา"}:</span>
                  <span className="col-span-2 font-bold uppercase">{translateReservationStatus(selectedRes.status, language)}</span>
                </div>

                <div className="bg-[#D4AF37]/5 dark:bg-[#D4AF37]/10 p-2.5 rounded border border-[#D4AF37]/20 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">{language === "en" ? "Monthly Rate" : "อัตราค่าเช่ารายเดือน"}:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-350">{selectedRes.monthly_rate || 0} {selectedRes.currency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{language === "en" ? "Daily Rate" : "อัตรารายวัน"}:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-350">{selectedRes.daily_rate || 0} {selectedRes.currency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{language === "en" ? "Base / Extensions" : "รวมตั้งต้น / ส่วนต่อขยาย"}:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-350">
                      {selectedRes.base_rental_amount || 0} / +{selectedRes.extension_amount || 0} {selectedRes.currency}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{language === "en" ? "Discount / Deposit" : "ส่วนลด / มัดจำ"}:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-350">
                      -{selectedRes.discount_amount || 0} / {selectedRes.deposit_amount || 0} {selectedRes.currency}
                    </span>
                  </div>
                  <div className="col-span-2 border-t border-[#D4AF37]/10 pt-1.5 flex justify-between">
                    <span className="font-bold text-slate-500">{language === "en" ? "Approved Total" : "ยอดรวมที่อนุมัติจริง"}:</span>
                    <span className="font-mono font-bold text-[#D4AF37]">{selectedRes.approved_total_amount || 0} {selectedRes.currency}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {selectedRes.status === "PENDING_CONFIRMATION" && (
                <button
                  onClick={() => handleUpdateStatus(selectedRes.id, "CONFIRMED")}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded font-bold"
                >
                  {language === "en" ? "Confirm Reservation" : "ยืนยันสัญญาเช่า"}
                </button>
              )}
              {selectedRes.status === "CONFIRMED" && (
                <button
                  onClick={() => handleUpdateStatus(selectedRes.id, "CHECKED_IN")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                >
                  {language === "en" ? "Check-In Guest" : "เช็คอินเข้าห้องพัก"}
                </button>
              )}
              {selectedRes.status === "CHECKED_IN" && (
                <button
                  onClick={() => handleUpdateStatus(selectedRes.id, "CHECKED_OUT")}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-bold"
                >
                  {language === "en" ? "Check-Out Guest" : "เช็คเอาท์สัญญา"}
                </button>
              )}
              {["PENDING_CONFIRMATION", "CONFIRMED"].includes(selectedRes.status) && (
                <button
                  onClick={() => handleCancelReservation(selectedRes.id)}
                  className="px-3 py-1.5 bg-red-650 hover:bg-red-755 text-white rounded font-bold"
                >
                  {language === "en" ? "Cancel Stay" : "ยกเลิกสัญญา"}
                </button>
              )}
            </div>

            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
              <span className="text-xs font-bold text-slate-500 block">
                📋 {language === "en" ? "Checkout Extensions & Stay History" : "ประวัติการขยายเวลาพักและต่อสัญญา"}
              </span>
              {selectedExtensions.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {selectedExtensions.map((ext) => (
                    <div key={ext.id} className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 rounded space-y-1 text-xs">
                      <div className="flex justify-between font-mono text-[10px] text-slate-400">
                        <span>Submitted: {formatDate(ext.created_at, language)}</span>
                        <span className={`font-bold ${ext.status === "APPROVED" ? "text-green-600" : ext.status === "REJECTED" ? "text-red-600" : "text-yellow-600"}`}>
                          {ext.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>New Checkout: <strong>{formatDate(ext.requested_check_out_at, language)}</strong></span>
                        <span>Approved: <strong>{ext.approved_amount || 0} THB</strong></span>
                      </div>
                      <div className="text-[10px] text-slate-500 italic">Method: {translateExtensionPricing(ext.pricing_method, language)} | Reason: {ext.reason || "-"}</div>
                      {ext.status === "PENDING_APPROVAL" && (
                        <button
                          onClick={() => {
                            setActiveExtForApproval(ext);
                            setApprovalInputAmount((ext.approved_amount || ext.calculated_amount || 0).toString());
                          }}
                          className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-[10px] font-bold py-0.5 rounded transition mt-1"
                        >
                          {language === "en" ? "Approve Stay Extension" : "อนุมัติขยายเวลาระยะพักนี้"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic block">{language === "en" ? "No extension history" : "ไม่มีประวัติการต่ออายุ"}</span>
              )}
            </div>

            {selectedRes.status === "CHECKED_IN" && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 rounded-xl space-y-3">
                <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block">
                  🔄 {language === "en" ? "Request Checkout Stay Extension" : "ยื่นคำขอต่อสัญญา / ขยายเวลาพัก"}
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <LocalizedDatePicker
                    value={extDate}
                    onChange={setExtDate}
                    required
                    locale={language}
                    label={language === "en" ? "New Checkout Date" : "วันเช็คเอาท์ใหม่"}
                  />

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Extension Pricing" : "ราคาต่อขยาย"}</label>
                    <select
                      value={extMethod}
                      onChange={(e) => setExtMethod(e.target.value as PricingMethod)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none"
                    >
                      <option value="HALF_MONTH">{translateExtensionPricing("HALF_MONTH", language)}</option>
                      <option value="FULL_MONTH">{translateExtensionPricing("FULL_MONTH", language)}</option>
                      <option value="DAILY_PRORATE">{translateExtensionPricing("DAILY_PRORATE", language)}</option>
                      <option value="CUSTOM">{translateExtensionPricing("CUSTOM", language)}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Calculated recommended" : "ยอดคำนวณตั้งต้น"}</label>
                    <input
                      type="number"
                      value={extCalcAmount}
                      disabled
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-100 text-xs font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Proposed Amount" : "ยอดเสนอชำระ"}</label>
                    <input
                      type="number"
                      value={extApprovedAmount}
                      onChange={(e) => setExtApprovedAmount(e.target.value)}
                      className="p-1.5 border border-[#D4AF37] rounded dark:bg-slate-900 text-xs font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Override Reason / Description" : "เหตุผลการลดหย่อน / หมายเหตุ"}</label>
                    <input
                      type="text"
                      value={extReason}
                      onChange={(e) => setExtReason(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none"
                      placeholder="e.g. Approved extension for academic studies"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRequestExtension(selectedRes.id)}
                  className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold py-1.5 rounded transition"
                >
                  {language === "en" ? "Submit Extension Request" : "บันทึกและส่งขยายเวลาสัญญา"}
                </button>
              </div>
            )}

            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700 pt-3">
              <span className="text-xs font-bold text-slate-500 block">
                🛠 {language === "en" ? "Associated Work Orders" : "รายการใบงานปฏิบัติที่ผูกกับการจอง"}
              </span>
              {selectedRes.work_orders && selectedRes.work_orders.length > 0 ? (
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {selectedRes.work_orders.map((w) => (
                    <div key={w.id} className="p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 rounded flex justify-between items-center text-[11px]">
                      <span className="font-mono text-slate-600 dark:text-slate-400">{w.work_order_code}</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-200 truncate max-w-40">{w.title}</span>
                      <span className="px-1.5 rounded text-[9px] bg-slate-200 font-bold">{w.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic block">{language === "en" ? "No linked operational work orders" : "ยังไม่มีการออกใบสั่งงานปฏิบัติสำหรับรายนี้"}</span>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3 font-sans">
              <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block">
                ➕ {language === "en" ? "Create Work Order from Reservation" : "ออกใบงานปฏิบัติการจากการจองห้องพัก"}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDispatchTitle("Pre-Arrival Room Preparation");
                    setDispatchDesc("Perform full turnover check and clean up unit prior to guest check-in.");
                    setDispatchCategory("Cleaning");
                    setDispatchTeam("HOUSEKEEPING");
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold"
                >
                  PRE-ARRIVAL CLEANING
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDispatchTitle("Checkout Turnover Turnover");
                    setDispatchDesc("Guest is checked out. Perform deep cleaning and check for guest items.");
                    setDispatchCategory("Cleaning");
                    setDispatchTeam("HOUSEKEEPING");
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold"
                >
                  CHECKOUT TURNOVER
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDispatchTitle("In-Stay Maintenance Service Check");
                    setDispatchDesc("Air conditioner check or unit inspection service during stay.");
                    setDispatchCategory("Maintenance");
                    setDispatchTeam("TECHNICIAN");
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold"
                >
                  IN-STAY MAINTENANCE
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Work Title" : "หัวข้อสั่งงาน"}</label>
                  <input
                    type="text"
                    value={dispatchTitle}
                    onChange={(e) => setDispatchTitle(e.target.value)}
                    placeholder="e.g. Clean room check-in preparation"
                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none w-full"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Description" : "รายละเอียดสั่งงาน"}</label>
                  <textarea
                    value={dispatchDesc}
                    onChange={(e) => setDispatchDesc(e.target.value)}
                    rows={2}
                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Service Category" : "ประเภทงาน"}</label>
                    <select
                      value={dispatchCategory}
                      onChange={(e) => setDispatchCategory(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none w-full"
                    >
                      <option value="Cleaning">Cleaning</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Repair">Repair</option>
                      <option value="Inspection">Inspection</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Priority" : "ความสำคัญ"}</label>
                    <select
                      value={dispatchPriority}
                      onChange={(e) => setDispatchPriority(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none w-full"
                    >
                      <option value="LOW">LOW</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 bg-[#D4AF37]/5 rounded border border-[#D4AF37]/10">
                  <LocalizedDatePicker
                    value={dispatchDate}
                    onChange={setDispatchDate}
                    required
                    locale={language}
                    label={language === "en" ? "Work Schedule Date" : "วันนัดหมายปฏิบัติงาน"}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#D4AF37] uppercase">{language === "en" ? "Work Schedule Time" : "เวลานัดหมายปฏิบัติงาน"}</label>
                    <input
                      type="time"
                      required
                      value={dispatchTime}
                      onChange={(e) => setDispatchTime(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none font-semibold text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Service Team" : "ทีมทำงาน"}</label>
                    <select
                      value={dispatchTeam}
                      onChange={(e) => {
                        setDispatchTeam(e.target.value as "TECHNICIAN" | "HOUSEKEEPING");
                        setDispatchAssignee("");
                      }}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 outline-none"
                    >
                      <option value="TECHNICIAN">TECHNICIAN</option>
                      <option value="HOUSEKEEPING">HOUSEKEEPING</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Assign Staff" : "มอบหมายงานให้บุคคล"}</label>
                    <select
                      value={dispatchAssignee}
                      onChange={(e) => setDispatchAssignee(e.target.value)}
                      className="p-1.5 border border-slate-200 dark:border-slate-700 rounded dark:bg-slate-900 text-xs outline-none text-slate-800 dark:text-slate-255"
                    >
                      <option value="">{language === "en" ? "-- Unassigned --" : "-- ยังไม่มอบหมายบุคคล --"}</option>
                      {filteredWorkers.map((w) => (
                        <option key={w.id} value={w.id}>{w.full_name || w.display_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDispatchWorkOrder(selectedRes.id)}
                  className="w-full bg-[#D4AF37] hover:bg-[#b8952b] text-white text-xs font-bold py-2 rounded transition mt-2 shadow"
                >
                  {language === "en" ? "Create Work Order (Dispatch)" : "บันทึกมอบหมายงานปฏิบัติการ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeExtForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {language === "en" ? "Approve Checkout Stay Extension" : "อนุมัติขยายเวลารายการพักห้องชุด"}
            </h4>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block">{language === "en" ? "New Checkout Target" : "วันเช็คเอาท์ปลายทาง"}:</span>
                <span className="font-bold font-mono">{formatDate(activeExtForApproval.requested_check_out_at, language)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{language === "en" ? "Calculated recommended amount" : "ยอดส่วนขยายที่ระบบเสนอ"}:</span>
                <span className="font-bold font-mono text-slate-600">{activeExtForApproval.calculated_amount || 0} THB</span>
              </div>
              <div className="flex flex-col gap-1 pt-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{language === "en" ? "Approved Pricing Amount" : "จำนวนเงินอนุมัติเก็บเงินจริง"}</label>
                <input
                  type="number"
                  value={approvalInputAmount}
                  onChange={(e) => setApprovalInputAmount(e.target.value)}
                  className="p-2 border border-[#D4AF37] rounded dark:bg-slate-900 font-bold font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleApproveExtension(activeExtForApproval.reservation_id, activeExtForApproval.id)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 rounded transition"
              >
                {language === "en" ? "Approve & Apply" : "อนุมัติและปรับปรุงห้อง"}
              </button>
              <button
                onClick={() => setActiveExtForApproval(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-355 text-slate-800 text-xs font-bold rounded transition"
              >
                {language === "en" ? "Cancel" : "ยกเลิก"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
