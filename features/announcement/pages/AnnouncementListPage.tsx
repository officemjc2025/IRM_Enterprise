"use client";

import React, { Suspense, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { Announcement } from "@/features/announcement/types/announcement.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { PageHeader, SearchInput, EmptyState, LoadingState } from "@/shared/ui";

interface MinimalProperty {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

function AnnouncementListInner() {
  const { language } = useLanguage();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [properties, setProperties] = useState<MinimalProperty[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");

  const fetchData = async () => {
    try {
      const [annRes, propRes] = await Promise.all([
        fetch("/api/v1/announcements"),
        fetch("/api/v1/properties"),
      ]);

      const annJson = await annRes.json();
      const propJson = await propRes.json();

      if (annJson.success) {
        setAnnouncements(annJson.data);
      }
      if (propJson.success) {
        setProperties(propJson.data);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
  }, []);

  const handleArchive = async (id: string) => {
    if (!confirm(language === "en" ? "Are you sure you want to archive this announcement?" : "คุณแน่ใจหรือไม่ว่าต้องการเก็บประกาศนี้เป็นจดหมายเหตุ?")) return;
    try {
      const res = await fetch(`/api/v1/announcements/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async (ann: Announcement) => {
    try {
      const res = await fetch(`/api/v1/announcements/${ann.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_pinned: !ann.is_pinned }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async (annId: string) => {
    try {
      const res = await fetch(`/api/v1/announcements/${annId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED", publish_at: new Date().toISOString() }),
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Logic
  const filtered = announcements.filter((a) => {
    // 1. Search filter
    const term = searchTerm.toLowerCase().trim();
    if (term && !a.title.toLowerCase().includes(term)) {
      return false;
    }

    // 2. Status filter
    if (statusFilter !== "ALL" && a.status !== statusFilter) {
      return false;
    }

    // 3. Priority filter
    if (priorityFilter !== "ALL" && a.priority !== priorityFilter) {
      return false;
    }

    // 4. Property filter
    if (propertyFilter !== "ALL" && a.property_id !== propertyFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={language === "en" ? "Announcements" : "ข่าวประกาศ"}
        actionHref="/announcements/create"
        actionLabel={language === "en" ? "+ Create Announcement" : "+ สร้างข่าวประกาศ"}
      />

      {/* Filters & Search Panel */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Search by Title */}
          <div className="sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              {language === "en" ? "Search by Title" : "ค้นหาจากหัวข้อ"}
            </label>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={language === "en" ? "Search..." : "ค้นหา..."}
            />
          </div>

          {/* Filter Status */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              {language === "en" ? "Filter Status" : "กรองสถานะ"}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none cursor-pointer"
            >
              <option value="ALL">{language === "en" ? "All Statuses" : "ทุกสถานะ"}</option>
              <option value="DRAFT">DRAFT</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>

          {/* Filter Priority */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              {language === "en" ? "Filter Priority" : "กรองระดับความสำคัญ"}
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none cursor-pointer"
            >
              <option value="ALL">{language === "en" ? "All Priorities" : "ทุกระดับความสำคัญ"}</option>
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          {/* Filter Property */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              {language === "en" ? "Filter Property" : "กรองตามโครงการ"}
            </label>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none cursor-pointer"
            >
              <option value="ALL">{language === "en" ? "All Properties" : "ทุกโครงการ"}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={language === "en" ? "No announcements found" : "ไม่พบข่าวประกาศ"}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">{language === "en" ? "Pin" : "ปักหมุด"}</th>
                  <th className="p-4">{language === "en" ? "Title" : "หัวข้อประกาศ"}</th>
                  <th className="p-4">{language === "en" ? "Property" : "โครงการ"}</th>
                  <th className="p-4">{language === "en" ? "Priority" : "ระดับความสำคัญ"}</th>
                  <th className="p-4">{language === "en" ? "Status" : "สถานะ"}</th>
                  <th className="p-4">{language === "en" ? "Schedule" : "กำหนดการเผยแพร่"}</th>
                  <th className="p-4 text-right">{language === "en" ? "Actions" : "การจัดการ"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleTogglePin(a)}
                        className={`text-lg transition-transform active:scale-95 ${
                          a.is_pinned ? "text-amber-500 font-bold" : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                        }`}
                        title={a.is_pinned ? "Unpin Announcement" : "Pin Announcement"}
                      >
                        📌
                      </button>
                    </td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                      {a.title}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {a.property ? (language === "en" ? a.property.property_name_en || a.property.property_name_th : a.property.property_name_th) : (language === "en" ? "All Properties (Global)" : "ทุกโครงการ")}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        a.priority === "URGENT"
                          ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                          : a.priority === "HIGH"
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
                          : a.priority === "NORMAL"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      }`}>
                        {a.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        a.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400"
                          : a.status === "DRAFT"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-500"
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                      <div>Publish: {a.publish_at ? new Date(a.publish_at).toLocaleDateString() : "-"}</div>
                      {a.expire_at && <div>Expire: {new Date(a.expire_at).toLocaleDateString()}</div>}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {a.status === "DRAFT" && (
                        <button
                          onClick={() => handlePublish(a.id)}
                          className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded transition"
                        >
                          {language === "en" ? "Publish" : "เผยแพร่"}
                        </button>
                      )}
                      <Link
                        href={`/announcements/${a.id}/edit`}
                        className="px-2 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded text-slate-700 dark:text-slate-300 inline-block"
                      >
                        {language === "en" ? "Edit" : "แก้ไข"}
                      </Link>
                      <button
                        onClick={() => handleArchive(a.id)}
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded transition"
                      >
                        {language === "en" ? "Archive" : "เก็บจดหมายเหตุ"}
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
  );
}

export default function AnnouncementListPage() {
  return (
    <MainLayout>
      <Suspense fallback={<LoadingState />}>
        <AnnouncementListInner />
      </Suspense>
    </MainLayout>
  );
}
