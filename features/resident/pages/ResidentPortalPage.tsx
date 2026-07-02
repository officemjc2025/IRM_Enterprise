"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { useRouter } from "next/navigation";
import { Person } from "@/features/person/types/person.types";
import { ResidentAssignment } from "@/features/resident-assignment/types/resident-assignment.types";
import { Unit } from "@/features/unit/types/unit.types";
import { Announcement } from "@/features/announcement/types/announcement.types";

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

  const isAdmin = data?.role === "admin" || data?.role === "super_admin" || data?.role === "property_admin";

  // Filter announcements matching the resident's property scope
  const targetPropertyId = data?.assignment?.unit?.property_id;
  const filteredAnnouncements = announcements
    .filter((ann) => {
      if (!ann.property_id) return true; // Show global announcements to everyone
      return ann.property_id === targetPropertyId; // Match property assignment
    })
    .slice(0, 5); // Limit to top 5

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
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
              aria-label="Close modal"
            >
              ✕
            </button>

            {/* Modal Header */}
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

            {/* Modal Content */}
            <div className="border-t border-b border-slate-100 dark:border-slate-700 py-4 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedAnnouncement.content}
              </p>
            </div>

            {/* Modal Footer */}
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
    </MainLayout>
  );
}
