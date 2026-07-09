/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, LoadingState, LocalizedDatePicker } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import {
  MeterReading,
  UtilityControlType,
  MeterReadingCycle,
  UtilityMeter,
  UtilityRate
} from "@/features/reservation/types/stay.types";
import * as XLSX from "xlsx";
import { compareUnitNumbers } from "@/shared/utils/unit";

interface PropertyOption {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

interface UnitOption {
  id: string;
  unit_number: string;
  water_control_status: UtilityControlType;
  electricity_control_status: UtilityControlType;
}

interface ImportPreviewRow {
  source_row: number;
  reading_id: string;
  room_number: string;
  meter_number: string;
  utility_type: string;
  previous_reading: number;
  current_reading: number | null;
  usage: number | null;
  technician_note: string;
  validationStatus: "VALID" | "WARNING" | "DUPLICATE" | "ERROR";
  validationMessage: string;
}

interface MeterPreviewRow {
  source_row: number;
  room_number: string;
  utility_type: string;
  meter_classification: string;
  manufacturer_serial_number: string | null;
  installed_date: string | null;
  initial_reading: number;
  note: string | null;
  validationStatus: "VALID" | "ERROR";
  validationMessage: string;
  generated_code: string;
}

interface MeterImportResult {
  success: boolean;
  message?: string;
  created?: number;
  total?: number;
  imported?: number;
}


const supabase = createClient();

export default function MeterManagementPage() {
  const { language } = useLanguage();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [cycles, setCycles] = useState<MeterReadingCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("ALL");
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "overview" | "cycles" | "review" | "excel" | "registry" | "rates" | "control"
  >("overview");

  // Overview Stats state
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    review: 0,
    approved: 0,
    anomalies: 0,
  });

  // Cycle Creation modal/form
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [cycleType, setCycleType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [cycleCode, setCycleCode] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [billingMonth, setBillingMonth] = useState(""); // YYYY-MM
  const [cycleStartDate, setCycleStartDate] = useState("");
  const [cycleDueDate, setCycleDueDate] = useState("");
  const [cycleFormError, setCycleFormError] = useState<string | null>(null);

  // Cycle Editing modal/form
  const [selectedCycleForEdit, setSelectedCycleForEdit] = useState<MeterReadingCycle | null>(null);
  const [showEditCycleModal, setShowEditCycleModal] = useState(false);
  const [editCycleCode, setEditCycleCode] = useState("");
  const [editCycleName, setEditCycleName] = useState("");
  const [editBillingMonth, setEditBillingMonth] = useState("");
  const [editCycleStartDate, setEditCycleStartDate] = useState("");
  const [editCycleDueDate, setEditCycleDueDate] = useState("");
  const [editCycleType, setEditCycleType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [editCycleFormError, setEditCycleFormError] = useState<string | null>(null);

  // Review & History
  const [selectedReadingForReturn, setSelectedReadingForReturn] = useState<MeterReading | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReadingIds, setSelectedReadingIds] = useState<string[]>([]);
  const [isBatchReturn, setIsBatchReturn] = useState(false);

  // Rates tab state
  const [rates, setRates] = useState<UtilityRate[]>([]);
  const [rateType, setRateType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [rateFromDate, setRateFromDate] = useState("");
  const [rateToDate, setRateToDate] = useState("");
  const [rateFormError, setRateFormError] = useState<string | null>(null);

  // Registry & Replacements state
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [meters, setMeters] = useState<UtilityMeter[]>([]);
  const [selectedMeterForReplace, setSelectedMeterForReplace] = useState<UtilityMeter | null>(null);
  const [startingReading, setStartingReading] = useState("");
  const [finalReading, setFinalReading] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [replaceFormError, setReplaceFormError] = useState<string | null>(null);
  const [replacementManufacturerSerial, setReplacementManufacturerSerial] = useState("");
  const [replacementDate, setReplacementDate] = useState("");

  // Meter Creation state
  const [showCreateMeterModal, setShowCreateMeterModal] = useState(false);
  const [newMeterUnitId, setNewMeterUnitId] = useState("");
  const [newMeterType, setNewMeterType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [newMeterInitialReading, setNewMeterInitialReading] = useState("");
  const [createMeterFormError, setCreateMeterFormError] = useState<string | null>(null);
  const [newMeterClassification, setNewMeterClassification] = useState<"LEGACY" | "NEW">("LEGACY");
  const [newMeterManufacturerSerial, setNewMeterManufacturerSerial] = useState("");
  const [newMeterInstalledAt, setNewMeterInstalledAt] = useState("");
  const [newMeterNote, setNewMeterNote] = useState("");

  // Meter Coverage info panel (replaces synthetic bootstrap modal)
  const [showCoverageInfoPanel, setShowCoverageInfoPanel] = useState(false);

  // Control Status tab
  const [selectedUnitForControl, setSelectedUnitForControl] = useState<UnitOption | null>(null);
  const [controlType, setControlType] = useState<"WATER" | "ELECTRICITY">("WATER");
  const [newControlStatus, setNewControlStatus] = useState<UtilityControlType>("NORMAL");
  const [controlReason, setControlReason] = useState("");

  // Excel Upload state
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [excelFilter, setExcelFilter] = useState<"ALL" | "VALID" | "WARNING" | "DUPLICATE" | "ERROR">("ALL");
  const [excelFileName, setExcelFileName] = useState<string>("");
  const [excelFileSize, setExcelFileSize] = useState<string>("");
  const [excelParseStatus, setExcelParseStatus] = useState<"IDLE" | "PARSING" | "SUCCESS" | "ERROR">("IDLE");
  const [excelError, setExcelError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    total: number;
    imported: number;
    warnings: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  // Meter Registration Excel Import state
  const [excelSubMode, setExcelSubMode] = useState<"readings" | "meters">("readings");
  const [meterPreviewRows, setMeterPreviewRows] = useState<MeterPreviewRow[]>([]);
  const [meterExcelFileName, setMeterExcelFileName] = useState("");
  const [meterExcelFileSize, setMeterExcelFileSize] = useState("");
  const [meterExcelParseStatus, setMeterExcelParseStatus] = useState<"IDLE" | "PARSING" | "SUCCESS" | "ERROR">("IDLE");
  const [meterExcelError, setMeterExcelError] = useState<string | null>(null);
  const [meterImportResult, setMeterImportResult] = useState<MeterImportResult | null>(null);
  const [meterImporting, setMeterImporting] = useState(false);
  const [meterExcelFilter, setMeterExcelFilter] = useState<"ALL" | "VALID" | "ERROR">("ALL");


  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response received:", text);
        return { success: false, message: `Server error (${res.status}): Received invalid format` };
      }
      return await res.json();
    } catch (err) {
      console.error("Fetch failed:", err);
      return { success: false, message: "Network connection error. Please try again." };
    }
  };

  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, property_id")
          .eq("id", user.id)
          .single();

        if (profile) {
          setRole(profile.role);
          
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initPage();
  }, []);

  const fetchCycles = React.useCallback(async () => {
    if (!selectedProperty) return;
    setFetchError(null);
    const json = await safeFetchJson(`/api/v1/meter-cycles?property_id=${selectedProperty}`);
    if (json.success) {
      setCycles(json.data || []);
    } else {
      console.error(json.message);
    }
  }, [selectedProperty]);

  const fetchReadings = React.useCallback(async () => {
    if (!selectedProperty) return;
    setFetchError(null);
    let url = `/api/v1/meter-readings?property_id=${selectedProperty}`;
    if (selectedCycle !== "ALL") {
      url += `&cycle_id=${selectedCycle}`;
    }
    const json = await safeFetchJson(url);
    if (json.success) {
      const data = json.data || [];
      setReadings(data);
      
      // Calculate overview stats
      const reviewList = data.filter((r: MeterReading) => r.status === "REVIEW");
      const pendingList = data.filter((r: MeterReading) => r.status === "PENDING" || r.status === "REJECTED");
      const approvedList = data.filter((r: MeterReading) => r.status === "APPROVED");
      const anomalyList = data.filter((r: MeterReading) => r.anomaly_status !== "NORMAL");
      
      setStats({
        total: data.length,
        pending: pendingList.length,
        review: reviewList.length,
        approved: approvedList.length,
        anomalies: anomalyList.length,
      });
    } else {
      if (json.code === "UTILITY_INFRASTRUCTURE_NOT_READY" || (json.message && json.message.includes("not ready"))) {
        setFetchError(language === "en" ? "Meter infrastructure is not ready." : "ระบบมิเตอร์และสาธารณูปโภคยังไม่พร้อมใช้งาน");
      } else {
        console.error(json.message);
      }
    }
  }, [selectedProperty, selectedCycle, language]);

  const fetchRates = React.useCallback(async () => {
    if (!selectedProperty) return;
    const json = await safeFetchJson(`/api/v1/utility-rates?property_id=${selectedProperty}`);
    if (json.success) {
      setRates(json.data || []);
    } else {
      console.error(json.message);
    }
  }, [selectedProperty]);

  const fetchRegistry = React.useCallback(async () => {
    if (!selectedProperty) return;
    try {
      const { data: unitList } = await supabase
        .from("units")
        .select("id, unit_number, water_control_status, electricity_control_status")
        .eq("property_id", selectedProperty)
        .order("unit_number", { ascending: true });
      if (unitList) setUnits(unitList as UnitOption[]);

      const { data: meterList } = await supabase
        .from("utility_meters")
        .select("*, unit:units ( id, unit_number )")
        .eq("property_id", selectedProperty);
      if (meterList) setMeters(meterList as unknown as UtilityMeter[]);
    } catch (err) {
      console.error(err);
    }
  }, [selectedProperty]);

  useEffect(() => {
    if (selectedProperty) {
      fetchCycles();
      fetchReadings();
      if (activeTab === "rates") {
        fetchRates();
      }
      if (activeTab === "registry" || activeTab === "control") {
        fetchRegistry();
      }
    }
  }, [selectedProperty, selectedCycle, activeTab, fetchCycles, fetchReadings, fetchRates, fetchRegistry]);

  // Format date helper with Thai Buddhist Era option
  const formatThaiDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear() + (language === "th" ? 543 : 0);
    const monthsTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mLabel = language === "th" ? monthsTh[month] : monthsEn[month];
    return `${day} ${mLabel} ${year}`;
  };

  const translateControlStatus = (status: UtilityControlType) => {
    switch (status) {
      case "NORMAL": return language === "en" ? "Normal" : "ปกติ";
      case "SHUTOFF_REQUESTED": return language === "en" ? "Shutoff Requested" : "แจ้งปิด";
      case "SHUT_OFF": return language === "en" ? "Shut Off" : "ปิดบริการแล้ว";
      case "RECONNECT_REQUESTED": return language === "en" ? "Reconnect Requested" : "แจ้งเปิด";
      case "RESTRICTED_NO_RECONNECT": return language === "en" ? "Restricted: Do Not Reconnect" : "ห้ามเปิดโดยไม่ได้รับอนุมัติ";
      default: return status;
    }
  };


  // Cycle open operation
  const handleOpenCycle = async (cycleId: string) => {
    if (!confirm(language === "en" ? "Open this cycle and generate reading tasks?" : "ยืนยันการเปิดรอบจดมิเตอร์และสร้างงานจดมิเตอร์ห้องพัก?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/meter-cycles/${cycleId}/open`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        fetchCycles();
        fetchReadings();
        if (json.summary) {
          const { meters_found, readings_created, rooms_without_meter } = json.summary;
          const msg = language === "en"
            ? `Cycle opened successfully!\n\n- Active Meters Found: ${meters_found}\n- Reading Tasks Created: ${readings_created}\n- Rooms Without Meter: ${rooms_without_meter}`
            : `เปิดรอบจดมิเตอร์สำเร็จ!\n\n- จำนวนมิเตอร์ที่พบ: ${meters_found} เครื่อง\n- จำนวนรายการจดที่สร้าง: ${readings_created} รายการ\n- จำนวนห้องชุดที่ยังไม่มีมิเตอร์: ${rooms_without_meter} ห้อง`;
          alert(msg);
        } else {
          alert(language === "en" ? "Cycle opened successfully!" : "เปิดรอบจดมิเตอร์สำเร็จ!");
        }
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cycle creation submission
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setCycleFormError(null);
    if (!cycleCode || !cycleName || !billingMonth || !cycleStartDate || !cycleDueDate) {
      setCycleFormError(language === "en" ? "Please fill all fields" : "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    try {
      const res = await fetch("/api/v1/meter-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedProperty,
          utility_type: cycleType,
          cycle_code: cycleCode,
          cycle_name: cycleName,
          billing_month: billingMonth,
          reading_start_date: cycleStartDate,
          reading_due_date: cycleDueDate
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateCycleModal(false);
        setCycleCode("");
        setCycleName("");
        setBillingMonth("");
        setCycleStartDate("");
        setCycleDueDate("");
        fetchCycles();
      } else {
        setCycleFormError(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditCycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditCycleFormError(null);
    if (!selectedCycleForEdit) return;

    try {
      // Only send fields that actually changed to avoid 400 from API rejecting immutable fields
      const updates: Record<string, unknown> = {};
      if (editCycleCode !== selectedCycleForEdit.cycle_code) updates.cycle_code = editCycleCode;
      if (editCycleName !== selectedCycleForEdit.cycle_name) updates.cycle_name = editCycleName;
      if (editBillingMonth !== selectedCycleForEdit.billing_month) updates.billing_month = editBillingMonth;
      if (editCycleStartDate !== selectedCycleForEdit.reading_start_date) updates.reading_start_date = editCycleStartDate;
      if (editCycleDueDate !== selectedCycleForEdit.reading_due_date) updates.reading_due_date = editCycleDueDate;
      if (editCycleType !== selectedCycleForEdit.utility_type) updates.utility_type = editCycleType;

      if (Object.keys(updates).length === 0) {
        setShowEditCycleModal(false);
        setSelectedCycleForEdit(null);
        return;
      }

      const res = await fetch(`/api/v1/meter-cycles/${selectedCycleForEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });

      const json = await res.json();
      if (json.success) {
        setShowEditCycleModal(false);
        setSelectedCycleForEdit(null);
        fetchCycles();
        fetchReadings();
      } else {
        setEditCycleFormError(json.message);
      }
    } catch (err) {
      console.error(err);
      setEditCycleFormError(language === "en" ? "Failed to edit cycle" : "เกิดข้อผิดพลาดในการแก้ไขรอบจดมิเตอร์");
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    const msg = language === "en"
      ? "Are you sure you want to delete this reading cycle?\nThis action is irreversible and will delete all associated blank reading records."
      : "คุณกำลังจะลบรอบจดมิเตอร์นี้\nการดำเนินการนี้ไม่สามารถย้อนกลับได้ และจะลบรายการจดมิเตอร์เปล่าทั้งหมดที่เกี่ยวข้อง";
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/v1/meter-cycles/${cycleId}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Cycle deleted successfully" : "ลบรอบจดมิเตอร์สำเร็จ");
        fetchCycles();
        fetchReadings();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
      alert(language === "en" ? "Failed to delete cycle" : "เกิดข้อผิดพลาดในการลบรอบจดมิเตอร์");
    }
  };

  const handleCancelCycle = async (cycleId: string) => {
    const msg = language === "en"
      ? "Are you sure you want to CANCEL this reading cycle?\nThis will mark it as CANCELLED and preserve its history."
      : "คุณแน่ใจหรือไม่ที่จะยกเลิกรอบจดมิเตอร์นี้?\nรอบจดมิเตอร์จะเปลี่ยนสถานะเป็น CANCELLED และประวัติการจดบันทึกจะถูกเก็บรักษาไว้";
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/v1/meter-cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" })
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "en" ? "Cycle cancelled successfully" : "ยกเลิกรอบจดมิเตอร์สำเร็จ");
        fetchCycles();
        fetchReadings();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
      alert(language === "en" ? "Failed to cancel cycle" : "เกิดข้อผิดพลาดในการยกเลิกรอบจดมิเตอร์");
    }
  };

  // Rate creation submission
  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateFormError(null);
    if (!ratePerUnit || !rateFromDate) {
      setRateFormError(language === "en" ? "Please fill required fields" : "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    try {
      const res = await fetch("/api/v1/utility-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedProperty,
          utility_type: rateType,
          rate_per_unit: Number(ratePerUnit),
          effective_from: rateFromDate,
          effective_to: rateToDate || null
        })
      });
      const json = await res.json();
      if (json.success) {
        setRatePerUnit("");
        setRateFromDate("");
        setRateToDate("");
        fetchRates();
      } else {
        setRateFormError(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // The Bootstrap workflow now requires real meter data via XLSX import.
  // No synthetic meter numbers are generated. Admins are directed to the Import tab.
  // This stub is kept for compatibility with any remaining ref but is not called by UI.


  // Meter registration submission
  const handleCreateMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMeterFormError(null);
    if (!newMeterUnitId || !newMeterInitialReading) {
      setCreateMeterFormError(language === "en" ? "Please fill all fields" : "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    if (newMeterClassification === "NEW" && !newMeterInstalledAt) {
      setCreateMeterFormError(language === "en" ? "Installed date is required for NEW meters" : "กรุณาระบุวันที่ติดตั้ง");
      return;
    }
    try {
      const res = await fetch("/api/v1/utility-meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedProperty,
          unit_id: newMeterUnitId,
          utility_type: newMeterType,
          meter_classification: newMeterClassification,
          manufacturer_serial_number: newMeterManufacturerSerial || null,
          installed_at: newMeterInstalledAt || null,
          initial_reading: Number(newMeterInitialReading),
          note: newMeterNote
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateMeterModal(false);
        setNewMeterUnitId("");
        setNewMeterManufacturerSerial("");
        setNewMeterInstalledAt("");
        setNewMeterInitialReading("");
        setNewMeterNote("");
        setNewMeterClassification("LEGACY");
        fetchRegistry();
      } else {
        setCreateMeterFormError(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Meter replacement submission
  const handleReplaceMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    setReplaceFormError(null);
    if (!selectedMeterForReplace || !startingReading || !replacementReason || !replacementDate) {
      setReplaceFormError(language === "en" ? "Please fill all fields" : "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    try {
      const res = await fetch(`/api/v1/utility-meters/${selectedMeterForReplace.id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturer_serial_number: replacementManufacturerSerial || null,
          starting_reading: Number(startingReading),
          final_reading: finalReading ? Number(finalReading) : null,
          replacement_reason: replacementReason,
          replacement_date: replacementDate
        })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedMeterForReplace(null);
        setReplacementManufacturerSerial("");
        setStartingReading("");
        setFinalReading("");
        setReplacementReason("");
        setReplacementDate("");
        fetchRegistry();
      } else {
        setReplaceFormError(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Utility control status update submission
  const handleControlStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitForControl || !controlReason) return;
    try {
      const res = await fetch(`/api/v1/units/${selectedUnitForControl.id}/utility-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utility_type: controlType,
          status: newControlStatus,
          reason: controlReason
        })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedUnitForControl(null);
        setControlReason("");
        fetchRegistry();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Approve reading
  const handleApproveReading = async (readingId: string) => {
    if (!confirm(language === "en" ? "Approve reading and sync to Stay Billing?" : "ยืนยันการอนุมัติและบันทึกค่าน้ำ/ไฟลงบัญชีห้องพัก?")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/meter-readings/${readingId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_note: "Approved by Admin" })
      });
      const json = await res.json();
      if (json.success) {
        fetchReadings();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Return reading to technician for recheck
  const handleReturnReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnNote) return;
    try {
      if (isBatchReturn) {
        for (const id of selectedReadingIds) {
          await fetch(`/api/v1/meter-readings/${id}/return`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ manager_note: returnNote })
          });
        }
        setIsBatchReturn(false);
        setSelectedReadingIds([]);
      } else {
        if (!selectedReadingForReturn) return;
        const res = await fetch(`/api/v1/meter-readings/${selectedReadingForReturn.id}/return`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manager_note: returnNote })
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.message);
        }
        setShowReturnModal(false);
        setSelectedReadingForReturn(null);
      }
      setReturnNote("");
      fetchReadings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedReadingIds.length === 0) return;
    const msg = language === "en"
      ? `Are you sure you want to approve the ${selectedReadingIds.length} selected readings?`
      : `คุณแน่ใจหรือไม่ว่าต้องการอนุมัติรายการที่เลือกทั้ง ${selectedReadingIds.length} รายการ?`;
    if (!confirm(msg)) return;

    try {
      setLoading(true);
      for (const id of selectedReadingIds) {
        await fetch(`/api/v1/meter-readings/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manager_note: "Approved in batch by Admin" })
        });
      }
      setSelectedReadingIds([]);
      fetchReadings();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Excel Export Logic
  const handleExcelExport = () => {
    if (selectedCycle === "ALL") {
      alert(language === "en" ? "Please select a specific open cycle for export." : "กรุณาเลือกหนึ่งรอบจดมิเตอร์เพื่อทำการส่งออก");
      return;
    }
    const cycleObj = cycles.find(c => c.id === selectedCycle);
    if (!cycleObj) return;

    const cycleReadings = readings.filter(r => r.cycle_id === selectedCycle);
    const exportData = cycleReadings.map(r => ({
      "Reading_ID": r.id,
      "Cycle_ID": r.cycle_id,
      "Unit_ID": r.unit_id,
      "Room_Number": r.unit?.unit_number || "",
      "Meter_ID": r.meter_id,
      "Meter_Serial_Number": r.meter?.meter_number || "",
      "Utility_Type": r.utility_type,
      "Billing_Month": cycleObj.billing_month,
      "Previous_Reading": Number(r.previous_reading),
      "Previous_Reading_Date": r.recorded_at ? r.recorded_at.split("T")[0] : "",
      "Current_Reading": r.current_reading || "",
      "Technician_Note": r.technician_note || "",
      "Control_Status": r.utility_type === "WATER" ? (r.unit?.water_control_status || "NORMAL") : (r.unit?.electricity_control_status || "NORMAL")
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Readings");
    XLSX.writeFile(wb, `IRM_Meter_Cycle_${cycleObj.cycle_code}.xlsx`);
  };

  const handleStandardExport = async () => {
    if (selectedCycle === "ALL") {
      alert(language === "en" ? "Please select a specific cycle for standard export." : "กรุณาเลือกหนึ่งรอบจดมิเตอร์เพื่อทำการส่งออก");
      return;
    }
    const cycleObj = cycles.find(c => c.id === selectedCycle);
    if (!cycleObj) return;
    const billingMonth = cycleObj.billing_month;

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/meter-readings?property_id=${selectedProperty}`);
      const json = await res.json();
      if (!json.success) {
        alert(json.message);
        return;
      }
      
      const allReadings: MeterReading[] = json.data || [];
      const billingMonthReadings = allReadings.filter(r => r.cycle?.billing_month === billingMonth);

      const unitNumbers = Array.from(new Set(billingMonthReadings.map(r => r.unit?.unit_number).filter(Boolean))) as string[];
      unitNumbers.sort(compareUnitNumbers);

      const propObj = properties.find(p => p.id === selectedProperty);
      const propName = propObj ? (propObj.property_name_th || propObj.property_name_en || "") : "";

      const parts = billingMonth.split("-");
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const thMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      const enMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const displayMonth = language === "en" 
        ? `${enMonths[monthIdx]} ${year}` 
        : `${thMonths[monthIdx]} ${year + 543}`;

      const sheetData: unknown[][] = [];
      sheetData.push([propName]);
      sheetData.push([language === "en" ? "Electricity and Water Cost Summary Table" : "ตารางสรุปค่าไฟฟ้า - ค่าน้ำประปา "]);
      sheetData.push([language === "en" ? `Billing Period: ${displayMonth}` : `ประจำเดือน   ${displayMonth}`]);
      sheetData.push([
        language === "en" ? "No." : "ลำดับ",
        language === "en" ? "Room No." : "ห้องชุดเลขที่",
        language === "en" ? "Electricity Cost" : "ค่าไฟฟ้า",
        language === "en" ? "Room No." : "ห้องชุดเลขที่",
        language === "en" ? "Water Meter (Prev)" : "มิเตอร์น้ำ (ก่อน)",
        language === "en" ? "Water Meter (Curr)" : "มิเตอร์น้ำ (หลัง)",
        language === "en" ? "Difference" : "ผลต่าง",
        language === "en" ? "Water Cost" : "ค่าน้ำประปา",
        language === "en" ? "Treatment Cost" : "บำบัด",
        language === "en" ? "Total Amount" : "รวมจำนวนเงิน"
      ]);
      sheetData.push(["", "", "", "", "", "", "", "", "", ""]);

      unitNumbers.forEach((unitNo, idx) => {
        const elec = billingMonthReadings.find(r => r.unit?.unit_number === unitNo && r.utility_type === "ELECTRICITY");
        const water = billingMonthReadings.find(r => r.unit?.unit_number === unitNo && r.utility_type === "WATER");

        const elecApproved = elec && elec.status === "APPROVED";
        const waterApproved = water && water.status === "APPROVED";

        const elecCost = elecApproved ? Number(elec.calculated_amount) : "";
        const waterPrev = waterApproved ? Number(water.previous_reading) : "";
        const waterCurr = waterApproved ? Number(water.current_reading) : "";
        const waterDiff = waterApproved ? Number(water.usage_units) : "";
        const waterCost = waterApproved ? Number(water.calculated_amount) : "";
        const waterTreatment = waterApproved ? Number(water.treatment_amount) : "";

        let totalAmount: number | string = "";
        if (elecApproved || waterApproved) {
          const e = elecApproved ? Number(elec.calculated_amount) : 0;
          const w = waterApproved ? Number(water.calculated_amount) : 0;
          const t = waterApproved ? Number(water.treatment_amount) : 0;
          totalAmount = e + w + t;
        }

        sheetData.push([
          idx + 1,
          unitNo,
          elecCost,
          unitNo,
          waterPrev,
          waterCurr,
          waterDiff,
          waterCost,
          waterTreatment,
          totalAmount
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
        { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
        { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
        { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
        { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
        { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
        { s: { r: 3, c: 6 }, e: { r: 4, c: 6 } },
        { s: { r: 3, c: 7 }, e: { r: 4, c: 7 } },
        { s: { r: 3, c: 8 }, e: { r: 4, c: 8 } },
        { s: { r: 3, c: 9 }, e: { r: 4, c: 9 } }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Standard Summary");
      XLSX.writeFile(wb, `IRM_Standard_Summary_${billingMonth}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Excel Parse and Upload preview logic — supports TWO formats:
  // A) Standard Summary Workbook (title rows 0-2, headers 3-4, data 5+)
  // B) IRM flat export (Reading_ID, Room_Number, Utility_Type, etc.)
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setExcelError(null);
    setPreviewRows([]);
    setExcelFileName(file.name);
    
    const sizeInMB = file.size / (1024 * 1024);
    setExcelFileSize(`${sizeInMB.toFixed(2)} MB`);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setExcelParseStatus("ERROR");
      setExcelError(language === "en" ? "Only .xlsx files are supported" : "ระบบรองรับไฟล์นามสกุล .xlsx เท่านั้น");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setExcelParseStatus("ERROR");
      setExcelError(language === "en" ? "File size exceeds 10 MB limit" : "ขนาดไฟล์ต้องไม่เกิน 10 MB");
      return;
    }

    if (selectedCycle === "ALL") {
      setExcelParseStatus("ERROR");
      setExcelError(language === "en" ? "Please select a specific cycle before uploading." : "กรุณาเลือกรอบจดมิเตอร์ก่อนอัปโหลดไฟล์");
      return;
    }

    setExcelParseStatus("PARSING");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Read all rows as raw arrays (header:1 mode)
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

        if (rawRows.length === 0) {
          setExcelParseStatus("ERROR");
          setExcelError(language === "en" ? "Empty workbook" : "ไฟล์ Excel ไม่มีข้อมูล");
          return;
        }

        // Detect format: Standard workbook vs IRM flat export
        // Standard workbook: Row 3 contains Thai headers like "ลำดับ", "ห้องชุดเลขที่", etc.
        // IRM flat export: Row 0 contains "Reading_ID", "Room_Number", etc.
        const firstRowStr = rawRows[0]?.map(c => String(c || "").trim()).filter(Boolean) || [];
        const isIRMExport = firstRowStr.some(h => h === "Reading_ID" || h === "Room_Number");

        const resolveRows: { source_row: number; room_number: string; utility_type: string; current_reading: number | null; technician_note: string }[] = [];

        if (isIRMExport) {
          // === IRM Flat Export Format ===
          // Row 0 = headers, Row 1+ = data
          const headers = rawRows[0].map(h => String(h || "").trim());
          const colIdx = {
            reading_id: headers.indexOf("Reading_ID"),
            room: headers.indexOf("Room_Number"),
            utility: headers.indexOf("Utility_Type"),
            prev: headers.indexOf("Previous_Reading"),
            curr: headers.indexOf("Current_Reading"),
            note: headers.indexOf("Technician_Note"),
          };

          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.every(c => c === "" || c === null || c === undefined)) continue;

            const roomNum = String(row[colIdx.room] ?? "").trim();
            const utilType = String(row[colIdx.utility] ?? "").trim();
            const currStr = row[colIdx.curr];
            const currVal = currStr !== "" && currStr !== null && currStr !== undefined ? Number(currStr) : null;
            const note = String(row[colIdx.note] ?? "").trim();

            if (!roomNum) continue; // skip empty rows

            resolveRows.push({
              source_row: i + 1,
              room_number: roomNum,
              utility_type: utilType || "WATER",
              current_reading: currVal,
              technician_note: note,
            });
          }
        } else {
          // === Standard Summary Workbook Format ===
          // Row 0: Property name (merged)
          // Row 1: Title "ตารางสรุปค่าไฟฟ้า - ค่าน้ำประปา"
          // Row 2: Billing month "ประจำเดือน..."
          // Row 3: Main headers [ลำดับ, ห้องชุดเลขที่, ค่าไฟฟ้า, ห้องชุดเลขที่, มิเตอร์น้ำ, __, ผลต่าง, ค่าน้ำประปา, บำบัด, รวมจำนวนเงิน]
          // Row 4: Sub-headers [,,,,ก่อน,หลัง,,,,]
          // Row 5+: Data [seq, room, elec_cost, room, water_prev, water_curr, water_diff, water_cost, treatment, total]

          // Detect header row: find the row containing "ลำดับ" or "ห้องชุดเลขที่"
          let headerRowIdx = -1;
          for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
            const rowStr = rawRows[i]?.map(c => String(c || "").trim()) || [];
            if (rowStr.includes("ลำดับ") || rowStr.includes("No.")) {
              headerRowIdx = i;
              break;
            }
          }

          if (headerRowIdx === -1) {
            setExcelParseStatus("ERROR");
            setExcelError(
              language === "en"
                ? "Could not detect header row. Expected 'ลำดับ' or 'No.' in first 10 rows."
                : "ไม่พบแถวหัวตาราง (ลำดับ/No.) ในแถวที่ 1-10 ของไฟล์"
            );
            return;
          }

          // Data starts 2 rows after header (header row + sub-header row)
          const dataStartRow = headerRowIdx + 2;

          // Determine column indices from header row
          const headerCells = rawRows[headerRowIdx]?.map(c => String(c || "").trim()) || [];
          
          // Standard layout: col 1 = room, col 4 = water prev, col 5 = water curr
          // Find room column (ห้องชุดเลขที่ or Room No.)
          let roomCol = headerCells.findIndex(h => h.includes("ห้องชุดเลขที่") || h.includes("Room"));
          if (roomCol === -1) roomCol = 1; // fallback to standard position

          // Water current reading is at column 5 in the standard layout
          const waterCurrCol = 5;

          for (let i = dataStartRow; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            // Get room number as string (preserve leading zeroes)
            const rawRoom = row[roomCol];
            const roomNum = String(rawRoom ?? "").trim();

            // Skip blank rows, header repeats, and total/subtotal rows
            if (!roomNum || roomNum === "" || roomNum === "ลำดับ" || roomNum === "No." || roomNum === "ห้องชุดเลขที่" || roomNum === "Room No.") continue;
            if (roomNum.includes("รวม") || roomNum.includes("Total") || roomNum.includes("subtotal")) continue;

            // Extract water current reading
            const waterCurrRaw = row[waterCurrCol];
            const waterCurrVal = waterCurrRaw !== "" && waterCurrRaw !== null && waterCurrRaw !== undefined ? Number(waterCurrRaw) : null;

            // Only create a water import row (standard workbook is water-focused)
            resolveRows.push({
              source_row: i + 1, // 1-indexed for user display
              room_number: roomNum,
              utility_type: "WATER",
              current_reading: waterCurrVal,
              technician_note: "",
            });
          }
        }

        if (resolveRows.length === 0) {
          setExcelParseStatus("ERROR");
          setExcelError(language === "en" ? "No data rows found in workbook" : "ไม่พบข้อมูลแถวรายการในไฟล์");
          return;
        }

        if (resolveRows.length > 1000) {
          setExcelParseStatus("ERROR");
          setExcelError(language === "en" ? "Excel data exceeds 1000 rows limit" : "จำนวนแถวข้อมูลในไฟล์ห้ามเกิน 1,000 แถว");
          return;
        }

        // Call server-side resolve API to map room numbers to reading IDs
        const resolveRes = await fetch("/api/v1/meter-readings/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycle_id: selectedCycle,
            rows: resolveRows
          })
        });

        const resolveJson = await resolveRes.json();

        if (!resolveJson.success) {
          setExcelParseStatus("ERROR");
          setExcelError(resolveJson.message || "Server resolution failed");
          return;
        }

        const resolvedData: ImportPreviewRow[] = resolveJson.data;
        setPreviewRows(resolvedData);
        setExcelParseStatus("SUCCESS");

      } catch (err) {
        console.error(err);
        setExcelParseStatus("ERROR");
        setExcelError(language === "en" ? "Failed to parse workbook." : "ไม่สามารถอ่านโครงสร้างไฟล์ Excel ได้");
      }
    };
    reader.onerror = () => {
      setExcelParseStatus("ERROR");
      setExcelError(language === "en" ? "Failed to read file." : "อ่านไฟล์ไม่สำเร็จ");
    };
    reader.readAsArrayBuffer(file);
  };

  // Confirm excel batch import — only import resolved valid/warning rows
  const handleConfirmImport = async () => {
    if (previewRows.length === 0 || selectedCycle === "ALL") return;
    const hasErrors = previewRows.some(r => r.validationStatus === "ERROR" || r.validationStatus === "DUPLICATE");
    if (hasErrors) {
      alert(language === "en" ? "Please correct all error and duplicate rows before importing." : "กรุณาแก้ไขรายการที่มีข้อผิดพลาดหรือข้อมูลซ้ำก่อนนำเข้า");
      return;
    }

    // Filter only rows that have resolved reading_ids
    const importableRows = previewRows.filter(r => r.reading_id && (r.validationStatus === "VALID" || r.validationStatus === "WARNING"));
    if (importableRows.length === 0) {
      alert(language === "en" ? "No importable rows found." : "ไม่พบรายการที่สามารถนำเข้าได้");
      return;
    }

    setImporting(true);
    try {
      const payload = importableRows.map(r => ({
        reading_id: r.reading_id,
        current_reading: r.current_reading,
        technician_note: r.technician_note
      }));

      const res = await fetch("/api/v1/meter-readings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: selectedCycle,
          readings: payload
        })
      });

      const json = await res.json();
      if (json.success) {
        setImportResult({
          success: true,
          total: json.total,
          imported: json.imported,
          warnings: json.warnings
        });
        setPreviewRows([]);
        fetchReadings();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
      alert(language === "en" ? "Import failed due to network or server error." : "เกิดข้อผิดพลาดในการนำเข้า");
    } finally {
      setImporting(false);
    }
  };

  // Download Excel template for bulk meter master import
  const handleDownloadMeterTemplate = () => {
    const headers = [
      ["UNIT_NUMBER", "UTILITY_TYPE", "METER_CLASSIFICATION", "MANUFACTURER_SERIAL_NUMBER", "INSTALLED_DATE", "INITIAL_READING", "NOTE"],
      ["420/105", "WATER", "LEGACY", "", "", "0.00", "Legitimate legacy water meter confirmed"],
      ["420/105", "ELECTRICITY", "NEW", "ABC1234567", "2026-07-09", "0.00", "New replacement electricity meter"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meters Template");
    XLSX.writeFile(wb, "IRM_Meter_Master_Template.xlsx");
  };

  // Excel Upload for Meter Registration Preview and Server-Side validation
  const handleMeterExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMeterImportResult(null);
    setMeterExcelError(null);
    setMeterPreviewRows([]);
    setMeterExcelFileName(file.name);

    const sizeInMB = file.size / (1024 * 1024);
    setMeterExcelFileSize(`${sizeInMB.toFixed(2)} MB`);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMeterExcelParseStatus("ERROR");
      setMeterExcelError(language === "en" ? "Only .xlsx files are supported" : "ระบบรองรับไฟล์นามสกุล .xlsx เท่านั้น");
      return;
    }

    setMeterExcelParseStatus("PARSING");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawRows: (string | number | boolean | null | undefined)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (rawRows.length === 0) {
          setMeterExcelParseStatus("ERROR");
          setMeterExcelError(language === "en" ? "Empty workbook" : "ไฟล์ Excel ไม่มีข้อมูล");
          return;
        }

        // Column headers mapping
        const headers = rawRows[0].map(h => String(h || "").trim().toUpperCase());
        const colIdx = {
          unit: headers.indexOf("UNIT_NUMBER"),
          type: headers.indexOf("UTILITY_TYPE"),
          classification: headers.indexOf("METER_CLASSIFICATION"),
          serial: headers.indexOf("MANUFACTURER_SERIAL_NUMBER"),
          installed_date: headers.indexOf("INSTALLED_DATE"),
          reading: headers.indexOf("INITIAL_READING"),
          note: headers.indexOf("NOTE")
        };

        if (colIdx.unit === -1 || colIdx.type === -1 || colIdx.classification === -1) {
          setMeterExcelParseStatus("ERROR");
          setMeterExcelError(
            language === "en"
              ? "Invalid template. Required columns: UNIT_NUMBER, UTILITY_TYPE, METER_CLASSIFICATION"
              : "โครงสร้างแบบฟอร์มไม่ถูกต้อง กรุณาใช้ไฟล์เทมเพลตขึ้นทะเบียนที่กำหนด"
          );
          return;
        }

        interface UploadRowInput {
          room_number: string;
          utility_type: string;
          meter_classification: string;
          manufacturer_serial_number: string;
          installed_date: string;
          initial_reading: number;
          note: string;
        }

        const rows: UploadRowInput[] = [];
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (!row || row.every(c => c === "")) continue;

          rows.push({
            room_number: String(row[colIdx.unit] ?? "").trim(),
            utility_type: String(row[colIdx.type] ?? "").trim(),
            meter_classification: String(row[colIdx.classification] ?? "").trim(),
            manufacturer_serial_number: colIdx.serial !== -1 ? String(row[colIdx.serial] ?? "").trim() : "",
            installed_date: colIdx.installed_date !== -1 ? String(row[colIdx.installed_date] ?? "").trim() : "",
            initial_reading: colIdx.reading !== -1 ? (row[colIdx.reading] !== "" ? Number(row[colIdx.reading]) : 0) : 0,
            note: colIdx.note !== -1 ? String(row[colIdx.note] ?? "").trim() : ""
          });
        }

        if (rows.length === 0) {
          setMeterExcelParseStatus("ERROR");
          setMeterExcelError(language === "en" ? "No data rows found" : "ไม่พบแถวข้อมูลใดๆ ในไฟล์");
          return;
        }

        // Call server-side dry-run validation endpoint
        const res = await fetch("/api/v1/utility-meters/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: selectedProperty,
            meters: rows,
            dry_run: true
          })
        });

        const json = await res.json();
        if (json.success) {
          setMeterPreviewRows(json.data || []);
          setMeterExcelParseStatus("SUCCESS");
        } else {
          setMeterExcelParseStatus("ERROR");
          setMeterExcelError(json.message || "Validation failed");
        }
      } catch (err: unknown) {
        console.error(err);
        const errMsg = err instanceof Error ? err.message : String(err);
        setMeterExcelParseStatus("ERROR");
        setMeterExcelError((language === "en" ? "Failed to parse workbook: " : "ไม่สามารถอ่านโครงสร้างไฟล์ Excel ได้: ") + errMsg);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Confirm Excel Bulk Meter Master Registration
  const handleConfirmMeterImport = async () => {
    if (meterPreviewRows.length === 0) return;
    const hasErrors = meterPreviewRows.some(r => r.validationStatus === "ERROR");
    if (hasErrors) {
      alert(language === "en" ? "Please correct all error rows before importing." : "กรุณาแก้ไขแถวข้อมูลที่มีข้อผิดพลาดก่อนกดยืนยัน");
      return;
    }

    setMeterImporting(true);
    try {
      const payload = meterPreviewRows.map(r => ({
        room_number: r.room_number,
        utility_type: r.utility_type,
        meter_classification: r.meter_classification,
        manufacturer_serial_number: r.manufacturer_serial_number,
        installed_date: r.installed_date,
        initial_reading: r.initial_reading,
        note: r.note
      }));

      const res = await fetch("/api/v1/utility-meters/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedProperty,
          meters: payload,
          dry_run: false
        })
      });

      const json = await res.json();
      if (json.success) {
        setMeterImportResult({
          success: true,
          total: payload.length,
          imported: json.created
        });
        setMeterPreviewRows([]);
        fetchRegistry();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
      alert(language === "en" ? "Import failed." : "เกิดข้อผิดพลาดในการนำเข้ามิเตอร์");
    } finally {
      setMeterImporting(false);
    }
  };

  // Export Registry List sorted naturally
  const handleExportRegistry = () => {
    const sortedMeters = [...meters].sort((a, b) => {
      const numA = a.unit?.unit_number || "";
      const numB = b.unit?.unit_number || "";
      return compareUnitNumbers(numA, numB);
    });

    const exportData = sortedMeters.map(m => {
      const codeParts = m.meter_number.split("-");
      const seq = parseInt(codeParts[codeParts.length - 1], 10) || 1;

      return {
        "UNIT_NUMBER": m.unit?.unit_number || "",
        "UTILITY_TYPE": m.utility_type,
        "INTERNAL_METER_CODE": m.meter_number,
        "MANUFACTURER_SERIAL_NUMBER": m.manufacturer_serial_number || "",
        "METER_STATUS": m.meter_status,
        "INSTALLED_DATE": m.installed_at || "",
        "INITIAL_READING": m.initial_reading,
        "RETIRED_DATE": m.retired_at || "",
        "REPLACEMENT_SEQUENCE": seq
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meter Registry");
    XLSX.writeFile(wb, "IRM_Meter_Registry.xlsx");
  };

  // Render RLS checks / Fail Closed
  const isAuthorized = role && ["super_admin", "admin", "property_admin"].includes(role);
  if (loading) {
    return (
      <MainLayout>
        <LoadingState />
      </MainLayout>
    );
  }

  if (!isAuthorized) {
    return (
      <MainLayout>
        <div className="p-6 text-center text-rose-600 font-bold bg-white rounded-xl border border-rose-100 shadow-sm max-w-lg mx-auto mt-12">
          ❌ {language === "en" ? "Access Denied: Unprivileged role scope" : "ไม่มีสิทธิ์เข้าถึง: บทบาทผู้ใช้ไม่มีสิทธิ์เข้าใช้งานระบบการจัดการมิเตอร์"}
        </div>
      </MainLayout>
    );
  }

  // Filter preview rows
  const filteredPreviewRows = previewRows.filter(r => {
    if (excelFilter === "ALL") return true;
    return r.validationStatus === excelFilter;
  });

  const filteredMeterPreviewRows = meterPreviewRows.filter(r => {
    if (meterExcelFilter === "ALL") return true;
    return r.validationStatus === meterExcelFilter;
  });

  return (
    <MainLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <PageHeader
              title={language === "en" ? "Meter & Utility Workspace" : "จัดการมิเตอร์และสาธารณูปโภค"}
            />
            <p className="text-sm text-slate-500 mt-1">
              {language === "en" ? "Admin control workspace for utility operations, rates, and batch imports." : "ระบบการจัดการรอบจดมิเตอร์ ทะเบียนมิเตอร์ และนำเข้า/ส่งออกข้อมูลประมวลผลระบบน้ำ/ไฟ"}
            </p>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                </option>
              ))}
            </select>

            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-xs font-semibold outline-none"
            >
              <option value="ALL">{language === "en" ? "ALL CYCLES" : "ทุกรอบจดมิเตอร์"}</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cycle_name} ({c.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {fetchError && (
          <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-800 text-amber-850 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span>
            <span>{fetchError}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto text-xs font-bold gap-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition ${activeTab === "overview" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            📊 {language === "en" ? "Overview" : "ภาพรวม"}
          </button>
          <button
            onClick={() => setActiveTab("cycles")}
            className={`pb-3 border-b-2 transition ${activeTab === "cycles" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            ⏰ {language === "en" ? "Meter Cycles" : "รอบจดมิเตอร์"}
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`pb-3 border-b-2 transition ${activeTab === "review" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            🔍 {language === "en" ? "Review Queue" : "ตรวจสอบค่ามิเตอร์"}
          </button>
          <button
            onClick={() => setActiveTab("excel")}
            className={`pb-3 border-b-2 transition ${activeTab === "excel" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            📥 {language === "en" ? "Excel Import/Export" : "นำเข้า/ส่งออก Excel"}
          </button>
          <button
            onClick={() => setActiveTab("registry")}
            className={`pb-3 border-b-2 transition ${activeTab === "registry" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            🗂️ {language === "en" ? "Meter Registry" : "ทะเบียนมิเตอร์"}
          </button>
          <button
            onClick={() => setActiveTab("rates")}
            className={`pb-3 border-b-2 transition ${activeTab === "rates" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            💸 {language === "en" ? "Utility Rates" : "อัตราค่าน้ำค่าไฟ"}
          </button>
          <button
            onClick={() => setActiveTab("control")}
            className={`pb-3 border-b-2 transition ${activeTab === "control" ? "border-[#D4AF37] text-slate-800 dark:text-white" : "border-transparent text-slate-400"}`}
          >
            🔌 {language === "en" ? "Control Status" : "สถานะน้ำ/ไฟ"}
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-slate-800 p-4 border rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 block">{language === "en" ? "TOTAL TASKS" : "รายการทั้งหมด"}</span>
                <span className="text-2xl font-bold text-slate-700 dark:text-white">{stats.total}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 border rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 block">{language === "en" ? "PENDING" : "รอจดบันทึก"}</span>
                <span className="text-2xl font-bold text-amber-500">{stats.pending}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 border rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 block">{language === "en" ? "REVIEW QUEUE" : "ส่งตรวจ/รอตรวจ"}</span>
                <span className="text-2xl font-bold text-blue-500">{stats.review}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 border rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 block">{language === "en" ? "APPROVED" : "อนุมัติแล้ว"}</span>
                <span className="text-2xl font-bold text-emerald-500">{stats.approved}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 border border-rose-100 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-rose-400 block">{language === "en" ? "ANOMALIES" : "การใช้ผิดปกติ"}</span>
                <span className="text-2xl font-bold text-rose-500">{stats.anomalies}</span>
              </div>
            </div>

            {/* Cycle progress details */}
            <div className="bg-white dark:bg-slate-800 border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white border-b pb-2">
                {language === "en" ? "Active Cycles Progress" : "ความคืบหน้ารอบจดมิเตอร์ปัจจุบัน"}
              </h3>
              <div className="space-y-4">
                {cycles.filter(c => c.status !== "CLOSED" && c.status !== "CANCELLED").map(c => {
                  const cycleReadings = readings.filter(r => r.cycle_id === c.id);
                  const approved = cycleReadings.filter(r => r.status === "APPROVED").length;
                  const total = cycleReadings.length;
                  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;

                  return (
                    <div key={c.id} className="space-y-2 text-xs">
                      <div className="flex justify-between font-bold">
                        <span>{c.cycle_name} ({c.utility_type === "WATER" ? "💧 น้ำ" : "⚡ ไฟ"})</span>
                        <span>{approved}/{total} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-[#D4AF37] h-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Cycles */}
        {activeTab === "cycles" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {language === "en" ? "Meter Reading Cycles List" : "รายการรอบการจดบันทึกมิเตอร์"}
              </h3>
              <button
                onClick={() => setShowCreateCycleModal(true)}
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition text-xs shadow-sm"
              >
                + {language === "en" ? "Create Cycle" : "สร้างรอบจดมิเตอร์"}
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                  <tr>
                    <th className="p-3">{language === "en" ? "Cycle Name" : "ชื่อรอบจดมิเตอร์"}</th>
                    <th className="p-3">{language === "en" ? "Utility Type" : "ประเภท"}</th>
                    <th className="p-3">{language === "en" ? "Billing Month" : "รอบเดือน"}</th>
                    <th className="p-3">{language === "en" ? "Start Date" : "วันที่เริ่มจด"}</th>
                    <th className="p-3">{language === "en" ? "Due Date" : "กำหนดส่ง"}</th>
                    <th className="p-3">{language === "en" ? "Status" : "สถานะ"}</th>
                    <th className="p-3 text-center">{language === "en" ? "Action" : "การจัดการ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-350">
                  {cycles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        {language === "en" ? "No cycles configured for this property." : "ยังไม่มีข้อมูลรอบจดมิเตอร์ในระบบ"}
                      </td>
                    </tr>
                  ) : (
                    cycles.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold">{c.cycle_name}</td>
                        <td className="p-3">
                          {c.utility_type === "WATER" ? (
                            <span className="text-blue-500 font-bold">💧 WATER</span>
                          ) : (
                            <span className="text-amber-500 font-bold">⚡ ELEC</span>
                          )}
                        </td>
                        <td className="p-3 font-mono">{c.billing_month}</td>
                        <td className="p-3">{formatThaiDate(c.reading_start_date)}</td>
                        <td className="p-3">{formatThaiDate(c.reading_due_date)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            c.status === "DRAFT" ? "bg-slate-100 text-slate-600" :
                            c.status === "OPEN" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                            c.status === "CLOSED" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                            "bg-rose-50 text-rose-600"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 text-center space-x-1.5">
                          {c.status === "DRAFT" && (
                            <button
                              onClick={() => handleOpenCycle(c.id)}
                              className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded text-[10px] shadow"
                            >
                              🚀 {language === "en" ? "Open" : "เปิดรอบ"}
                            </button>
                          )}
                          
                          {c.status !== "CLOSED" && c.status !== "CANCELLED" && (
                            <button
                              onClick={() => {
                                setSelectedCycleForEdit(c);
                                setEditCycleCode(c.cycle_code);
                                setEditCycleName(c.cycle_name);
                                setEditBillingMonth(c.billing_month);
                                setEditCycleStartDate(c.reading_start_date);
                                setEditCycleDueDate(c.reading_due_date);
                                setEditCycleType(c.utility_type);
                                setEditCycleFormError(null);
                                setShowEditCycleModal(true);
                              }}
                              className="px-2 py-1 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded text-[10px] shadow"
                            >
                              📝 {language === "en" ? "Edit" : "แก้ไขรอบจดมิเตอร์"}
                            </button>
                          )}

                          {(() => {
                            const cycleReadings = readings.filter(r => r.cycle_id === c.id);
                            const hasProgress = cycleReadings.some(r => 
                              r.status !== "PENDING" || 
                              r.current_reading !== null || 
                              r.photo_url !== null || 
                              r.technician_note !== null ||
                              r.recorded_by !== null
                            );

                            if (c.status === "CLOSED" || c.status === "CANCELLED") {
                              return null;
                            }

                            if (!hasProgress) {
                              return (
                                <button
                                  onClick={() => handleDeleteCycle(c.id)}
                                  className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded text-[10px] shadow"
                                >
                                  🗑️ {language === "en" ? "Delete" : "ลบ"}
                                </button>
                              );
                            } else {
                              return (
                                <button
                                  onClick={() => handleCancelCycle(c.id)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] shadow"
                                >
                                  🚫 {language === "en" ? "Cancel" : "ยกเลิก"}
                                </button>
                              );
                            }
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Review Queue */}
        {activeTab === "review" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {language === "en" ? "Submitted Readings Awaiting Approval" : "รายการจดมิเตอร์รอการอนุมัติ"}
              </h3>
              {selectedReadingIds.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleBatchApprove}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow transition"
                  >
                    ✓ {language === "en" ? `Approve Selected (${selectedReadingIds.length})` : `อนุมัติที่เลือก (${selectedReadingIds.length})`}
                  </button>
                  <button
                    onClick={() => {
                      setIsBatchReturn(true);
                      setReturnNote("");
                      setShowReturnModal(true);
                    }}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow transition"
                  >
                    ✕ {language === "en" ? `Request Recheck (${selectedReadingIds.length})` : `สั่งตรวจซ้ำที่เลือก (${selectedReadingIds.length})`}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                  <tr>
                    <th className="p-3 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={
                          readings.filter(r => r.status === "REVIEW").length > 0 &&
                          selectedReadingIds.length === readings.filter(r => r.status === "REVIEW").length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReadingIds(readings.filter(r => r.status === "REVIEW").map(r => r.id));
                          } else {
                            setSelectedReadingIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-3">{language === "en" ? "Room" : "ห้อง"}</th>
                    <th className="p-3">{language === "en" ? "Utility" : "ประเภท"}</th>
                    <th className="p-3">{language === "en" ? "Meter Serial" : "เลขมิเตอร์"}</th>
                    <th className="p-3">{language === "en" ? "Previous Reading" : "ครั้งก่อน"}</th>
                    <th className="p-3">{language === "en" ? "Current Reading" : "เลขปัจจุบัน"}</th>
                    <th className="p-3">{language === "en" ? "Consumption" : "หน่วยใช้"}</th>
                    <th className="p-3">{language === "en" ? "Rate" : "อัตรา"}</th>
                    <th className="p-3">{language === "en" ? "Amount" : "ค่าน้ำ/ไฟ"}</th>
                    <th className="p-3">{language === "en" ? "Status" : "สถานะ/ความผิดปกติ"}</th>
                    <th className="p-3 text-center">{language === "en" ? "Actions" : "การจัดการ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-350">
                  {readings.filter(r => r.status === "REVIEW").length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        {language === "en" ? "No readings in review queue." : "ไม่มีรายการที่อยู่ระหว่างรอตรวจสอบและอนุมัติ"}
                      </td>
                    </tr>
                  ) : (
                    readings.filter(r => r.status === "REVIEW").map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedReadingIds.includes(r.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedReadingIds(prev => [...prev, r.id]);
                              } else {
                                setSelectedReadingIds(prev => prev.filter(id => id !== r.id));
                              }
                            }}
                          />
                        </td>
                        <td className="p-3 font-bold">Room {r.unit?.unit_number}</td>
                        <td className="p-3">
                          {r.utility_type === "WATER" ? (
                            <span className="text-blue-500 font-bold">💧 น้ำ</span>
                          ) : (
                            <span className="text-amber-500 font-bold">⚡ ไฟ</span>
                          )}
                        </td>
                        <td className="p-3 font-mono">{r.meter?.meter_number}</td>
                        <td className="p-3 font-mono">{Number(r.previous_reading).toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-white">{Number(r.current_reading).toLocaleString()}</td>
                        <td className="p-3 font-mono text-[#D4AF37] font-bold">{Number(r.usage_units).toLocaleString()}</td>
                        <td className="p-3 font-mono">{Number(r.rate_per_unit_snapshot).toFixed(2)}</td>
                        <td className="p-3 font-mono font-bold">{Number(r.calculated_amount).toLocaleString()} บาท</td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {r.anomaly_status !== "NORMAL" ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-rose-50 text-rose-600 border border-rose-100 w-max">
                                ⚠️ {r.anomaly_status} ({r.anomaly_reason})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 w-max">
                                Normal
                              </span>
                            )}
                            {r.recheck_requested && (
                              <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-amber-50 text-amber-600 border border-amber-100 w-max">
                                🔄 Rechecking: {r.recheck_reason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleApproveReading(r.id)}
                            className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded text-[10px] shadow"
                          >
                            ✓ {language === "en" ? "Approve" : "อนุมัติ"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReadingForReturn(r);
                              setIsBatchReturn(false);
                              setShowReturnModal(true);
                            }}
                            className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded text-[10px] shadow"
                          >
                            ✕ {language === "en" ? "Recheck" : "สั่งตรวจซ้ำ"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Excel Import/Export */}
        {activeTab === "excel" && (
          <div className="space-y-6">
            {/* Sub-mode selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setExcelSubMode("readings")}
                className={`py-2.5 px-4 font-bold text-xs border-b-2 transition ${
                  excelSubMode === "readings"
                    ? "border-[#D4AF37] text-slate-800 dark:text-white"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                📝 {language === "en" ? "Meter Readings (Import/Export)" : "นำเข้า/ส่งออก ข้อมูลการจดมิเตอร์"}
              </button>
              <button
                onClick={() => setExcelSubMode("meters")}
                className={`py-2.5 px-4 font-bold text-xs border-b-2 transition ${
                  excelSubMode === "meters"
                    ? "border-[#D4AF37] text-slate-800 dark:text-white"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                💾 {language === "en" ? "Meter Registry (Import/Export)" : "นำเข้า/ส่งออก ทะเบียนคุมมิเตอร์"}
              </button>
            </div>

            {excelSubMode === "readings" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Panel */}
                  <div className="bg-white dark:bg-slate-800 p-6 border rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-white">
                      📤 {language === "en" ? "Export Reading Template" : "ส่งออกฟอร์มบันทึกข้อมูลมิเตอร์"}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === "en" ? "Export the selected cycle configuration list to an Excel workbook for manual reading capture." : "ดาวน์โหลดโครงร่างข้อมูลรายการจดบันทึกมิเตอร์เป็นไฟล์ Excel เพื่อให้เจ้าหน้าที่นำไปบันทึกข้อมูล"}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleExcelExport}
                        disabled={selectedCycle === "ALL"}
                        className={`px-4 py-2.5 text-white font-bold rounded-xl transition text-xs shadow flex items-center justify-center gap-2 ${
                          selectedCycle === "ALL" ? "bg-slate-300 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        📥 {language === "en" ? "Export Excel Template" : "ดาวน์โหลดเทมเพลต Excel"}
                      </button>
                      <button
                        onClick={handleStandardExport}
                        disabled={selectedCycle === "ALL"}
                        className={`px-4 py-2.5 text-white font-bold rounded-xl transition text-xs shadow flex items-center justify-center gap-2 ${
                          selectedCycle === "ALL" ? "bg-slate-300 cursor-not-allowed" : "bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                        }`}
                      >
                        📊 {language === "en" ? "Export Standard Summary" : "ส่งออกตารางสรุปมาตรฐาน"}
                      </button>
                    </div>
                  </div>

                  {/* Import Panel */}
                  <div className="bg-white dark:bg-slate-800 p-6 border rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-white">
                      📥 {language === "en" ? "Upload Completed Excel File" : "นำเข้าข้อมูลจาก Excel"}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === "en" ? "Upload the completed Excel file to preview, validate constraints, and batch import readings." : "อัปโหลดไฟล์จดมิเตอร์ Excel ที่พนักงานกรอกข้อมูลแล้ว เพื่อเข้าสู่ขั้นตอนตรวจสอบและประมวลผลก่อนอนุมัติ"}
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleExcelUpload}
                        disabled={selectedCycle === "ALL" || importing}
                        className="text-xs border p-2 rounded-xl dark:bg-slate-900 w-full outline-none"
                      />
                      {selectedCycle === "ALL" && (
                        <span className="text-[10px] text-amber-500 font-semibold">
                          ⚠️ {language === "en" ? "Select a cycle from top drop-down before uploading." : "กรุณาเลือกหนึ่งรอบจดมิเตอร์ที่เมนูด้านบนขวาก่อนทำการเลือกไฟล์"}
                        </span>
                      )}
                      {excelFileName && (
                        <div className="text-[11px] p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-1">
                          <div><span className="font-bold text-slate-500">{language === "en" ? "File:" : "ชื่อไฟล์:"}</span> {excelFileName}</div>
                          <div><span className="font-bold text-slate-500">{language === "en" ? "Size:" : "ขนาด:"}</span> {excelFileSize}</div>
                          {excelParseStatus === "PARSING" && (
                            <div className="text-amber-500 font-bold animate-pulse">⏳ {language === "en" ? "Parsing file..." : "กำลังอ่านและตรวจสอบโครงสร้างไฟล์..."}</div>
                          )}
                          {excelParseStatus === "SUCCESS" && (
                            <div className="text-emerald-500 font-bold">✓ {language === "en" ? "Parsing completed. Ready to preview." : "อ่านข้อมูลเสร็จสิ้น สามารถตรวจสอบตารางด้านล่างได้"}</div>
                          )}
                          {excelParseStatus === "ERROR" && (
                            <div className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 p-1.5 border border-rose-100 rounded">❌ {excelError}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Import Results Screen */}
                {importResult && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 text-emerald-800 dark:text-emerald-400 rounded-xl space-y-2 text-xs font-semibold">
                    <h4 className="font-bold text-sm">🎉 {language === "en" ? "Excel Batch Import Completed" : "นำเข้าไฟล์จดมิเตอร์สำเร็จ"}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>{language === "en" ? "Total Items:" : "รายการทั้งหมด:"} <span className="font-bold font-mono">{importResult.total}</span></div>
                      <div>{language === "en" ? "Successfully Imported:" : "นำเข้าสำเร็จ:"} <span className="font-bold font-mono text-emerald-600">{importResult.imported}</span></div>
                      <div>{language === "en" ? "Abnormal Warnings:" : "ตรวจพบคำเตือนผิดปกติ:"} <span className="font-bold font-mono text-amber-600">{importResult.warnings}</span></div>
                      <div>{language === "en" ? "Failed / Errors:" : "เกิดข้อผิดพลาด:"} <span className="font-bold font-mono text-rose-600">0</span></div>
                    </div>
                  </div>
                )}

                {/* Preview table & validation pipeline */}
                {previewRows.length > 0 && (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-center">
                        <div className="text-slate-400 font-semibold">{language === "en" ? "Total" : "ทั้งหมด"}</div>
                        <div className="text-lg font-bold font-mono">{previewRows.length}</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl p-3 text-center">
                        <div className="text-emerald-500 font-semibold">{language === "en" ? "Ready" : "พร้อมนำเข้า"}</div>
                        <div className="text-lg font-bold font-mono text-emerald-600">{previewRows.filter(r => r.validationStatus === "VALID").length}</div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-xl p-3 text-center">
                        <div className="text-amber-500 font-semibold">{language === "en" ? "Warnings" : "ต้องตรวจสอบ"}</div>
                        <div className="text-lg font-bold font-mono text-amber-600">{previewRows.filter(r => r.validationStatus === "WARNING").length}</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 rounded-xl p-3 text-center">
                        <div className="text-blue-500 font-semibold">{language === "en" ? "Duplicates" : "ข้อมูลซ้ำ"}</div>
                        <div className="text-lg font-bold font-mono text-blue-600">{previewRows.filter(r => r.validationStatus === "DUPLICATE").length}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 rounded-xl p-3 text-center">
                        <div className="text-rose-500 font-semibold">{language === "en" ? "Errors" : "ผิดพลาด"}</div>
                        <div className="text-lg font-bold font-mono text-rose-600">{previewRows.filter(r => r.validationStatus === "ERROR").length}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 text-[10px] font-bold flex-wrap gap-0.5">
                        <button
                          onClick={() => setExcelFilter("ALL")}
                          className={`px-3 py-1 rounded ${excelFilter === "ALL" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "All" : "ทั้งหมด"} ({previewRows.length})
                        </button>
                        <button
                          onClick={() => setExcelFilter("VALID")}
                          className={`px-3 py-1 rounded ${excelFilter === "VALID" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "Valid" : "พร้อมนำเข้า"} ({previewRows.filter(r => r.validationStatus === "VALID").length})
                        </button>
                        <button
                          onClick={() => setExcelFilter("WARNING")}
                          className={`px-3 py-1 rounded ${excelFilter === "WARNING" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "Warnings" : "ต้องตรวจสอบ"} ({previewRows.filter(r => r.validationStatus === "WARNING").length})
                        </button>
                        <button
                          onClick={() => setExcelFilter("DUPLICATE")}
                          className={`px-3 py-1 rounded ${excelFilter === "DUPLICATE" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "Duplicates" : "ซ้ำ"} ({previewRows.filter(r => r.validationStatus === "DUPLICATE").length})
                        </button>
                        <button
                          onClick={() => setExcelFilter("ERROR")}
                          className={`px-3 py-1 rounded ${excelFilter === "ERROR" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "Errors" : "ผิดพลาด"} ({previewRows.filter(r => r.validationStatus === "ERROR").length})
                        </button>
                      </div>

                      <button
                        onClick={handleConfirmImport}
                        disabled={previewRows.some(r => r.validationStatus === "ERROR" || r.validationStatus === "DUPLICATE") || importing}
                        className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition shadow ${
                          previewRows.some(r => r.validationStatus === "ERROR" || r.validationStatus === "DUPLICATE") || importing
                            ? "bg-slate-350 cursor-not-allowed"
                            : "bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                        }`}
                      >
                        {importing ? (language === "en" ? "Importing..." : "กำลังนำเข้า...") : `🚀 ${language === "en" ? "Confirm Import batch" : "ยืนยันนำเข้าข้อมูลเข้าคิวรอตรวจ"}`}
                      </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-x-auto shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                          <tr>
                            <th className="p-3">{language === "en" ? "Row" : "แถว"}</th>
                            <th className="p-3">{language === "en" ? "Room" : "เลขห้อง"}</th>
                            <th className="p-3">{language === "en" ? "Utility" : "ประเภทมิเตอร์"}</th>
                            <th className="p-3">{language === "en" ? "Meter" : "เลขมิเตอร์"}</th>
                            <th className="p-3">{language === "en" ? "Previous" : "เลขครั้งก่อน"}</th>
                            <th className="p-3">{language === "en" ? "Current" : "เลขครั้งใหม่"}</th>
                            <th className="p-3">{language === "en" ? "Usage" : "หน่วยใช้"}</th>
                            <th className="p-3">{language === "en" ? "Result" : "ผลตรวจสอบ"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-slate-700 dark:text-slate-350">
                          {filteredPreviewRows.map((r, index) => (
                            <tr key={index} className={`hover:bg-slate-50/50 ${
                              r.validationStatus === "ERROR" ? "bg-rose-50/30 dark:bg-rose-950/10" :
                              r.validationStatus === "DUPLICATE" ? "bg-blue-50/30 dark:bg-blue-950/10" :
                              r.validationStatus === "WARNING" ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                            }`}>
                              <td className="p-3 text-slate-400 font-mono">{r.source_row}</td>
                              <td className="p-3 font-semibold">{r.room_number}</td>
                              <td className="p-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.utility_type === "WATER" ? "bg-sky-50 text-sky-600 border border-sky-100" : "bg-yellow-50 text-yellow-600 border border-yellow-100"
                                }`}>
                                  {r.utility_type === "WATER" ? (language === "en" ? "Water" : "น้ำ") : (language === "en" ? "Elec" : "ไฟ")}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[10px]">{r.meter_number || "-"}</td>
                              <td className="p-3 font-mono">{r.previous_reading}</td>
                              <td className="p-3 font-mono font-bold">{r.current_reading ?? "-"}</td>
                              <td className="p-3 font-mono">{r.usage !== null && r.usage !== undefined ? r.usage : "-"}</td>
                              <td className="p-3 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  r.validationStatus === "VALID" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                  r.validationStatus === "WARNING" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                  r.validationStatus === "DUPLICATE" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                  "bg-rose-50 text-rose-600 border border-rose-100"
                                }`}>
                                  {r.validationStatus === "VALID" ? "✓" : r.validationStatus === "WARNING" ? "⚠" : r.validationStatus === "DUPLICATE" ? "🔁" : "✗"} {r.validationMessage || "OK"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {excelSubMode === "meters" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Registry Template Panel */}
                  <div className="bg-white dark:bg-slate-800 p-6 border rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-white">
                      📤 {language === "en" ? "Download Registration Template" : "ส่งออกแบบฟอร์มขึ้นทะเบียนมิเตอร์"}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === "en" ? "Download the Excel template to prepare your meter master list for bulk registration." : "ดาวน์โหลดไฟล์เทมเพลต Excel เพื่อเตรียมข้อมูลขึ้นทะเบียนมิเตอร์จำนวนมาก"}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleDownloadMeterTemplate}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition text-xs shadow flex items-center justify-center gap-2"
                      >
                        📥 {language === "en" ? "Download XLSX Template" : "ดาวน์โหลดเทมเพลต Excel"}
                      </button>
                    </div>
                  </div>

                  {/* Import Registry Panel */}
                  <div className="bg-white dark:bg-slate-800 p-6 border rounded-xl shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800 dark:text-white">
                      📥 {language === "en" ? "Upload Meter Registration File" : "นำเข้าทะเบียนคุมมิเตอร์จาก Excel"}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {language === "en" ? "Upload the completed Excel file to preview, validate serial constraints, and bulk register meters." : "อัปโหลดไฟล์ Excel ทะเบียนคุมมิเตอร์เพื่อตรวจสอบโครงสร้างและขึ้นทะเบียนมิเตอร์พร้อมกันหลายห้อง"}
                    </p>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleMeterExcelUpload}
                        disabled={meterImporting}
                        className="text-xs border p-2 rounded-xl dark:bg-slate-900 w-full outline-none"
                      />
                      {meterExcelFileName && (
                        <div className="text-[11px] p-2 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-1">
                          <div><span className="font-bold text-slate-500">{language === "en" ? "File:" : "ชื่อไฟล์:"}</span> {meterExcelFileName}</div>
                          <div><span className="font-bold text-slate-500">{language === "en" ? "Size:" : "ขนาด:"}</span> {meterExcelFileSize}</div>
                          {meterExcelParseStatus === "PARSING" && (
                            <div className="text-amber-500 font-bold animate-pulse">⏳ {language === "en" ? "Parsing file..." : "กำลังตรวจสอบไฟล์..."}</div>
                          )}
                          {meterExcelParseStatus === "SUCCESS" && (
                            <div className="text-emerald-500 font-bold">✓ {language === "en" ? "Parsing completed. Ready to preview." : "ตรวจสอบข้อมูลเสร็จสิ้น สามารถดูรายละเอียดด้านล่างได้"}</div>
                          )}
                          {meterExcelParseStatus === "ERROR" && (
                            <div className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 p-1.5 border border-rose-100 rounded">❌ {meterExcelError}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Import Results Screen */}
                {meterImportResult && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 text-emerald-800 dark:text-emerald-400 rounded-xl space-y-2 text-xs font-semibold">
                    <h4 className="font-bold text-sm">🎉 {language === "en" ? "Meter Registry Batch Completed" : "ขึ้นทะเบียนคุมมิเตอร์สำเร็จ"}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>{language === "en" ? "Total Items:" : "รายการทั้งหมดในไฟล์:"} <span className="font-bold font-mono">{meterImportResult.total ?? 0}</span></div>
                      <div>{language === "en" ? "Successfully Created:" : "ขึ้นทะเบียนสำเร็จ:"} <span className="font-bold font-mono text-emerald-600">{meterImportResult.imported ?? 0}</span></div>
                      <div>{language === "en" ? "Errors / Ignored:" : "พบข้อผิดพลาด/ข้ามไป:"} <span className="font-bold font-mono text-rose-600">{(meterImportResult.total ?? 0) - (meterImportResult.imported ?? 0)}</span></div>
                    </div>
                  </div>
                )}

                {/* Meter Import Preview table */}
                {meterPreviewRows.length > 0 && (
                  <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-center">
                        <div className="text-slate-400 font-semibold">{language === "en" ? "Total" : "ทั้งหมด"}</div>
                        <div className="text-lg font-bold font-mono">{meterPreviewRows.length}</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl p-3 text-center">
                        <div className="text-emerald-500 font-semibold">{language === "en" ? "Valid (Ready)" : "พร้อมนำเข้า"}</div>
                        <div className="text-lg font-bold font-mono text-emerald-600">{meterPreviewRows.filter(r => r.validationStatus === "VALID").length}</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 rounded-xl p-3 text-center">
                        <div className="text-rose-500 font-semibold">{language === "en" ? "Errors" : "ผิดพลาด"}</div>
                        <div className="text-lg font-bold font-mono text-rose-600">{meterPreviewRows.filter(r => r.validationStatus === "ERROR").length}</div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 text-[10px] font-bold flex-wrap gap-0.5">
                        <button
                          onClick={() => setMeterExcelFilter("ALL")}
                          className={`px-3 py-1 rounded ${meterExcelFilter === "ALL" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "All" : "ทั้งหมด"} ({meterPreviewRows.length})
                        </button>
                        <button
                          onClick={() => setMeterExcelFilter("VALID")}
                          className={`px-3 py-1 rounded ${meterExcelFilter === "VALID" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "Ready" : "พร้อมนำเข้า"} ({meterPreviewRows.filter(r => r.validationStatus === "VALID").length})
                        </button>
                        <button
                          onClick={() => setMeterExcelFilter("ERROR")}
                          className={`px-3 py-1 rounded ${meterExcelFilter === "ERROR" ? "bg-white text-slate-800 shadow" : "text-slate-400"}`}
                        >
                          {language === "en" ? "Errors" : "ผิดพลาด"} ({meterPreviewRows.filter(r => r.validationStatus === "ERROR").length})
                        </button>
                      </div>

                      <button
                        onClick={handleConfirmMeterImport}
                        disabled={meterPreviewRows.some(r => r.validationStatus === "ERROR") || meterImporting}
                        className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition shadow ${
                          meterPreviewRows.some(r => r.validationStatus === "ERROR") || meterImporting
                            ? "bg-slate-355 cursor-not-allowed text-slate-400 bg-slate-100 border border-slate-200"
                            : "bg-[#D4AF37] hover:bg-[#D4AF37]/90"
                        }`}
                      >
                        {meterImporting ? (language === "en" ? "Importing..." : "กำลังนำเข้า...") : `🚀 ${language === "en" ? "Confirm Registration" : "ยืนยันนำเข้าขึ้นทะเบียน"}`}
                      </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-x-auto shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                          <tr>
                            <th className="p-3">{language === "en" ? "Row" : "แถว"}</th>
                            <th className="p-3">{language === "en" ? "Room" : "เลขห้อง"}</th>
                            <th className="p-3">{language === "en" ? "Utility" : "ประเภท"}</th>
                            <th className="p-3">{language === "en" ? "Classification" : "ประเภทขึ้นทะเบียน"}</th>
                            <th className="p-3">{language === "en" ? "Manufacturer Serial" : "เลข Serial ผู้ผลิต"}</th>
                            <th className="p-3">{language === "en" ? "Installed Date" : "วันที่เริ่มติดตั้ง"}</th>
                            <th className="p-3">{language === "en" ? "Initial Reading" : "เลขเริ่มตั้งต้น"}</th>
                            <th className="p-3">{language === "en" ? "Result" : "ผลตรวจสอบ"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-slate-700 dark:text-slate-350">
                          {filteredMeterPreviewRows.map((r, index) => (
                            <tr key={index} className={`hover:bg-slate-50/50 ${
                              r.validationStatus === "ERROR" ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                            }`}>
                              <td className="p-3 text-slate-400 font-mono">{r.source_row}</td>
                              <td className="p-3 font-semibold">{r.room_number}</td>
                              <td className="p-3 font-bold text-slate-600">{r.utility_type}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  r.meter_classification === "LEGACY" ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                }`}>
                                  {r.meter_classification}
                                </span>
                              </td>
                              <td className="p-3 font-mono">{r.manufacturer_serial_number || (language === "en" ? "None" : "ไม่มี")}</td>
                              <td className="p-3">{r.installed_date || (language === "en" ? "None (Legacy)" : "ไม่มี (Legacy)")}</td>
                              <td className="p-3 font-mono">{Number(r.initial_reading).toLocaleString()}</td>
                              <td className="p-3 font-bold">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  r.validationStatus === "VALID" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                                }`}>
                                  {r.validationStatus === "VALID" ? "✓ OK" : `✗ ${r.validationMessage}`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Registry */}
        {activeTab === "registry" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {language === "en" ? "Property Meters Registry" : "ทะเบียนคุมมิเตอร์น้ำ/ไฟรายโครงการ"}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExportRegistry}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition text-xs shadow-sm"
                >
                  📤 {language === "en" ? "Export Registry" : "ส่งออกทะเบียนมิเตอร์"}
                </button>
                <button
                  onClick={() => setShowCoverageInfoPanel(true)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition text-xs shadow-sm"
                >
                  📋 {language === "en" ? "Bulk Import Guide" : "วิธีนำเข้าข้อมูลมิเตอร์"}
                </button>
                <button
                  onClick={() => setShowCreateMeterModal(true)}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition text-xs shadow-sm"
                >
                  + {language === "en" ? "Register Meter" : "ขึ้นทะเบียนมิเตอร์ใหม่"}
                </button>
              </div>
            </div>

            {/* Registry Coverage Summary — displays truthful state, 0% when no real meters registered */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["WATER", "ELECTRICITY"] as const).map(type => {
                const typeMeters = meters.filter(m => m.utility_type === type && m.meter_status === "ACTIVE");
                const coverage = units.length > 0 ? Math.round((typeMeters.length / units.length) * 100) : 0;
                const unmetered = units.length - typeMeters.length;
                return (
                  <div key={type} className={`rounded-xl p-3 border ${
                    type === "WATER" ? "bg-sky-50 border-sky-200" : "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="text-lg font-black">{type === "WATER" ? "💧" : "⚡"}</div>
                    <div className="font-bold text-slate-700 text-xs mt-1">
                      {type === "WATER" ? (language === "en" ? "Water Meters" : "มิเตอร์น้ำ") : (language === "en" ? "Electricity Meters" : "มิเตอร์ไฟ")}
                    </div>
                    <div className="text-xl font-black text-slate-800 mt-0.5">{typeMeters.length}</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${
                      coverage === 100 ? "text-emerald-600" : coverage >= 50 ? "text-amber-600" : "text-rose-500"
                    }`}>{coverage}% {language === "en" ? "coverage" : "ครอบคลุม"}</div>
                    {unmetered > 0 && (
                      <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                        {unmetered} {language === "en" ? "units without meter" : "ห้องยังไม่มีมิเตอร์"}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="rounded-xl p-3 border bg-slate-50 border-slate-200">
                <div className="text-lg font-black">🏢</div>
                <div className="font-bold text-slate-700 text-xs mt-1">{language === "en" ? "Total Units" : "ห้องทั้งหมด"}</div>
                <div className="text-xl font-black text-slate-800 mt-0.5">{units.length}</div>
                <div className="text-[10px] text-slate-500">{language === "en" ? "active units" : "ห้องที่ใช้งาน"}</div>
              </div>
              <div className="rounded-xl p-3 border bg-slate-50 border-slate-200">
                <div className="text-lg font-black">📊</div>
                <div className="font-bold text-slate-700 text-xs mt-1">{language === "en" ? "Registered Meters" : "มิเตอร์ที่ขึ้นทะเบียน"}</div>
                <div className="text-xl font-black text-slate-800 mt-0.5">{meters.filter(m => m.meter_status === "ACTIVE").length}</div>
                <div className="text-[10px] text-slate-500">{language === "en" ? "active meters" : "มิเตอร์ที่ใช้งาน"}</div>
              </div>
            </div>

            {/* Zero-coverage guidance banner — shown when no real meters are registered */}
            {meters.filter(m => m.meter_status === "ACTIVE").length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-3 items-start">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="font-bold">{language === "en" ? "No meters registered yet" : "ยังไม่มีมิเตอร์ในระบบ"}</div>
                  <div className="mt-1">
                    {language === "en"
                      ? "To register meters, go to the Import tab, download the XLSX template, fill in the actual physical meter serial numbers from your meter master list, then upload and confirm."
                      : "หากต้องการขึ้นทะเบียนมิเตอร์ ให้ไปที่แท็บ Import เพื่อดาวน์โหลดแบบฟอร์ม XLSX จากนั้นกรอกเลขซีเรียลมิเตอร์จริงจากทะเบียนมิเตอร์ของโครงการ แล้วอัพโหลดและยืนยัน"}
                  </div>
                  <button
                    onClick={() => setActiveTab("excel")}
                    className="mt-2 px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg text-[11px] hover:bg-amber-700 transition"
                  >
                    → {language === "en" ? "Go to Import tab" : "ไปที่แท็บ Import"}
                  </button>
                </div>
              </div>
            )}


            <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                  <tr>
                    <th className="p-3">{language === "en" ? "Room" : "ห้องชุด"}</th>
                    <th className="p-3">{language === "en" ? "Utility Type" : "ประเภท"}</th>
                    <th className="p-3">{language === "en" ? "Internal Meter Code" : "รหัสคุมมิเตอร์"}</th>
                    <th className="p-3">{language === "en" ? "Manufacturer Serial" : "เลข Serial ผู้ผลิต"}</th>
                    <th className="p-3">{language === "en" ? "Baseline Reading" : "เลขตั้งต้น"}</th>
                    <th className="p-3">{language === "en" ? "Installation Date" : "วันที่เริ่มใช้งาน"}</th>
                    <th className="p-3">{language === "en" ? "Status" : "สถานะ"}</th>
                    <th className="p-3 text-center">{language === "en" ? "Action" : "การจัดการ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-350">
                  {meters.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold">Room {m.unit?.unit_number}</td>
                      <td className="p-3">
                        {m.utility_type === "WATER" ? (
                          <span className="text-blue-500 font-bold">💧 WATER</span>
                        ) : (
                          <span className="text-amber-500 font-bold">⚡ ELEC</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold">{m.meter_number}</td>
                      <td className="p-3 font-mono">{m.manufacturer_serial_number || (language === "en" ? "No Serial" : "ไม่มีเลข Serial")}</td>
                      <td className="p-3 font-mono">{Number(m.initial_reading).toLocaleString()}</td>
                      <td className="p-3">{formatThaiDate(m.installed_at)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          m.meter_status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" :
                          m.meter_status === "RETIRED" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {m.meter_status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {m.meter_status === "ACTIVE" && (
                          <button
                            onClick={() => {
                              setSelectedMeterForReplace(m);
                              setReplacementManufacturerSerial("");
                              setStartingReading("");
                              setFinalReading("");
                              setReplacementReason("");
                              setReplacementDate(new Date().toISOString().split("T")[0]);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border text-slate-600 font-bold rounded text-[10px] shadow"
                          >
                            🔄 {language === "en" ? "Replace Meter" : "เปลี่ยนมิเตอร์"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6: Rates */}
        {activeTab === "rates" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 border rounded-xl p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-800 dark:text-white border-b pb-2">
                💰 {language === "en" ? "Configure Utility Rate" : "ตั้งค่าอัตราต่อหน่วย"}
              </h4>
              <form onSubmit={handleCreateRate} className="space-y-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">{language === "en" ? "Utility Type" : "ประเภทสาธารณูปโภค"}</label>
                  <select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value as "WATER" | "ELECTRICITY")}
                    className="p-2 border rounded-xl dark:bg-slate-900 outline-none"
                  >
                    <option value="WATER">WATER</option>
                    <option value="ELECTRICITY">ELECTRICITY</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">{language === "en" ? "Rate (THB / Unit)" : "อัตราค่าบริการ (บาทต่อหน่วย)"}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ratePerUnit}
                    onChange={(e) => setRatePerUnit(e.target.value)}
                    placeholder="e.g. 7.50"
                    className="p-2 border rounded-xl dark:bg-slate-900 font-mono"
                    required
                  />
                </div>
                <LocalizedDatePicker
                  value={rateFromDate}
                  onChange={setRateFromDate}
                  locale={language}
                  label={language === "en" ? "Effective From" : "วันที่เริ่มใช้งาน"}
                  required
                />
                <LocalizedDatePicker
                  value={rateToDate}
                  onChange={setRateToDate}
                  locale={language}
                  label={language === "en" ? "Effective To" : "วันที่สิ้นสุด (ไม่จำเป็น)"}
                />
                {rateFormError && <div className="text-rose-500 font-semibold">{rateFormError}</div>}
                <button
                  type="submit"
                  className="w-full py-2 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white font-bold rounded-xl transition"
                >
                  {language === "en" ? "Create Rate" : "สร้างค่าน้ำ/ค่าไฟ"}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                  <tr>
                    <th className="p-3">{language === "en" ? "Utility" : "ประเภท"}</th>
                    <th className="p-3">{language === "en" ? "Rate (THB / Unit)" : "อัตราต่อหน่วย"}</th>
                    <th className="p-3">{language === "en" ? "Effective From" : "วันที่เริ่มใช้"}</th>
                    <th className="p-3">{language === "en" ? "Effective To" : "วันที่สิ้นสุด"}</th>
                    <th className="p-3">{language === "en" ? "Status" : "สถานะ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-350">
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 font-bold">{r.utility_type}</td>
                      <td className="p-3 font-mono font-bold text-[#D4AF37]">{Number(r.rate_per_unit).toFixed(2)} บาท/หน่วย</td>
                      <td className="p-3">{formatThaiDate(r.effective_from)}</td>
                      <td className="p-3">{r.effective_to ? formatThaiDate(r.effective_to) : "-"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          r.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        }`}>
                          {r.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Control Status */}
        {activeTab === "control" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {language === "en" ? "Utility Line Operations Control" : "ระบบปิด/เปิดน้ำประปาและควบคุมกระแสไฟห้องพัก"}
            </h3>

            <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b font-bold text-slate-500">
                  <tr>
                    <th className="p-3">{language === "en" ? "Room" : "ห้องชุด"}</th>
                    <th className="p-3">{language === "en" ? "Water Status" : "สถานะท่อส่งน้ำประปา"}</th>
                    <th className="p-3">{language === "en" ? "Electricity Status" : "สถานะสะพานไฟห้องพัก"}</th>
                    <th className="p-3 text-center">{language === "en" ? "Operations Action" : "สั่งการเปิด/ปิด"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:text-slate-350">
                  {units.map((u) => (
                    <tr key={u.id}>
                      <td className="p-3 font-semibold">Room {u.unit_number}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.water_control_status === "NORMAL" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        }`}>
                          💧 {translateControlStatus(u.water_control_status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.electricity_control_status === "NORMAL" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        }`}>
                          ⚡ {translateControlStatus(u.electricity_control_status)}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUnitForControl(u);
                            setControlType("WATER");
                            setNewControlStatus(u.water_control_status);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border text-slate-700 font-bold rounded text-[10px]"
                        >
                          💧 {language === "en" ? "Manage Water" : "ปิด/เปิดน้ำ"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUnitForControl(u);
                            setControlType("ELECTRICITY");
                            setNewControlStatus(u.electricity_control_status);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border text-slate-700 font-bold rounded text-[10px]"
                        >
                          ⚡ {language === "en" ? "Manage Elec" : "ปิด/เปิดไฟ"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Cycle */}
      {showCreateCycleModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white">
              {language === "en" ? "Create Meter Reading Cycle" : "เพิ่มรอบการจดมิเตอร์ใหม่"}
            </h3>
            <form onSubmit={handleCreateCycle} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Utility Type" : "ประเภทมิเตอร์"}</label>
                <select
                  value={cycleType}
                  onChange={(e) => setCycleType(e.target.value as "WATER" | "ELECTRICITY")}
                  className="p-2 border rounded-xl dark:bg-slate-900 outline-none"
                >
                  <option value="WATER">WATER</option>
                  <option value="ELECTRICITY">ELECTRICITY</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Cycle Code" : "รหัสรอบจดมิเตอร์"}</label>
                <input
                  type="text"
                  value={cycleCode}
                  onChange={(e) => setCycleCode(e.target.value)}
                  placeholder="e.g. CYC-2026-07-WATER"
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Cycle Name" : "ชื่อรอบจดมิเตอร์"}</label>
                <input
                  type="text"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  placeholder="e.g. รอบบันทึกค่าน้ำประปา กรกฎาคม 2569"
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Billing Month (YYYY-MM)" : "รอบบิลประจำเดือน (YYYY-MM)"}</label>
                <input
                  type="text"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  placeholder="2026-07"
                  className="p-2 border rounded-xl dark:bg-slate-900 font-mono"
                  required
                />
              </div>
              <LocalizedDatePicker
                value={cycleStartDate}
                onChange={setCycleStartDate}
                locale={language}
                label={language === "en" ? "Reading Start Date" : "วันที่เปิดให้บันทึกได้"}
                required
              />
              <LocalizedDatePicker
                value={cycleDueDate}
                onChange={setCycleDueDate}
                locale={language}
                label={language === "en" ? "Reading Due Date" : "กำหนดส่งข้อมูล"}
                required
              />
              {cycleFormError && <div className="text-rose-500 font-semibold">{cycleFormError}</div>}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCycleModal(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  {language === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-white font-bold rounded-xl"
                >
                  {language === "en" ? "Submit" : "ตกลง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Edit Cycle */}
      {showEditCycleModal && selectedCycleForEdit && (() => {
        const cycleReadings = readings.filter(r => r.cycle_id === selectedCycleForEdit.id);
        const hasProgress = cycleReadings.some(r => 
          r.status !== "PENDING" || 
          r.current_reading !== null || 
          r.photo_url !== null || 
          r.technician_note !== null
        );

        return (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white">
                {language === "en" ? "Edit Reading Cycle" : "แก้ไขรอบจดมิเตอร์"}
              </h3>
              <form onSubmit={handleEditCycleSubmit} className="space-y-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">{language === "en" ? "Utility Type" : "ประเภทมิเตอร์"}</label>
                  <select
                    value={editCycleType}
                    onChange={(e) => setEditCycleType(e.target.value as "WATER" | "ELECTRICITY")}
                    disabled={selectedCycleForEdit.status !== "DRAFT"}
                    className="p-2 border rounded-xl dark:bg-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="WATER">WATER</option>
                    <option value="ELECTRICITY">ELECTRICITY</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">{language === "en" ? "Cycle Code" : "รหัสรอบจดมิเตอร์"}</label>
                  <input
                    type="text"
                    value={editCycleCode}
                    onChange={(e) => setEditCycleCode(e.target.value)}
                    disabled={selectedCycleForEdit.status !== "DRAFT"}
                    className="p-2 border rounded-xl dark:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">{language === "en" ? "Cycle Name" : "ชื่อรอบจดมิเตอร์"}</label>
                  <input
                    type="text"
                    value={editCycleName}
                    onChange={(e) => setEditCycleName(e.target.value)}
                    className="p-2 border rounded-xl dark:bg-slate-900"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">{language === "en" ? "Billing Month (YYYY-MM)" : "รอบบิลประจำเดือน (YYYY-MM)"}</label>
                  <input
                    type="text"
                    value={editBillingMonth}
                    onChange={(e) => setEditBillingMonth(e.target.value)}
                    disabled={hasProgress}
                    className="p-2 border rounded-xl dark:bg-slate-900 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>
                
                <LocalizedDatePicker
                  value={editCycleStartDate}
                  onChange={setEditCycleStartDate}
                  locale={language}
                  disabled={hasProgress}
                  label={language === "en" ? "Reading Start Date" : "วันที่เปิดให้บันทึกได้"}
                  required
                />
                <LocalizedDatePicker
                  value={editCycleDueDate}
                  onChange={setEditCycleDueDate}
                  locale={language}
                  label={language === "en" ? "Reading Due Date" : "กำหนดส่งข้อมูล"}
                  required
                />

                {editCycleFormError && <div className="text-rose-500 font-semibold">{editCycleFormError}</div>}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCycleModal(false);
                      setSelectedCycleForEdit(null);
                    }}
                    className="px-4 py-2 border rounded-xl"
                  >
                    {language === "en" ? "Cancel" : "ยกเลิก"}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#D4AF37] text-white font-bold rounded-xl"
                  >
                    {language === "en" ? "Save" : "บันทึก"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      {/* Modal: Return Reading */}
      {showReturnModal && selectedReadingForReturn && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white">
              🔄 {language === "en" ? "Return Reading for Correction" : "ส่งกลับงานจดมิเตอร์ให้พนักงานแก้ไข"}
            </h3>
            <form onSubmit={handleReturnReading} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">
                  {language === "en" ? "Specify correction request note" : "ระบุสาเหตุ/รายละเอียดที่ต้องแก้ไข"}
                </label>
                <textarea
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  rows={4}
                  placeholder={language === "en" ? "e.g. Please verify the photo. Value seems low." : "เช่น เลขมิเตอร์ต่ำเกินไป กรุณาถ่ายภาพยืนยันใหม่"}
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedReadingForReturn(null);
                    setReturnNote("");
                  }}
                  className="px-4 py-2 border rounded-xl"
                >
                  {language === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 text-white font-bold rounded-xl"
                >
                  {language === "en" ? "Confirm Return" : "ยืนยันส่งกลับ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Meter */}
      {showCreateMeterModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl border dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              🗂️ {language === "en" ? "Register Unit Meter" : "ขึ้นทะเบียนมิเตอร์ใหม่"}
            </h3>
            <form onSubmit={handleCreateMeter} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Target Unit (Room)" : "ห้องชุด/ห้องพัก"}</label>
                <select
                  value={newMeterUnitId}
                  onChange={(e) => setNewMeterUnitId(e.target.value)}
                  className="p-2 border rounded-xl dark:bg-slate-900 outline-none"
                  required
                >
                  <option value="">{language === "en" ? "Select Room" : "เลือกห้อง"}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>Room {u.unit_number}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Utility Type" : "ประเภทมิเตอร์"}</label>
                <select
                  value={newMeterType}
                  onChange={(e) => setNewMeterType(e.target.value as "WATER" | "ELECTRICITY")}
                  className="p-2 border rounded-xl dark:bg-slate-900 outline-none"
                >
                  <option value="WATER">WATER</option>
                  <option value="ELECTRICITY">ELECTRICITY</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Meter Classification" : "ประเภทการขึ้นทะเบียน"}</label>
                <select
                  value={newMeterClassification}
                  onChange={(e) => {
                    const val = e.target.value as "LEGACY" | "NEW";
                    setNewMeterClassification(val);
                    if (val === "NEW") {
                      setNewMeterInstalledAt(new Date().toISOString().split("T")[0]);
                    } else {
                      setNewMeterInstalledAt("");
                    }
                  }}
                  className="p-2 border rounded-xl dark:bg-slate-900 outline-none"
                >
                  <option value="LEGACY">{language === "en" ? "LEGACY (Legacy meter installed before IRM)" : "LEGACY (มิเตอร์เดิมของโครงการก่อนระบบ IRM)"}</option>
                  <option value="NEW">{language === "en" ? "NEW (Replacement or new construction meter)" : "NEW (มิเตอร์สับเปลี่ยนทดแทน หรือมิเตอร์ตึกสร้างใหม่)"}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">
                  {language === "en" ? "Manufacturer Serial Number (Optional)" : "เลข Serial ผู้ผลิต (ระบุหรือไม่ก็ได้)"}
                </label>
                <input
                  type="text"
                  value={newMeterManufacturerSerial}
                  onChange={(e) => setNewMeterManufacturerSerial(e.target.value)}
                  placeholder={language === "en" ? "e.g. S123456" : "เช่น S123456"}
                  className="p-2 border rounded-xl dark:bg-slate-900"
                />
              </div>

              {newMeterClassification === "NEW" && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-400">
                    {language === "en" ? "Installed Date" : "วันที่เริ่มติดตั้งใช้งาน"}
                    <span className="text-rose-500 font-bold ml-1">*</span>
                  </label>
                  <input
                    type="date"
                    value={newMeterInstalledAt}
                    onChange={(e) => setNewMeterInstalledAt(e.target.value)}
                    className="p-2 border rounded-xl dark:bg-slate-900"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Initial Baseline Reading" : "เลขดัชนีเริ่มต้น"}</label>
                <input
                  type="number"
                  step="0.01"
                  value={newMeterInitialReading}
                  onChange={(e) => setNewMeterInitialReading(e.target.value)}
                  placeholder="e.g. 0.00"
                  className="p-2 border rounded-xl dark:bg-slate-900 font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Note (Optional)" : "หมายเหตุ (เพิ่มเติม)"}</label>
                <input
                  type="text"
                  value={newMeterNote}
                  onChange={(e) => setNewMeterNote(e.target.value)}
                  placeholder="e.g. Legitimate legacy meter confirmed"
                  className="p-2 border rounded-xl dark:bg-slate-900"
                />
              </div>

              {createMeterFormError && <div className="text-rose-500 font-semibold">{createMeterFormError}</div>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMeterModal(false);
                    setCreateMeterFormError(null);
                  }}
                  className="px-4 py-2 border rounded-xl"
                >
                  {language === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-white font-bold rounded-xl"
                >
                  {language === "en" ? "Submit" : "ตกลง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Replace Meter */}
      {selectedMeterForReplace && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-xl border dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              🔄 {language === "en" ? "Replace Meter Registry" : "ทำรายการสับเปลี่ยนมิเตอร์"}
            </h3>
            <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-700">
              <strong>Old Meter Code:</strong> {selectedMeterForReplace.meter_number} ({selectedMeterForReplace.utility_type})
            </div>
            <form onSubmit={handleReplaceMeter} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">
                  {language === "en" ? "Replacement Meter Manufacturer Serial (Optional)" : "เลข Serial ผู้ผลิต (มิเตอร์ตัวใหม่ - ระบุหรือไม่ก็ได้)"}
                </label>
                <input
                  type="text"
                  value={replacementManufacturerSerial}
                  onChange={(e) => setReplacementManufacturerSerial(e.target.value)}
                  placeholder="e.g. SN-998877"
                  className="p-2 border rounded-xl dark:bg-slate-900"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">
                  {language === "en" ? "Replacement Date" : "วันที่เปลี่ยนมิเตอร์"}
                  <span className="text-rose-500 font-bold ml-1">*</span>
                </label>
                <input
                  type="date"
                  value={replacementDate}
                  onChange={(e) => setReplacementDate(e.target.value)}
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">
                  {language === "en" ? "New Meter Starting Index" : "ตัวเลขเริ่มต้นจดของมิเตอร์ตัวใหม่"}
                  <span className="text-rose-500 font-bold ml-1">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={startingReading}
                  onChange={(e) => setStartingReading(e.target.value)}
                  placeholder="e.g. 0.00"
                  className="p-2 border rounded-xl dark:bg-slate-900 font-mono"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">
                  {language === "en" ? "Old Meter Final Reading" : "ตัวเลขจดครั้งสุดท้ายของมิเตอร์ตัวเก่า"}
                  <span className="text-rose-500 font-bold ml-1">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={finalReading}
                  onChange={(e) => setFinalReading(e.target.value)}
                  placeholder="e.g. 1250.00"
                  className="p-2 border rounded-xl dark:bg-slate-900 font-mono"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Replacement Reason" : "สาเหตุหลักการเปลี่ยนผ่านอุปกรณ์"}</label>
                <textarea
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  placeholder="e.g. Meter damaged"
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  required
                />
              </div>
              {replaceFormError && <div className="text-rose-500 font-semibold">{replaceFormError}</div>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMeterForReplace(null);
                    setReplaceFormError(null);
                  }}
                  className="px-4 py-2 border rounded-xl"
                >
                  {language === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-white font-bold rounded-xl"
                >
                  {language === "en" ? "Confirm Replace" : "ยืนยันการเปลี่ยน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal: Bulk Import Guide — replaces the removed Batch Bootstrap modal */}
      {showCoverageInfoPanel && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base">
                  {language === "en" ? "Bulk Meter Registration via Import" : "การขึ้นทะเบียนมิเตอร์จำนวนมากผ่าน Import"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === "en" ? "Step-by-step guide" : "ขั้นตอนการนำเข้าข้อมูล"}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                ⚠️ {language === "en"
                  ? "Meter serial numbers must be taken from your physical meter master list. The system does not generate or invent serial numbers."
                  : "เลขซีเรียลมิเตอร์ต้องมาจากทะเบียนมิเตอร์จริงของโครงการเท่านั้น ระบบไม่สร้างหรือกำหนดเลขมิเตอร์ขึ้นมาเอง"}
              </div>

              <ol className="space-y-2 list-decimal list-inside">
                <li>
                  <span className="font-semibold">{language === "en" ? "Go to Import tab" : "ไปที่แท็บ Import"}</span>
                  {" — "}{language === "en" ? "click the Import tab in the navigation above." : "คลิกที่แท็บ Import ด้านบน"}
                </li>
                <li>
                  <span className="font-semibold">{language === "en" ? "Download XLSX template" : "ดาวน์โหลดแบบฟอร์ม XLSX"}</span>
                  {" — "}{language === "en" ? "use the Export Template button to get the column structure." : "ใช้ปุ่ม Export Template เพื่อดาวน์โหลดโครงสร้างคอลัมน์"}
                </li>
                <li>
                  <span className="font-semibold">{language === "en" ? "Fill in real serial numbers" : "กรอกเลขซีเรียลจริง"}</span>
                  {" — "}{language === "en"
                    ? "populate room_number, utility_type (WATER or ELECTRICITY), and meter_number from your physical meter master."
                    : "กรอก room_number, utility_type (WATER หรือ ELECTRICITY) และ meter_number จากทะเบียนมิเตอร์จริง"}
                </li>
                <li>
                  <span className="font-semibold">{language === "en" ? "Upload and preview" : "อัพโหลดและตรวจสอบ"}</span>
                  {" — "}{language === "en" ? "the system will validate each row before import." : "ระบบจะตรวจสอบข้อมูลแต่ละแถวก่อนนำเข้า"}
                </li>
                <li>
                  <span className="font-semibold">{language === "en" ? "Confirm import" : "ยืนยันการนำเข้า"}</span>
                  {" — "}{language === "en" ? "only valid rows will be registered. Error rows are reported." : "เฉพาะแถวที่ถูกต้องจะถูกขึ้นทะเบียน แถวที่ผิดพลาดจะถูกรายงาน"}
                </li>
              </ol>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                💡 {language === "en"
                  ? "Rows with missing meter_number will be rejected. Duplicate serials and unknown room numbers will also be rejected. Units already metered are skipped (idempotent)."
                  : "แถวที่ไม่มี meter_number จะถูกปฏิเสธ เลขซีเรียลซ้ำและเลขห้องที่ไม่รู้จักก็จะถูกปฏิเสธด้วย ห้องที่มีมิเตอร์แล้วจะถูกข้ามโดยอัตโนมัติ"}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCoverageInfoPanel(false)}
                className="px-4 py-2 border rounded-xl text-slate-600 text-xs"
              >
                {language === "en" ? "Close" : "ปิด"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCoverageInfoPanel(false); setActiveTab("excel"); }}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition text-xs"
              >
                → {language === "en" ? "Go to Import tab" : "ไปที่แท็บ Import"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal: Utility Control Update */}
      {selectedUnitForControl && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white">
              🔌 {language === "en" ? "Manage Utility Line" : "ควบคุมสั่งการเปิด/ปิดท่อประปา-ไฟฟ้า"}
            </h3>
            <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-700">
              <strong>Room:</strong> {selectedUnitForControl.unit_number} | <strong>Control:</strong> {controlType}
            </div>
            <form onSubmit={handleControlStatusUpdate} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Set Operations State" : "ปรับเปลี่ยนสถานะการส่งสัญญาณ"}</label>
                <select
                  value={newControlStatus}
                  onChange={(e) => setNewControlStatus(e.target.value as UtilityControlType)}
                  className="p-2 border rounded-xl dark:bg-slate-900 outline-none"
                >
                  <option value="NORMAL">NORMAL (ใช้งานปกติ)</option>
                  <option value="SHUTOFF_REQUESTED">SHUTOFF_REQUESTED (สั่งระงับชั่วคราว)</option>
                  <option value="SHUT_OFF">SHUT_OFF (ระงับบริการแล้ว)</option>
                  <option value="RECONNECT_REQUESTED">RECONNECT_REQUESTED (เตรียมต่อเชื่อมสัญญาณ)</option>
                  <option value="RESTRICTED_NO_RECONNECT">RESTRICTED_NO_RECONNECT (ห้ามเปิดโดยไม่ได้รับอนุมัติ)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-400">{language === "en" ? "Reason" : "ระบุเหตุผลเพื่อบันทึกประวัติการสั่งงาน"}</label>
                <textarea
                  value={controlReason}
                  onChange={(e) => setControlReason(e.target.value)}
                  placeholder="e.g. Overdue payment shutoff"
                  className="p-2 border rounded-xl dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedUnitForControl(null)}
                  className="px-4 py-2 border rounded-xl"
                >
                  {language === "en" ? "Cancel" : "ยกเลิก"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#D4AF37] text-white font-bold rounded-xl"
                >
                  {language === "en" ? "Submit" : "ตกลง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
