"use client";

import React, { useEffect, useState, useContext, useMemo, useCallback } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { AuthContext } from "@/providers/AuthProvider";
import { PageHeader, LoadingState, SearchInput } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { WorkOrder } from "@/features/work-order/types/work-order.types";
import { FiCheckCircle, FiUpload, FiPlay, FiCheck } from "react-icons/fi";
import { useRouter } from "next/navigation";

// Bangkok Timezone Helpers
function getBangkokParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map(p => [p.type, p.value]));
  
  return {
    year: parseInt(map.get("year") || "0", 10),
    month: parseInt(map.get("month") || "0", 10) - 1, // 0-indexed
    day: parseInt(map.get("day") || "0", 10),
    hour: parseInt(map.get("hour") || "0", 10),
    minute: parseInt(map.get("minute") || "0", 10),
    second: parseInt(map.get("second") || "0", 10),
  };
}

function formatBangkokDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  const parts = getBangkokParts(date);
  const monthsTh = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  return `${parts.day} ${monthsTh[parts.month]} ${parts.year + 543} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

interface UnifiedStaffWorkspaceProps {
  workspace: "housekeeping" | "technician" | "security" | "office";
  view: string;
}

export default function UnifiedStaffWorkspace({ workspace, view }: UnifiedStaffWorkspaceProps) {
  const auth = useContext(AuthContext);
  const router = useRouter();
  const supabase = createClient();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  
  // Drawer state
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [remark, setRemark] = useState("");

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Calendar View states
  const [calendarTab, setCalendarTab] = useState<"DAY" | "WEEK" | "MONTH">("WEEK");
  const [activeDate, setActiveDate] = useState(() => new Date());

  // Supplies placeholder state
  const [suppliesRequested, setSuppliesRequested] = useState(false);

  const currentUserId = auth?.user?.id;

  // Authorization Check
  useEffect(() => {
    if (!auth?.loading) {
      if (!auth?.user) {
        router.replace("/login");
        return;
      }
      
      const roleStr = String(auth?.profile?.role).toLowerCase();
      // super_admin & admin can bypass role checking
      if (roleStr !== "super_admin" && roleStr !== "admin") {
        if (workspace === "housekeeping" && roleStr !== "housekeeping") {
          queueMicrotask(() => setError("คุณไม่ได้รับอนุญาตให้เข้าถึงพื้นที่ทำงานนี้"));
        }
        if (workspace === "technician" && roleStr !== "technician") {
          queueMicrotask(() => setError("คุณไม่ได้รับอนุญาตให้เข้าถึงพื้นที่ทำงานนี้"));
        }
        if (workspace === "security" && roleStr !== "security") {
          queueMicrotask(() => setError("คุณไม่ได้รับอนุญาตให้เข้าถึงพื้นที่ทำงานนี้"));
        }
        if (workspace === "office" && roleStr !== "office") {
          queueMicrotask(() => setError("คุณไม่ได้รับอนุญาตให้เข้าถึงพื้นที่ทำงานนี้"));
        }
      }
    }
  }, [auth, workspace, router]);

  // Fetch Work Orders
  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/work-orders");
      const json = await res.json();
      if (json.success) {
        setWorkOrders(json.data || []);
      }
    } catch (err) {
      console.error(err);
      setError("โหลดข้อมูลใบงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!error) {
      queueMicrotask(() => {
        fetchWorkOrders();
      });
    }
  }, [error, fetchWorkOrders]);

  // Filtered orders according to workspace category/team
  const workspaceOrders = useMemo(() => {
    const isHousekeeper = workspace === "housekeeping";
    const isTechnician = workspace === "technician";
    
    return workOrders.filter((wo) => {
      if (isHousekeeper) {
        return wo.service_team === "HOUSEKEEPING";
      }
      if (isTechnician) {
        return wo.service_team === "TECHNICIAN";
      }
      return true;
    });
  }, [workOrders, workspace]);

  // Search Filter
  const searchedOrders = useMemo(() => {
    return workspaceOrders.filter((wo) => {
      const code = (wo.work_order_code || "").toLowerCase();
      const title = (wo.title || "").toLowerCase();
      const desc = (wo.description || "").toLowerCase();
      const unit = (wo.unit?.unit_number || "").toLowerCase();
      const term = searchTerm.toLowerCase().trim();

      if (!term) return true;
      return code.includes(term) || title.includes(term) || desc.includes(term) || unit.includes(term);
    });
  }, [workspaceOrders, searchTerm]);

  // Summary Metrics calculations
  const summary = useMemo(() => {
    const now = new Date();

    const myJobs = workspaceOrders.filter(o => o.assigned_to === currentUserId && o.status !== "CLOSED" && o.status !== "CANCELLED");
    const assignedJobs = workspaceOrders.filter(o => o.assigned_to === currentUserId && o.status === "ASSIGNED");
    const unclaimedJobs = workspaceOrders.filter(o => !o.assigned_to && o.status === "NEW");
    
    const newJobs = workspaceOrders.filter(o => o.status === "NEW");
    const inProgressJobs = workspaceOrders.filter(o => o.status === "IN_PROGRESS");
    const completedJobs = workspaceOrders.filter(o => o.status === "COMPLETED");
    const closedJobs = workspaceOrders.filter(o => o.status === "CLOSED");
    
    const overdueJobs = workspaceOrders.filter(o => {
      if (o.status === "CLOSED" || o.status === "CANCELLED" || o.status === "COMPLETED") return false;
      if (!o.scheduled_at) return false;
      return new Date(o.scheduled_at).getTime() < now.getTime();
    });

    return {
      myJobs: myJobs.length,
      assigned: assignedJobs.length,
      unclaimed: unclaimedJobs.length,
      new: newJobs.length,
      inProgress: inProgressJobs.length,
      completed: completedJobs.length,
      closed: closedJobs.length,
      overdue: overdueJobs.length
    };
  }, [workspaceOrders, currentUserId]);

  // Notifications calculation
  const notifications = useMemo(() => {
    const now = new Date();
    const newCount = workspaceOrders.filter(o => o.status === "NEW").length;
    const urgentCount = workspaceOrders.filter(o => o.priority === "URGENT").length;
    
    const nearTimeCount = workspaceOrders.filter(o => {
      if (o.status === "CLOSED" || o.status === "CANCELLED" || o.status === "COMPLETED") return false;
      if (!o.scheduled_at) return false;
      const diffMs = new Date(o.scheduled_at).getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 2;
    }).length;

    return {
      newJobs: newCount,
      urgentJobs: urgentCount,
      nearTimeJobs: nearTimeCount
    };
  }, [workspaceOrders]);

  // Action: Accept / Claim job
  const handleClaimJob = async (order: WorkOrder) => {
    setActionSuccess("");
    try {
      const res = await fetch(`/api/v1/work-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ASSIGNED",
          assigned_to: currentUserId,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: currentUserId
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      
      setActionSuccess("รับงานสำเร็จเรียบร้อยแล้ว");
      setSelectedOrder(json.data);
      fetchWorkOrders();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการรับงาน");
    }
  };

  // Action: Start job
  const handleStartJob = async (order: WorkOrder) => {
    setActionSuccess("");
    try {
      const res = await fetch(`/api/v1/work-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          started_at: new Date().toISOString()
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccess("เริ่มงานทำความสะอาดเรียบร้อยแล้ว");
      setSelectedOrder(json.data);
      fetchWorkOrders();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเริ่มงาน");
    }
  };

  // Action: Upload Photo stage
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, stage: "BEFORE" | "AFTER") => {
    if (!selectedOrder || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (stage === "BEFORE") setUploadingBefore(true);
    else setUploadingAfter(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("photo_stage", stage);

      const res = await fetch(`/api/v1/work-orders/${selectedOrder.id}/photos`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      // Reload order details to refresh photos list
      const detailsRes = await fetch(`/api/v1/work-orders/${selectedOrder.id}`);
      const detailsJson = await detailsRes.json();
      if (detailsJson.success) {
        setSelectedOrder(detailsJson.data);
      }
      fetchWorkOrders();
      setActionSuccess("อัปโหลดรูปภาพสำเร็จ");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
    } finally {
      setUploadingBefore(false);
      setUploadingAfter(false);
    }
  };

  // Action: Complete job (sets status to COMPLETED/waiting for check)
  const handleCompleteJob = async (order: WorkOrder) => {
    setActionSuccess("");
    try {
      const res = await fetch(`/api/v1/work-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
          worker_remark: remark || null
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccess("ส่งงานทำความสะอาดเรียบร้อยแล้ว รอตรวจงาน");
      setSelectedOrder(json.data);
      setRemark("");
      fetchWorkOrders();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งงาน");
    }
  };

  // Map database status/priority keys to Thai
  const getStatusLabel = (s: string) => {
    switch (s) {
      case "NEW": return "ใหม่";
      case "ASSIGNED": return "รับงานแล้ว";
      case "IN_PROGRESS": return "กำลังทำ";
      case "COMPLETED": return "รอตรวจ";
      case "CLOSED": return "เสร็จสิ้น";
      case "CANCELLED": return "ยกเลิก";
      default: return s;
    }
  };

  const getStatusStyle = (s: string) => {
    switch (s) {
      case "NEW": return "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-200/30";
      case "ASSIGNED": return "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/30";
      case "IN_PROGRESS": return "bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border border-orange-200/30";
      case "COMPLETED": return "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-200/30";
      case "CLOSED": return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/30";
      default: return "bg-slate-50 text-slate-700 dark:bg-slate-950/20 dark:text-slate-400 border border-slate-200/30";
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case "LOW": return "ต่ำ";
      case "NORMAL": return "ปกติ";
      case "HIGH": return "สูง";
      case "URGENT": return "ด่วน";
      default: return p;
    }
  };

  const getPriorityStyle = (p: string) => {
    switch (p) {
      case "URGENT": return "text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded-lg border border-rose-200/40";
      case "HIGH": return "text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-1.5 py-0.5 rounded-lg border border-orange-200/40";
      default: return "text-slate-650 dark:text-slate-350 bg-slate-50 dark:bg-slate-950/20 px-1.5 py-0.5 rounded-lg border border-slate-200/20";
    }
  };

  // Signed URL loader helper for photos
  const PhotoLoader = ({ path }: { path: string }) => {
    const [signedUrl, setSignedUrl] = useState("");
    useEffect(() => {
      supabase.storage.from("work-orders").createSignedUrl(path, 3600).then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    }, [path]);

    if (!signedUrl) return <div className="w-full h-24 bg-slate-100 dark:bg-slate-900 animate-pulse rounded-lg border border-slate-200 dark:border-slate-800" />;
    return <img src={signedUrl} alt="stage" className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-800" />;
  };

  if (loading && workOrders.length === 0) {
    return (
      <MainLayout>
        <LoadingState message="กำลังโหลดข้อมูล..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto mt-12 p-8 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="text-3xl">⚠️</div>
          <h3 className="text-lg font-bold">ไม่ได้รับสิทธิ์</h3>
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title={workspace === "housekeeping" ? "ศูนย์ปฏิบัติงานแม่บ้าน" : workspace === "technician" ? "ศูนย์ปฏิบัติงานช่าง" : "ศูนย์ปฏิบัติงานเจ้าหน้าที่"} />

        {/* Real-time top notification alerts bar */}
        {(notifications.newJobs > 0 || notifications.urgentJobs > 0 || notifications.nearTimeJobs > 0) && (
          <div className="flex flex-wrap gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs font-semibold text-amber-600 dark:text-amber-400 items-center shadow-sm">
            <span className="text-sm">🔔</span>
            <div className="flex gap-4">
              {notifications.newJobs > 0 && (
                <span>งานใหม่: <strong className="font-bold underline">{notifications.newJobs} งาน</strong></span>
              )}
              {notifications.urgentJobs > 0 && (
                <span>งานด่วน: <strong className="font-bold underline text-rose-500">{notifications.urgentJobs} งาน</strong></span>
              )}
              {notifications.nearTimeJobs > 0 && (
                <span>งานใกล้ถึงเวลา: <strong className="font-bold underline text-orange-500">{notifications.nearTimeJobs} งาน</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Top Summary Metrics Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">งานของฉัน</span>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1 block">{summary.myJobs}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">งานที่ได้รับมอบหมาย</span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1 block">{summary.assigned}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">งานที่ยังไม่มีผู้รับ</span>
            <span className="text-lg font-bold text-amber-650 dark:text-amber-450 mt-1 block">{summary.unclaimed}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">งานใหม่</span>
            <span className="text-lg font-bold text-teal-600 dark:text-teal-400 mt-1 block">{summary.new}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">กำลังดำเนินการ</span>
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1 block">{summary.inProgress}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">รอตรวจ</span>
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-1 block">{summary.completed}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">เสร็จแล้ว</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{summary.closed}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider text-rose-500">เกิน SLA (เลยกำหนด)</span>
            <span className="text-lg font-bold text-rose-600 dark:text-rose-450 mt-1 block">{summary.overdue}</span>
          </div>
        </div>

        {/* Subview Renders */}
        {view === "dashboard" && (
          <div className="space-y-6">
            {/* Search/Filter header */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">รายการงานวันนี้</span>
              <div className="w-full md:w-80">
                <SearchInput placeholder="ค้นหาตามโครงการ, เลขห้อง, รหัสใบงาน..." value={searchTerm} onChange={setSearchTerm} />
              </div>
            </div>

            {/* Today's Job List Grid */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              {searchedOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">ไม่มีใบงานสำหรับวันนี้</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">รหัสใบงาน</th>
                        <th className="p-4">เวลานัด</th>
                        <th className="p-4">เลขห้อง</th>
                        <th className="p-4">ประเภทงาน</th>
                        <th className="p-4">ความสำคัญ</th>
                        <th className="p-4">สถานะ</th>
                        <th className="p-4">ผู้แจ้ง</th>
                        <th className="p-4 text-right">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {searchedOrders.map((wo) => (
                        <tr key={wo.id} onClick={() => setSelectedOrder(wo)} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition cursor-pointer font-medium">
                          <td className="p-4 font-mono font-bold text-slate-850 dark:text-slate-200">{wo.work_order_code}</td>
                          <td className="p-4 text-slate-650 dark:text-slate-350">{formatBangkokDate(wo.scheduled_at)}</td>
                          <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{wo.unit?.unit_number || "-"}</td>
                          <td className="p-4 text-slate-750 dark:text-slate-250">{wo.title}</td>
                          <td className="p-4"><span className={getPriorityStyle(wo.priority)}>{getPriorityLabel(wo.priority)}</span></td>
                          <td className="p-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(wo.status)}`}>{getStatusLabel(wo.status)}</span></td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{wo.resident_assignment?.person?.first_name || "ระบบ"}</td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setSelectedOrder(wo)} className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400 rounded-lg transition font-semibold">รายละเอียด</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "calendar" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">ปฏิทินตารางงาน</span>
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md text-[10px] font-bold">เขตเวลากรุงเทพฯ</span>
              </div>
              <div className="flex gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
                  <button
                    onClick={() => {
                      const prev = new Date(activeDate);
                      prev.setDate(activeDate.getDate() - (calendarTab === "MONTH" ? 30 : 7));
                      setActiveDate(prev);
                    }}
                    className="px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => setActiveDate(new Date())}
                    className="px-2.5 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition border-l border-r border-slate-200 dark:border-slate-700"
                  >
                    วันนี้
                  </button>
                  <button
                    onClick={() => {
                      const next = new Date(activeDate);
                      next.setDate(activeDate.getDate() + (calendarTab === "MONTH" ? 30 : 7));
                      setActiveDate(next);
                    }}
                    className="px-2 py-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition"
                  >
                    ▶
                  </button>
                </div>
                {(["DAY", "WEEK", "MONTH"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setCalendarTab(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      calendarTab === tab
                        ? "bg-indigo-650 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
                    }`}
                  >
                    {tab === "DAY" ? "รายวัน" : tab === "WEEK" ? "รายสัปดาห์" : "รายเดือน"}
                  </button>
                ))}
              </div>
            </div>

            {/* Real Interactive Mini-calendar rendering block */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-slate-950/10">
              <div className="grid grid-cols-7 text-center border-b border-slate-150 dark:border-slate-800 py-3 text-[10px] font-bold text-slate-400 bg-white dark:bg-slate-900">
                <div>อา.</div>
                <div>จ.</div>
                <div>อ.</div>
                <div>พ.</div>
                <div>พฤ.</div>
                <div>ศ.</div>
                <div>ส.</div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-850 text-xs">
                {/* Renders basic weekly/monthly grid blocks */}
                {Array.from({ length: calendarTab === "MONTH" ? 35 : 7 }).map((_, idx) => {
                  const dayOffset = idx - (calendarTab === "MONTH" ? 15 : activeDate.getDay());
                  const targetDay = new Date(activeDate);
                  targetDay.setDate(activeDate.getDate() + dayOffset);
                  const isToday = targetDay.toDateString() === new Date().toDateString();
                  
                  const targetParts = getBangkokParts(targetDay);
                  const dayJobs = workspaceOrders.filter(o => {
                    if (!o.scheduled_at) return false;
                    const jobParts = getBangkokParts(new Date(o.scheduled_at));
                    return jobParts.year === targetParts.year && jobParts.month === targetParts.month && jobParts.day === targetParts.day;
                  });

                  return (
                    <div key={idx} className="min-h-24 bg-white dark:bg-slate-900 p-2 flex flex-col justify-between border-slate-100 dark:border-slate-800">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isToday ? "bg-indigo-600 text-white" : "text-slate-400"
                      }`}>{targetDay.getDate()}</span>
                      <div className="space-y-1 mt-1 overflow-y-auto max-h-16">
                        {dayJobs.map(job => {
                          let jobColor = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400";
                          if (job.status === "IN_PROGRESS") {
                            jobColor = "bg-orange-100 text-orange-850 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400";
                          } else if (job.status === "COMPLETED" || job.status === "CLOSED") {
                            jobColor = "bg-emerald-105 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400";
                          }
                          const schedTime = new Date(job.scheduled_at || "");
                          const isOverdue = !["CLOSED", "CANCELLED", "COMPLETED"].includes(job.status) && schedTime.getTime() < Date.now();
                          if (isOverdue) {
                            jobColor = "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400";
                          }

                          return (
                            <div key={job.id} onClick={() => setSelectedOrder(job)} className={`p-1 text-[9px] rounded-lg border font-semibold truncate cursor-pointer transition ${jobColor}`}>
                              {job.unit?.unit_number} - {job.title}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "jobs" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">งานทั้งหมดในแผนก</span>
              <div className="w-full md:w-80">
                <SearchInput placeholder="ค้นหาใบงานทั้งหมด..." value={searchTerm} onChange={setSearchTerm} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              {searchedOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">ไม่มีใบงานในแผนก</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">รหัส</th>
                        <th className="p-4">เลขห้อง</th>
                        <th className="p-4">ชื่องาน</th>
                        <th className="p-4">ความสำคัญ</th>
                        <th className="p-4">ผู้รับผิดชอบ</th>
                        <th className="p-4">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {searchedOrders.map((wo) => (
                        <tr key={wo.id} onClick={() => setSelectedOrder(wo)} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition cursor-pointer">
                          <td className="p-4 font-mono font-bold">{wo.work_order_code}</td>
                          <td className="p-4 font-bold">{wo.unit?.unit_number || "-"}</td>
                          <td className="p-4 text-slate-700 dark:text-slate-300">{wo.title}</td>
                          <td className="p-4"><span className={getPriorityStyle(wo.priority)}>{getPriorityLabel(wo.priority)}</span></td>
                          <td className="p-4 text-slate-650 dark:text-slate-350">{wo.assignee?.first_name ? `${wo.assignee.first_name} ${wo.assignee.last_name}` : <span className="text-slate-400 font-semibold">ยังไม่มีผู้รับ</span>}</td>
                          <td className="p-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(wo.status)}`}>{getStatusLabel(wo.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "history" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">ประวัติงานเสร็จสิ้น</span>
              <div className="w-full md:w-80">
                <SearchInput placeholder="ค้นหาในประวัติงาน..." value={searchTerm} onChange={setSearchTerm} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              {searchedOrders.filter(o => ["CLOSED", "CANCELLED"].includes(o.status)).length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">ไม่มีบันทึกประวัติงาน</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4">รหัส</th>
                        <th className="p-4">เลขห้อง</th>
                        <th className="p-4">ชื่องาน</th>
                        <th className="p-4">เสร็จเมื่อ</th>
                        <th className="p-4">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {searchedOrders.filter(o => ["CLOSED", "CANCELLED"].includes(o.status)).map((wo) => (
                        <tr key={wo.id} onClick={() => setSelectedOrder(wo)} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition cursor-pointer">
                          <td className="p-4 font-mono font-bold">{wo.work_order_code}</td>
                          <td className="p-4 font-bold">{wo.unit?.unit_number || "-"}</td>
                          <td className="p-4 text-slate-700 dark:text-slate-300">{wo.title}</td>
                          <td className="p-4 text-slate-500">{formatBangkokDate(wo.completed_at || wo.closed_at)}</td>
                          <td className="p-4"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusStyle(wo.status)}`}>{getStatusLabel(wo.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "supplies" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 max-w-xl mx-auto space-y-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">ใบเบิกจ่ายอุปกรณ์ / น้ำยาทำความสะอาด</h3>
            {suppliesRequested ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-center space-y-2">
                <FiCheck className="text-2xl mx-auto" />
                <h4 className="font-bold text-xs">ส่งคำขอเบิกอุปกรณ์เรียบร้อยแล้ว</h4>
                <p className="text-[10px] opacity-75">คำขอของคุณได้รับการส่งไปยังระบบพัสดุส่วนกลางเรียบร้อยแล้ว กรุณารอเจ้าหน้าที่จัดเตรียมพัสดุ</p>
                <button onClick={() => setSuppliesRequested(false)} className="mt-4 px-4 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 dark:bg-slate-850 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition">ส่งคำขอใหม่</button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSuppliesRequested(true); }} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">รายการพัสดุที่ขอเบิก</label>
                  <textarea required rows={4} placeholder="ระบุน้ำยาทำความสะอาด, ถุงขยะ, ถุงมือยาง, หรือของใช้อื่นๆ ที่ต้องการเบิก พร้อมระบุจำนวนที่ต้องการ..." className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl outline-none focus:border-indigo-500 font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">วัตถุประสงค์ / หมายเหตุ</label>
                  <input type="text" placeholder="ระบุตึก/โซนการดูแลรับผิดชอบ..." className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl outline-none focus:border-indigo-500 font-medium" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm">ส่งแบบฟอร์มขอเบิกพัสดุ</button>
              </form>
            )}
          </div>
        )}

        {view === "profile" && auth?.profile && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 max-w-xl mx-auto space-y-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">โปรไฟล์ผู้ใช้งาน</h3>
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-850">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white font-bold flex items-center justify-center text-lg uppercase select-none">
                {auth.profile.display_name ? auth.profile.display_name[0] : "S"}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">{auth.profile.full_name || auth.profile.display_name}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">ตำแหน่ง: {workspace === "housekeeping" ? "พนักงานแม่บ้าน" : workspace === "technician" ? "ช่างเทคนิค" : auth.profile.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650 dark:text-slate-350">
              <div>
                <p className="text-[10px] text-slate-400">อีเมล</p>
                <p className="mt-0.5 text-slate-850 dark:text-slate-200">{auth.profile.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">เบอร์โทรศัพท์</p>
                <p className="mt-0.5 text-slate-850 dark:text-slate-200">{auth.profile.phone || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">แผนก / โครงการที่รับผิดชอบ</p>
                <p className="mt-0.5 text-slate-850 dark:text-slate-200">{auth.profile.department || "นิติบุคคลส่วนกลาง"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">ทีมงาน</p>
                <p className="mt-0.5 text-slate-850 dark:text-slate-200">{auth.profile.team || "จัดสรรงาน"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Job Details Drawer Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setSelectedOrder(null)} />

          {/* Content */}
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">รายละเอียดใบงานทำความสะอาด</h3>
                <p className="text-[10px] text-indigo-500 font-mono font-bold mt-0.5">ID: {selectedOrder.work_order_code}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 cursor-pointer">✕</button>
            </div>

            {/* Scroll Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-semibold text-slate-650 dark:text-slate-350">
              {actionSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center gap-2">
                  <FiCheckCircle className="text-sm shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400">เลขใบงาน</p>
                  <p className="mt-0.5 font-bold text-slate-850 dark:text-slate-200">{selectedOrder.work_order_code}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">เลขห้อง</p>
                  <p className="mt-0.5 font-bold text-indigo-600 dark:text-indigo-400">{selectedOrder.unit?.unit_number || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">ประเภทงาน</p>
                  <p className="mt-0.5 font-bold text-slate-850 dark:text-slate-200">{selectedOrder.title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">ความสำคัญ</p>
                  <p className="mt-0.5"><span className={getPriorityStyle(selectedOrder.priority)}>{getPriorityLabel(selectedOrder.priority)}</span></p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-400">รายละเอียด</p>
                  <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-350">{selectedOrder.description || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">ผู้แจ้ง</p>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{selectedOrder.resident_assignment?.person?.first_name || "ระบบ"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">เวลานัด</p>
                  <p className="mt-0.5 text-slate-800 dark:text-slate-200">{formatBangkokDate(selectedOrder.scheduled_at)}</p>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Photo stages */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 mb-2">รูปก่อนทำ</p>
                  {selectedOrder.photos?.filter(p => p.photo_stage === "BEFORE").map(p => (
                    <PhotoLoader key={p.id} path={p.storage_path} />
                  ))}
                  {selectedOrder.photos?.filter(p => p.photo_stage === "BEFORE").length === 0 && (
                    <div className="w-full h-24 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-slate-400 font-medium">ไม่มีรูปก่อนทำ</div>
                  )}
                  {selectedOrder.status === "IN_PROGRESS" && selectedOrder.assigned_to === currentUserId && (
                    <label className="mt-2 flex items-center justify-center gap-1 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 dark:bg-slate-850 dark:border-slate-800 text-[10px] text-indigo-600 rounded-lg cursor-pointer transition font-bold">
                      <FiUpload />
                      <span>{uploadingBefore ? "กำลังอัปโหลด..." : "อัปโหลดรูปก่อนทำ"}</span>
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, "BEFORE")} className="hidden" disabled={uploadingBefore} />
                    </label>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-2">รูปหลังทำ</p>
                  {selectedOrder.photos?.filter(p => p.photo_stage === "AFTER").map(p => (
                    <PhotoLoader key={p.id} path={p.storage_path} />
                  ))}
                  {selectedOrder.photos?.filter(p => p.photo_stage === "AFTER").length === 0 && (
                    <div className="w-full h-24 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-slate-400 font-medium">ไม่มีรูปหลังทำ</div>
                  )}
                  {selectedOrder.status === "IN_PROGRESS" && selectedOrder.assigned_to === currentUserId && (
                    <label className="mt-2 flex items-center justify-center gap-1 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 dark:bg-slate-850 dark:border-slate-800 text-[10px] text-indigo-600 rounded-lg cursor-pointer transition font-bold">
                      <FiUpload />
                      <span>{uploadingAfter ? "กำลังอัปโหลด..." : "อัปโหลดรูปหลังทำ"}</span>
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, "AFTER")} className="hidden" disabled={uploadingAfter} />
                    </label>
                  )}
                </div>
              </div>

              {/* Execution Actions workflow section */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {/* 1. Unclaimed job / Claim check */}
                {!selectedOrder.assigned_to && selectedOrder.status === "NEW" && (
                  <button onClick={() => handleClaimJob(selectedOrder)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm">
                    <FiCheck />
                    <span>รับงานทำความสะอาดนี้</span>
                  </button>
                )}

                {/* 2. Claimed but not started */}
                {selectedOrder.assigned_to === currentUserId && selectedOrder.status === "ASSIGNED" && (
                  <button onClick={() => handleStartJob(selectedOrder)} className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm">
                    <FiPlay />
                    <span>เริ่มดำเนินงานทำความสะอาด</span>
                  </button>
                )}

                {/* 3. In Progress */}
                {selectedOrder.assigned_to === currentUserId && selectedOrder.status === "IN_PROGRESS" && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1.5">หมายเหตุการปฏิบัติงาน</label>
                      <input type="text" placeholder="ระบุเพิ่มเติม เช่น จุดที่พบรอยเปื้อนเป็นพิเศษ..." value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl outline-none focus:border-indigo-500 font-medium" />
                    </div>
                    <button onClick={() => handleCompleteJob(selectedOrder)} className="w-full py-2.5 bg-emerald-650 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm">
                      <FiCheck />
                      <span>ทำความสะอาดเสร็จสิ้น (ส่งมอบงาน)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer close */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/20">
              <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold transition cursor-pointer text-slate-700 dark:text-slate-300">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
