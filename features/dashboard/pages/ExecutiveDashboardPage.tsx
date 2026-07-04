"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useLanguage } from "@/providers/LanguageProvider";
import { useRouter } from "next/navigation";
import { PageHeader, LoadingState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";

interface DashboardStats {
  todaysOperations: {
    visitorsWaitingApproval: number;
    visitorsInside: number;
    workOrdersWaitingAssignment: number;
    workOrdersInProgress: number;
    announcementsExpiringSoon: number;
    documentsPublishedThisWeek: number;
  };
  propertyOverview: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    totalOwners: number;
    totalResidents: number;
  };
  visitors: {
    today: number;
    checkedIn: number;
    checkedOut: number;
    currentlyInside: number;
    cancelled: number;
  };
  workOrders: {
    new: number;
    assigned: number;
    inProgress: number;
    completedToday: number;
    overdue: number;
  };
  recentActivities: Array<{
    id: string;
    timestamp: string;
    title: string;
    description: string;
  }>;
}

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Quick Action Modal States
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFilePath, setDocFilePath] = useState("");
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState("");

  const checkRoleAndLoadStats = async () => {
    try {
      setLoading(true);
      setError("");

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push("/login");
        return;
      }

      // Query user role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = profile?.role || "resident";

      // Redirect resident roles to resident portal page
      if (userRole === "resident" || userRole === "owner" || userRole === "co_owner" || userRole === "tenant") {
        router.push("/resident");
        return;
      }

      // Redirect security to security dashboard
      if (userRole === "security") {
        router.push("/security");
        return;
      }

      // Redirect technician to work orders
      if (userRole === "technician") {
        router.push("/work-orders");
        return;
      }

      // Redirect housekeeping to login (since no workspace exists)
      if (userRole === "housekeeping") {
        router.push("/login");
        return;
      }

      // Fetch dashboard operational metrics
      const res = await fetch("/api/v1/dashboard/executive");
      const json = await res.json();

      if (json.success) {
        setStats(json.data);
      } else {
        setError(json.message || "Failed to load operations statistics.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred while loading metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      checkRoleAndLoadStats();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocError("");
    setDocSaving(true);

    if (!docTitle.trim()) {
      setDocError("Document title is required.");
      setDocSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: docTitle.trim(),
          file_path: docFilePath.trim() || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowDocModal(false);
        setDocTitle("");
        setDocFilePath("");
        checkRoleAndLoadStats();
        alert(language === "en" ? "Document published successfully" : "อัปโหลดเอกสารเสร็จสิ้น");
      } else {
        setDocError(json.message || "Failed to save document record.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setDocError(msg);
    } finally {
      setDocSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <LoadingState />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="p-4 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm text-center">
          {error}
        </div>
      </MainLayout>
    );
  }

  if (!stats) return null;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title={language === "en" ? "Executive Operations Dashboard" : "แดชบอร์ดควบคุมการดำเนินงานนิติบุคคล"}
        />

        {/* 1. Today's Operations Header Summary */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
          <h3 className="text-base font-bold uppercase tracking-wider text-[#D4AF37] mb-4">
            🔥 {language === "en" ? "Today's Operation Center" : "ศูนย์ควบคุมการทำงานประจำวัน"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
            <div>
              <span className="text-2xl font-bold block text-yellow-400">{stats.todaysOperations.visitorsWaitingApproval}</span>
              <span className="text-xs text-slate-400 mt-1 block">{language === "en" ? "Visits Pending" : "คำขออนุมัติผู้มาติดต่อ"}</span>
            </div>
            <div>
              <span className="text-2xl font-bold block text-green-400">{stats.todaysOperations.visitorsInside}</span>
              <span className="text-xs text-slate-400 mt-1 block">{language === "en" ? "Visitors Inside" : "ผู้ติดต่ออยู่ภายใน"}</span>
            </div>
            <div>
              <span className="text-2xl font-bold block text-orange-400">{stats.todaysOperations.workOrdersWaitingAssignment}</span>
              <span className="text-xs text-slate-400 mt-1 block">{language === "en" ? "WO Unassigned" : "ใบงานค้างมอบหมาย"}</span>
            </div>
            <div>
              <span className="text-2xl font-bold block text-blue-400">{stats.todaysOperations.workOrdersInProgress}</span>
              <span className="text-xs text-slate-400 mt-1 block">{language === "en" ? "WO In Progress" : "ใบงานกำลังซ่อม"}</span>
            </div>
            <div>
              <span className="text-2xl font-bold block text-purple-400">{stats.todaysOperations.announcementsExpiringSoon}</span>
              <span className="text-xs text-slate-400 mt-1 block">{language === "en" ? "Announcements Expiring" : "ประกาศกำลังจะหมดอายุ"}</span>
            </div>
            <div>
              <span className="text-2xl font-bold block text-pink-400">{stats.todaysOperations.documentsPublishedThisWeek}</span>
              <span className="text-xs text-slate-400 mt-1 block">{language === "en" ? "Docs This Week" : "เอกสารอัปโหลดสัปดาห์นี้"}</span>
            </div>
          </div>
        </section>

        {/* Grid Splits: Overview, Visitors, Work Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 2. Property Overview */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
              🏢 {language === "en" ? "Property & Real Estate Overview" : "สรุปข้อมูลอสังหาริมทรัพย์และห้องชุด"}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">{language === "en" ? "Total Units" : "ห้องชุดทั้งหมด"}</span>
                <span className="text-xl font-bold mt-1 block text-slate-800 dark:text-slate-100">{stats.propertyOverview.totalUnits}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">{language === "en" ? "Occupancy Rate" : "อัตราการอยู่อาศัย"}</span>
                <span className="text-xl font-bold mt-1 block text-green-600 dark:text-green-400">{stats.propertyOverview.occupancyRate}%</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">{language === "en" ? "Occupied Units" : "มีผู้อยู่อาศัยแล้ว"}</span>
                <span className="text-lg font-bold mt-1 block text-slate-800 dark:text-slate-100">{stats.propertyOverview.occupiedUnits}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">{language === "en" ? "Vacant Units" : "ห้องว่าง"}</span>
                <span className="text-lg font-bold mt-1 block text-slate-800 dark:text-slate-100">{stats.propertyOverview.vacantUnits}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">{language === "en" ? "Co-Owners" : "เจ้าของร่วม"}</span>
                <span className="text-lg font-bold mt-1 block text-slate-800 dark:text-slate-100">{stats.propertyOverview.totalOwners}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">{language === "en" ? "Residents" : "ผู้อยู่อาศัย"}</span>
                <span className="text-lg font-bold mt-1 block text-slate-800 dark:text-slate-100">{stats.propertyOverview.totalResidents}</span>
              </div>
            </div>
          </div>

          {/* 3. Visitors Operational Stats */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
              🚗 {language === "en" ? "Visitor Gate Operations" : "รายงานผู้ผ่านเข้า-ออกโครงการ"}
            </h4>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Today's Schedule Requests" : "กำหนดเข้าพบวันนี้ทั้งหมด"}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{stats.visitors.today}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Checked In at Gate" : "แลกบัตรและสแกนเข้าแล้ว"}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{stats.visitors.checkedIn}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Checked Out" : "คืนบัตรและออกจากโครงการ"}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{stats.visitors.checkedOut}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Currently Inside" : "อยู่ภายในโครงการขณะนี้"}:</span>
                <span className="font-bold text-green-600 dark:text-green-400">{stats.visitors.currentlyInside}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Cancelled Requests" : "ยกเลิกคิว"}:</span>
                <span className="font-bold text-red-500">{stats.visitors.cancelled}</span>
              </div>
            </div>
            <button
              onClick={() => router.push("/security")}
              className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-900 text-xs font-bold rounded-lg text-slate-700 dark:text-slate-300 transition mt-2 block"
            >
              {language === "en" ? "Open Security Gate Queue" : "เปิดตรวจสอบประตูเข้า-ออกโครงการ"}
            </button>
          </div>

          {/* 4. Work Orders Operational Stats */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
              🔧 {language === "en" ? "Maintenance & Work Orders" : "รายงานการแจ้งซ่อมแซมและบำรุงรักษา"}
            </h4>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "New Submissions" : "คำร้องมาใหม่"}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{stats.workOrders.new}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Assigned Work" : "มอบหมายช่างแล้ว"}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{stats.workOrders.assigned}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "In Progress" : "ช่างกำลังซ่อมแซม"}:</span>
                <span className="font-bold text-blue-500">{stats.workOrders.inProgress}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Completed Today" : "ทำเสร็จสิ้นวันนี้"}:</span>
                <span className="font-bold text-green-600 dark:text-green-400">{stats.workOrders.completedToday}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "en" ? "Overdue (Expired)" : "เกิดกำหนดส่งมอบงาน"}:</span>
                <span className="font-bold text-red-500">{stats.workOrders.overdue}</span>
              </div>
            </div>
            <button
              onClick={() => router.push("/work-orders")}
              className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-900 text-xs font-bold rounded-lg text-slate-700 dark:text-slate-300 transition mt-2 block"
            >
              {language === "en" ? "Manage Technician Tickets" : "เปิดประวัติสั่งงานช่างและมอบหมายคิว"}
            </button>
          </div>

        </div>

        {/* Lower Grid splits: Recent Activities and Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 5. Recent Activities Logs */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
              ⏱️ {language === "en" ? "Live Activity Logs" : "บันทึกเหตุการณ์และความเคลื่อนไหวในโครงการ"}
            </h4>
            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
              {stats.recentActivities.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-12">
                  {language === "en" ? "No activities recorded." : "ไม่มีบันทึกประวัติเหตุการณ์"}
                </p>
              ) : (
                stats.recentActivities.map((act, idx) => (
                  <div key={act.id + idx} className="flex gap-4 items-start text-xs border-b border-slate-50 dark:border-slate-900 pb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 flex-shrink-0" />
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block text-[13px]">{act.title}</span>
                      <p className="text-slate-500 leading-relaxed text-xs">{act.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 6. Quick Actions Grid */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
              ⚡ {language === "en" ? "Operational Quick Actions" : "ระบบทางลัดการควบคุม (Quick Actions)"}
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => router.push("/import")}
                className="w-full text-left px-4 py-3 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition flex items-center gap-3 text-sm font-semibold"
              >
                <span className="text-base">📥</span>
                <span>{language === "en" ? "Import Master Data" : "นำเข้าข้อมูลดิบหลัก (Import)"}</span>
              </button>
              
              <button
                onClick={() => router.push("/announcements/create")}
                className="w-full text-left px-4 py-3 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition flex items-center gap-3 text-sm font-semibold"
              >
                <span className="text-base">📢</span>
                <span>{language === "en" ? "Create Announcement" : "ประกาศข่าวสารนิติบุคคล"}</span>
              </button>

              <button
                onClick={() => setShowDocModal(true)}
                className="w-full text-left px-4 py-3 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition flex items-center gap-3 text-sm font-semibold"
              >
                <span className="text-base">📄</span>
                <span>{language === "en" ? "Upload Document" : "อัปโหลดหนังสือทางการ / ใบเสร็จ"}</span>
              </button>

              <button
                onClick={() => router.push("/security")}
                className="w-full text-left px-4 py-3 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition flex items-center gap-3 text-sm font-semibold"
              >
                <span className="text-base">🚗</span>
                <span>{language === "en" ? "Register Visitor" : "ลงทะเบียนแลกบัตรผู้มาติดต่อ"}</span>
              </button>

              <button
                onClick={() => router.push("/work-orders")}
                className="w-full text-left px-4 py-3 border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition flex items-center gap-3 text-sm font-semibold"
              >
                <span className="text-base">🔧</span>
                <span>{language === "en" ? "Open Work Order" : "เปิดสั่งใบงานการซ่อมแซม"}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Upload Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowDocModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg outline-none font-bold"
            >
              ✕
            </button>
            
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {language === "en" ? "Register Official Document" : "อัปโหลดและลงทะเบียนเอกสารนิติบุคคล"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "en" ? "Publish regulatory documents, circulars, or financial reports." : "กรอกข้อมูลเพื่อลงทะเบียนเอกสาร ประกาศ และข้อบังคับทางการ"}
              </p>
            </div>

            <form onSubmit={handleDocSubmit} className="space-y-4">
              {docError && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {docError}
                </div>
              )}

              {/* Title */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === "en" ? "Document Title" : "ชื่อเอกสาร / หัวข้อ"}</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={language === "en" ? "e.g. Annual Budget Report 2026" : "เช่น รายงานสรุปบัญชีประจำปี 2569"}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* File Path */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{language === "en" ? "File Path URL" : "ลิงก์ไฟล์เอกสาร / ที่อยู่ไฟล์"}</label>
                <input
                  type="text"
                  value={docFilePath}
                  onChange={(e) => setDocFilePath(e.target.value)}
                  placeholder="/docs/reports/annual_budget_2026.pdf"
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={docSaving}
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 disabled:opacity-50 transition"
                >
                  {docSaving ? "Saving..." : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
