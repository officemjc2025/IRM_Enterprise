"use client";

import React, { Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { Visitor } from "@/features/visitor/types/visitor.types";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";
import { Unit } from "@/features/unit/types/unit.types";

interface UnitWithProperties extends Unit {
  properties?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
  } | null;
}

function SecurityDashboardInner() {
  const { language } = useLanguage();
  
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"QUEUE" | "TODAY" | "HISTORY">("QUEUE");
  
  // Modal State
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      setError("");

      const [qRes, hRes, tRes] = await Promise.all([
        fetch("/api/v1/visitors?filter=queue"),
        fetch("/api/v1/visitors?filter=history"),
        fetch("/api/v1/visitors?filter=today"),
      ]);

      const qJson = await qRes.json();
      const hJson = await hRes.json();
      const tJson = await tRes.json();

      const all: Visitor[] = [];
      const idMap = new Set<string>();

      const addItems = (list: Visitor[]) => {
        list.forEach((item) => {
          if (!idMap.has(item.id)) {
            idMap.add(item.id);
            all.push(item);
          }
        });
      };

      if (qJson.success) addItems(qJson.data);
      if (hJson.success) addItems(hJson.data);
      if (tJson.success) addItems(tJson.data);

      setVisitors(all);
    } catch (err) {
      console.error(err);
      setError("Failed to retrieve visitor log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchVisitors();
    });
  }, []);

  const handleAction = async (id: string, actionType: "APPROVE" | "CHECK_IN" | "CHECK_OUT") => {
    try {
      let url = `/api/v1/visitors/${id}`;
      let method = "PUT";
      const payload: Record<string, unknown> = {};

      if (actionType === "APPROVE") {
        payload.status = "APPROVED";
      } else if (actionType === "CHECK_IN") {
        url = "/api/v1/visitors/check-in";
        method = "POST";
        payload.visitor_id = id;
      } else if (actionType === "CHECK_OUT") {
        url = "/api/v1/visitors/check-out";
        method = "POST";
        payload.visitor_id = id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        // If modal is open and matching this visitor, update it
        if (selectedVisitor && selectedVisitor.id === id) {
          const detailRes = await fetch(`/api/v1/visitors/${id}`);
          const detailJson = await detailRes.json();
          if (detailJson.success) {
            setSelectedVisitor(detailJson.data);
          }
        }
        fetchVisitors();
      } else {
        alert(json.message || "Action failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Search Filter Step: Search by Visitor Name, Room (Unit), Resident Name, Vehicle Plate, Visitor Code
  const searchedVisitors = visitors.filter((v) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;

    const visitorName = v.visitor_name.toLowerCase();
    const visitorCode = v.visitor_code.toLowerCase();
    const vehiclePlate = (v.vehicle_plate || "").toLowerCase();
    
    const unitNumber = (v.resident_assignment?.unit?.unit_number || "").toLowerCase();
    
    const residentName = v.resident_assignment?.person
      ? (v.resident_assignment.person.display_name || `${v.resident_assignment.person.first_name} ${v.resident_assignment.person.last_name}`).toLowerCase()
      : "";

    return (
      visitorName.includes(term) ||
      visitorCode.includes(term) ||
      vehiclePlate.includes(term) ||
      unitNumber.includes(term) ||
      residentName.includes(term)
    );
  });

  // 2. Tab Filter Step
  const todayStr = new Date().toISOString().split("T")[0];
  const tabFiltered = searchedVisitors.filter((v) => {
    if (activeTab === "QUEUE") {
      return ["CREATED", "APPROVED", "CHECKED_IN", "INSIDE"].includes(v.status);
    } else if (activeTab === "TODAY") {
      return v.visit_date === todayStr;
    } else {
      return ["CHECKED_OUT", "CLOSED", "CANCELLED"].includes(v.status);
    }
  });

  // Calculate quick stats
  const totalToday = visitors.filter((v) => v.visit_date === todayStr).length;
  const currentlyInside = visitors.filter((v) => v.status === "INSIDE").length;
  const pendingCheckIn = visitors.filter((v) => ["CREATED", "APPROVED"].includes(v.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={language === "en" ? "Security Control Dashboard" : "ระบบความปลอดภัยประตูเข้า-ออก"}
      />

      {/* Quick Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {language === "en" ? "Total Scheduled Today" : "ผู้เข้าติดต่อวันนี้ทั้งหมด"}
          </span>
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1 block">
            {totalToday}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {language === "en" ? "Currently Inside" : "อยู่ภายในโครงการในขณะนี้"}
          </span>
          <span className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1 block">
            {currentlyInside}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            {language === "en" ? "Pending Check-In" : "รอยืนยันสิทธิ์การเข้า"}
          </span>
          <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1 block">
            {pendingCheckIn}
          </span>
        </div>
      </div>

      {/* Search & Tabs Panel */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {(["QUEUE", "TODAY", "HISTORY"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  activeTab === tab
                    ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {tab === "QUEUE"
                  ? language === "en" ? "Live Queue" : "รายการรอตรวจสอบ (Live Queue)"
                  : tab === "TODAY"
                  ? language === "en" ? "Today's Schedule" : "คิววันนี้ทั้งหมด"
                  : language === "en" ? "Gate Logs (History)" : "ประวัติการเข้า-ออก"}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="w-full sm:w-72">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={language === "en" ? "Search visitors..." : "ค้นหาผู้มาติดต่อ..."}
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div className="p-4 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm w-full text-center">
          {error}
        </div>
      ) : tabFiltered.length === 0 ? (
        <EmptyState
          message={language === "en" ? "No visitor sessions found" : "ไม่พบประวัติการจอง/เข้าติดต่อในช่วงนี้"}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4">{language === "en" ? "Visitor Code" : "รหัส"}</th>
                  <th className="p-4">{language === "en" ? "Visitor" : "ผู้มาติดต่อ"}</th>
                  <th className="p-4">{language === "en" ? "Room" : "ห้องชุด/โครงการ"}</th>
                  <th className="p-4">{language === "en" ? "Resident" : "ผู้อยู่อาศัย"}</th>
                  <th className="p-4">{language === "en" ? "Plate" : "ทะเบียนรถ"}</th>
                  <th className="p-4">{language === "en" ? "Arrival (Scheduled)" : "เวลาเข้า (กำหนดการ)"}</th>
                  <th className="p-4">{language === "en" ? "Status" : "สถานะ"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "การจัดการ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {tabFiltered.map((v) => {
                  const residentName = v.resident_assignment?.person
                    ? v.resident_assignment.person.display_name || `${v.resident_assignment.person.first_name} ${v.resident_assignment.person.last_name || ""}`
                    : "-";
                  const unitWithProps = v.resident_assignment?.unit as UnitWithProperties | null | undefined;
                  const propertyName = unitWithProps?.properties
                    ? (language === "en" ? unitWithProps.properties.property_name_en || unitWithProps.properties.property_name_th : unitWithProps.properties.property_name_th)
                    : "-";

                  return (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {v.visitor_code}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {v.visitor_name}
                        </div>
                        {v.phone && <div className="text-xs text-slate-400 mt-0.5">📞 {v.phone}</div>}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {v.resident_assignment?.unit?.unit_number || "-"}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{propertyName}</div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {residentName}
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {v.vehicle_plate || "-"}
                      </td>
                      <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                        <div>{v.visit_date}</div>
                        {v.expected_arrival && (
                          <div className="font-semibold mt-0.5 text-slate-600 dark:text-slate-300">
                            ⏰ {new Date(v.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          v.status === "CREATED"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400"
                            : v.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                            : v.status === "INSIDE" || v.status === "CHECKED_IN"
                            ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-500"
                        }`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedVisitor(v)}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-300 transition"
                        >
                          {language === "en" ? "Details" : "รายละเอียด"}
                        </button>
                        
                        {v.status === "CREATED" && (
                          <button
                            onClick={() => handleAction(v.id, "APPROVE")}
                            className="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded transition shadow-sm"
                          >
                            {language === "en" ? "Approve" : "อนุมัติ"}
                          </button>
                        )}

                        {["CREATED", "APPROVED"].includes(v.status) && (
                          <button
                            onClick={() => handleAction(v.id, "CHECK_IN")}
                            className="px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded transition shadow-sm"
                          >
                            {language === "en" ? "Check In" : "แลกบัตรเข้า"}
                          </button>
                        )}

                        {["INSIDE", "CHECKED_IN"].includes(v.status) && (
                          <button
                            onClick={() => handleAction(v.id, "CHECK_OUT")}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded transition shadow-sm"
                          >
                            {language === "en" ? "Check Out" : "คืนบัตรออก"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visitor Session details overlay modal */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedVisitor(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Title */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Visitor Session Details" : "รายละเอียดเซสชันผู้เข้าติดต่อ"}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Code: {selectedVisitor.visitor_code}
              </p>
            </div>

            {/* Content List */}
            <div className="border-t border-b border-slate-100 dark:border-slate-700 py-4 space-y-3 text-sm">
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Visitor Name" : "ชื่อผู้เข้าติดต่อ"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedVisitor.visitor_name}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Phone" : "เบอร์โทรศัพท์"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedVisitor.phone || "-"}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Vehicle Plate" : "ทะเบียนรถ"}:</span>
                <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{selectedVisitor.vehicle_plate || "-"}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Room / Unit" : "ห้องชุด"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedVisitor.resident_assignment?.unit?.unit_number || "-"}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Resident" : "ผู้อยู่อาศัยที่เชิญ"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedVisitor.resident_assignment?.person
                    ? selectedVisitor.resident_assignment.person.display_name || `${selectedVisitor.resident_assignment.person.first_name} ${selectedVisitor.resident_assignment.person.last_name || ""}`
                    : "-"}
                </span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Visit Date" : "วันที่นัดหมาย"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedVisitor.visit_date}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Expected Time" : "เวลาคาดหมาย"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedVisitor.expected_arrival ? new Date(selectedVisitor.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                </span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Purpose" : "วัตถุประสงค์"}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedVisitor.purpose || "-"}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-400">{language === "en" ? "Status" : "สถานะปัจจุบัน"}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedVisitor.status}</span>
              </div>
              {selectedVisitor.remark && (
                <div className="grid grid-cols-2">
                  <span className="text-slate-400">{language === "en" ? "Remark" : "หมายเหตุ"}:</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedVisitor.remark}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2">
              {selectedVisitor.status === "CREATED" && (
                <button
                  onClick={() => handleAction(selectedVisitor.id, "APPROVE")}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition"
                >
                  {language === "en" ? "Approve" : "อนุมัติ"}
                </button>
              )}
              {["CREATED", "APPROVED"].includes(selectedVisitor.status) && (
                <button
                  onClick={() => handleAction(selectedVisitor.id, "CHECK_IN")}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition"
                >
                  {language === "en" ? "Check In" : "แลกบัตรเข้า"}
                </button>
              )}
              {["INSIDE", "CHECKED_IN"].includes(selectedVisitor.status) && (
                <button
                  onClick={() => handleAction(selectedVisitor.id, "CHECK_OUT")}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition"
                >
                  {language === "en" ? "Check Out" : "คืนบัตรออก"}
                </button>
              )}
              <button
                onClick={() => setSelectedVisitor(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {language === "en" ? "Close" : "ปิด"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecurityDashboardPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <SecurityDashboardInner />
      </Suspense>
    </MainLayout>
  );
}
