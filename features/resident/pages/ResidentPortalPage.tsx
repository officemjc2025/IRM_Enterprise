"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { useRouter } from "next/navigation";
import { Person } from "@/features/person/types/person.types";
import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";
import { Unit } from "@/features/unit/types/unit.types";
import { Announcement } from "@/features/announcement/types/announcement.types";
import { Visitor } from "@/features/visitor/types/visitor.types";

interface PropertyDetails {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
  address: string | null;
}

interface UnitWithPropertyDetails extends Unit {
  properties?: PropertyDetails | null;
  property_id: string;
}

interface PortalAssignment extends Omit<ResidentAssignment, "unit"> {
  unit?: UnitWithPropertyDetails | null;
}

interface PortalData {
  person: Person | null;
  assignment: PortalAssignment | null;
  role: string;
}

export default function ResidentPortalPage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [impersonateEmail, setImpersonateEmail] = useState("");
  const [activeImpersonation, setActiveImpersonation] = useState("");

  // Announcements State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Visitors State
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorTab, setVisitorTab] = useState<"UPCOMING" | "TODAY" | "HISTORY">("TODAY");
  
  // Visitor Request Form Modal State
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expectedArrival, setExpectedArrival] = useState("");
  const [purpose, setPurpose] = useState("");
  const [visitorError, setVisitorError] = useState("");
  const [visitorSaving, setVisitorSaving] = useState(false);

  const fetchData = async (emailToImpersonate?: string) => {
    try {
      setLoading(true);
      setError("");
      
      let portalUrl = "/api/v1/resident/portal";
      if (emailToImpersonate && emailToImpersonate.trim() !== "") {
        portalUrl += `?impersonate=${encodeURIComponent(emailToImpersonate.trim())}`;
      }
      
      const res = await fetch(portalUrl);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.message || "Failed to retrieve resident details");
      }

      // Fetch Announcements
      const annRes = await fetch("/api/v1/announcements?published_only=true");
      const annJson = await annRes.json();
      if (annJson.success) {
        setAnnouncements(annJson.data);
      }

      // Fetch Visitors
      const [qRes, hRes] = await Promise.all([
        fetch("/api/v1/visitors?filter=queue"),
        fetch("/api/v1/visitors?filter=history"),
      ]);
      const qJson = await qRes.json();
      const hJson = await hRes.json();
      let allVisitors: Visitor[] = [];
      if (qJson.success) allVisitors = allVisitors.concat(qJson.data);
      if (hJson.success) allVisitors = allVisitors.concat(hJson.data);
      setVisitors(allVisitors);
    } catch (err) {
      console.error("Error fetching resident portal data:", err);
      setError("An unexpected error occurred while loading your residence details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
  }, []);

  const handleImpersonateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveImpersonation(impersonateEmail);
    fetchData(impersonateEmail);
  };

  const handleClearImpersonate = () => {
    setImpersonateEmail("");
    setActiveImpersonation("");
    fetchData();
  };

  const getPropertyName = (assignment: PortalAssignment | null) => {
    if (!assignment?.unit?.properties) return "-";
    const p = assignment.unit.properties;
    return language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th;
  };

  const handleCancelVisitor = async (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to cancel this visitor request?" : "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกคำขอผู้มาติดต่อนี้?")) return;
    try {
      const res = await fetch(`/api/v1/visitors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData(activeImpersonation);
      } else {
        alert(json.message || "Failed to cancel request");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisitorError("");
    setVisitorSaving(true);

    if (!data?.assignment) {
      setVisitorError("No active residence assignment resolved.");
      setVisitorSaving(false);
      return;
    }

    try {
      let isoExpectedArrival = null;
      if (expectedArrival) {
        isoExpectedArrival = new Date(`${visitDate}T${expectedArrival}`).toISOString();
      }

      const payload = {
        resident_assignment_id: data.assignment.id,
        visitor_name: visitorName.trim(),
        phone: visitorPhone.trim() || null,
        vehicle_plate: vehiclePlate.trim() || null,
        visit_date: visitDate,
        expected_arrival: isoExpectedArrival,
        purpose: purpose.trim() || null,
      };

      const res = await fetch("/api/v1/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setShowVisitorModal(false);
        // Clear form
        setVisitorName("");
        setVisitorPhone("");
        setVehiclePlate("");
        setVisitDate(new Date().toISOString().split("T")[0]);
        setExpectedArrival("");
        setPurpose("");
        // Reload
        fetchData(activeImpersonation);
      } else {
        setVisitorError(json.message || "Failed to submit request");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setVisitorError(msg);
    } finally {
      setVisitorSaving(false);
    }
  };

  const isAdmin = data?.role === "admin" || data?.role === "super_admin" || data?.role === "property_admin";

  // Filter announcements matching the resident's property scope
  const targetPropertyId = data?.assignment?.unit?.property_id;
  const filteredAnnouncements = announcements
    .filter((ann) => {
      if (!ann.property_id) return true; // Show global announcements to everyone
      return ann.property_id === targetPropertyId; // Match property assignment
    })
    .slice(0, 5); // Limit to top 5

  // Filter visitors by tab groups
  const todayStr = new Date().toISOString().split("T")[0];
  const tabVisitors = visitors.filter((v) => {
    if (visitorTab === "TODAY") {
      return v.visit_date === todayStr && v.status !== "CLOSED" && v.status !== "CANCELLED";
    } else if (visitorTab === "UPCOMING") {
      return v.visit_date > todayStr && v.status !== "CLOSED" && v.status !== "CANCELLED";
    } else {
      return v.status === "CLOSED" || v.status === "CANCELLED" || v.visit_date < todayStr;
    }
  });

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
              {language === "en" ? "Resident Portal" : "พอร์ทัลผู้อยู่อาศัย"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === "en"
                ? "Access and manage your personal residency information."
                : "เข้าถึงและจัดการข้อมูลการอยู่อาศัยส่วนบุคคลของคุณ"}
            </p>
          </div>
        </div>

        {/* Impersonation Controls for Admin */}
        {data && isAdmin && (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                🛠️ Admin Impersonation Panel
              </span>
              {activeImpersonation && (
                <button
                  onClick={handleClearImpersonate}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 underline"
                >
                  Clear Impersonation
                </button>
              )}
            </div>
            <form onSubmit={handleImpersonateSubmit} className="flex gap-2 items-center">
              <input
                type="email"
                required
                placeholder="Enter resident email to impersonate..."
                value={impersonateEmail}
                onChange={(e) => setImpersonateEmail(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-600 transition"
              >
                Impersonate
              </button>
            </form>
            {activeImpersonation && (
              <p className="text-xs text-green-600 font-semibold">
                Currently impersonating: <span className="font-mono">{activeImpersonation}</span>
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">{t.common.loading}</div>
        ) : error ? (
          <div className="p-4 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm w-full text-center">
            {error}
          </div>
        ) : !data?.person ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-12 text-center space-y-4 shadow-sm">
            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl">
              🔍
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {language === "en" ? "No Profile Found" : "ไม่พบข้อมูลโปรไฟล์"}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {language === "en"
                ? "Your email address is not registered under any resident record in our database."
                : "ไม่พบที่อยู่อีเมลของคุณในการลงทะเบียนประวัติผู้อยู่อาศัยในระบบ"}
            </p>
          </div>
        ) : !data.assignment ? (
          <div className="space-y-6">
            {/* Header info with Profile navigation */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="flex items-center gap-4">
                {data.person.photo ? (
                  <img
                    src={data.person.photo}
                    alt={data.person.display_name || data.person.first_name}
                    className="w-16 h-16 rounded-full object-cover shadow"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xl text-slate-500 shadow">
                    {data.person.first_name[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {data.person.display_name || `${data.person.first_name} ${data.person.last_name}`}
                  </h3>
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">{data.person.person_code || "No Code"}</span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/persons/${data.person?.id}`)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {language === "en" ? "View Profile" : "ดูโปรไฟล์"}
              </button>
            </div>

            {/* Empty State requirement */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-12 text-center space-y-4 shadow-sm">
              <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl">
                🏡
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {language === "en" ? "No active residence found." : "ไม่พบประวัติผู้อยู่อาศัยที่มีผลงานอยู่"}
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                {language === "en"
                  ? "You do not have any active unit assignment currently mapped to your name."
                  : "คุณยังไม่มีประวัติการมอบหมายห้องชุดที่เปิดใช้งานในขณะนี้"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Welcome Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                {data.person.photo ? (
                  <img
                    src={data.person.photo}
                    alt={data.person.display_name || data.person.first_name}
                    className="w-20 h-20 rounded-full object-cover shadow"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-3xl text-slate-500 shadow">
                    {data.person.first_name[0]}
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {data.person.display_name || `${data.person.first_name} ${data.person.last_name}`}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                      ID: {data.person.person_code || "No Code"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {getPropertyName(data.assignment)} • Unit {data.assignment.unit?.unit_number}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <div className="flex flex-col gap-1 items-start md:items-end">
                  <span className="px-2 py-0.5 rounded font-medium text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {data.assignment.occupancy_type}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Status</span>
                  <span className="text-xs font-bold text-green-600 dark:text-green-400 mt-0.5">
                    ● {data.assignment.status}
                  </span>
                </div>
                <button
                  onClick={() => router.push(`/persons/${data.person?.id}`)}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10"
                >
                  {language === "en" ? "View Profile" : "ดูโปรไฟล์"}
                </button>
              </div>
            </div>

            {/* Latest Announcements Section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                  📢 {language === "en" ? "Latest Announcements" : "ข่าวประกาศล่าสุด"}
                </h4>
              </div>
              {filteredAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                  {language === "en" ? "No announcements published." : "ไม่มีข้อมูลข่าวประกาศเผยแพร่"}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      onClick={() => setSelectedAnnouncement(ann)}
                      className="py-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 px-2 rounded-lg transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {ann.is_pinned && (
                            <span className="text-sm" title="Pinned Announcement">📌</span>
                          )}
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm hover:text-[#D4AF37] dark:hover:text-[#D4AF37] transition">
                            {ann.title}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase ${
                            ann.priority === "URGENT"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                              : ann.priority === "HIGH"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
                              : ann.priority === "NORMAL"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400"
                          }`}>
                            {ann.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1 max-w-xl">
                          {ann.content}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {ann.publish_at ? new Date(ann.publish_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Visitors Section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                    🚗 {language === "en" ? "My Visitors" : "ผู้มาติดต่อของฉัน"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {language === "en" ? "Manage and request gate pass access codes." : "ขอรหัสอนุญาตผ่านทางประตูโครงการสำหรับผู้มาติดต่อ"}
                  </p>
                </div>
                <button
                  onClick={() => setShowVisitorModal(true)}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 transition"
                >
                  {language === "en" ? "+ Request Pass" : "+ ขอรหัสผ่านทาง"}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                {(["TODAY", "UPCOMING", "HISTORY"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setVisitorTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      visitorTab === tab
                        ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  >
                    {tab === "TODAY"
                      ? language === "en" ? "Today" : "วันนี้"
                      : tab === "UPCOMING"
                      ? language === "en" ? "Upcoming" : "ที่จะมาถึง"
                      : language === "en" ? "History" : "ประวัติการติดต่อ"}
                  </button>
                ))}
              </div>

              {/* Visitor List */}
              {tabVisitors.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
                  {language === "en" ? "No visitor requests found." : "ไม่มีข้อมูลผู้มาติดต่อ"}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {tabVisitors.map((v) => (
                    <div key={v.id} className="py-3.5 flex justify-between items-center text-sm gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                            {v.visitor_name}
                          </span>
                          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                            {v.visitor_code}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
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
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                          {v.phone && <span>📞 {v.phone}</span>}
                          {v.vehicle_plate && <span>🚗 {v.vehicle_plate}</span>}
                          <span>📅 {v.visit_date}</span>
                          {v.expected_arrival && (
                            <span>⏰ Expected: {new Date(v.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                        {v.purpose && (
                          <p className="text-xs text-slate-500 italic mt-1">
                            {language === "en" ? "Purpose" : "วัตถุประสงค์"}: {v.purpose}
                          </p>
                        )}
                      </div>
                      
                      {/* Cancel Request button (CREATED only) */}
                      {v.status === "CREATED" && (
                        <button
                          onClick={() => handleCancelVisitor(v.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-red-500 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition"
                        >
                          {language === "en" ? "Cancel" : "ยกเลิก"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Information Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: My Property */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="text-lg">🏢</span>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">
                    {language === "en" ? "My Property" : "โครงการของฉัน"}
                  </h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Property Name" : "ชื่อโครงการ"}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {getPropertyName(data.assignment)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Building" : "อาคาร"}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Building {data.assignment.unit?.building_code || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Unit" : "ห้องชุด"}
                    </span>
                    <span className="font-semibold font-mono text-slate-700 dark:text-slate-300">
                      {data.assignment.unit?.unit_number} (Floor {data.assignment.unit?.floor})
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: My Residency */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="text-lg">🏡</span>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">
                    {language === "en" ? "My Residency" : "การอยู่อาศัย"}
                  </h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Move In Date" : "วันที่ย้ายเข้า"}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {data.assignment.move_in_date}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Occupancy Type" : "ประเภทการอยู่อาศัย"}
                    </span>
                    <span className="px-2 py-0.5 rounded font-medium text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 inline-block mt-1">
                      {data.assignment.occupancy_type}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Primary Resident" : "ผู้อยู่อาศัยหลัก"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-xs inline-block mt-1 ${
                        data.assignment.primary_resident
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                      }`}
                    >
                      {data.assignment.primary_resident ? t.residentAssignment.yes : t.residentAssignment.no}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: My Contact */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="text-lg">📞</span>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">
                    {language === "en" ? "My Contact" : "ข้อมูลติดต่อ"}
                  </h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Phone" : "เบอร์โทรศัพท์"}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {data.person.phone || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === "en" ? "Email" : "อีเมล"}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 break-all">
                      {data.person.email || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Announcement Modal Overlay */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-xl w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
              aria-label="Close modal"
            >
              ✕
            </button>
            <div className="space-y-2 pr-6">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedAnnouncement.is_pinned && (
                  <span className="text-sm">📌 Pinned</span>
                )}
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                  selectedAnnouncement.priority === "URGENT"
                    ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                    : selectedAnnouncement.priority === "HIGH"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
                    : selectedAnnouncement.priority === "NORMAL"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}>
                  {selectedAnnouncement.priority} Priority
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                  {selectedAnnouncement.publish_at ? new Date(selectedAnnouncement.publish_at).toLocaleString() : ""}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {selectedAnnouncement.title}
              </h3>
            </div>
            <div className="border-t border-b border-slate-100 dark:border-slate-700 py-4 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedAnnouncement.content}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-sm font-semibold rounded-lg transition"
              >
                {language === "en" ? "Close" : "ปิด"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visitor Request Pass Modal */}
      {showVisitorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowVisitorModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
              aria-label="Close modal"
            >
              ✕
            </button>
            
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Request Visitor Pass" : "ขอรหัสผ่านทางสำหรับผู้มาติดต่อ"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "en" ? "Generate a code for your expected visitor." : "กรอกข้อมูลเพื่อรับรหัสผ่านทางสำหรับผู้ที่จะเข้ามาพบคุณ"}
              </p>
            </div>

            <form onSubmit={handleVisitorSubmit} className="space-y-4">
              {visitorError && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {visitorError}
                </div>
              )}

              {/* Visitor Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Visitor Name" : "ชื่อผู้มาติดต่อ"}
                </label>
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="John Doe"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Phone Number" : "เบอร์โทรศัพท์"}
                </label>
                <input
                  type="text"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  placeholder="0812345678"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Vehicle Plate */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Vehicle Plate" : "ทะเบียนรถ"}
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="กข 1234"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Visit Date & Expected Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Visit Date" : "วันที่มาติดต่อ"}
                  </label>
                  <input
                    type="date"
                    required
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Expected Arrival" : "เวลาที่คาดว่าจะมาถึง"}
                  </label>
                  <input
                    type="time"
                    value={expectedArrival}
                    onChange={(e) => setExpectedArrival(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Purpose of Visit" : "วัตถุประสงค์"}
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={language === "en" ? "e.g. Delivery, Friend, Maintenance" : "เช่น ส่งอาหาร, เยี่ยมเพื่อน, ซ่อมไฟ"}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Submit buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowVisitorModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={visitorSaving}
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 disabled:opacity-50 transition"
                >
                  {visitorSaving ? t.common.processing : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
