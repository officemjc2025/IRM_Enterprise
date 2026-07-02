"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/providers/LanguageProvider";
import { AnnouncementPriority, AnnouncementStatus } from "@/features/announcement/types/announcement.types";

interface MinimalProperty {
  id: string;
  property_name_th: string;
  property_name_en: string | null;
}

interface AnnouncementFormProps {
  id?: string;
}

export default function AnnouncementFormPage({ id }: AnnouncementFormProps) {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [properties, setProperties] = useState<MinimalProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("NORMAL");
  const [status, setStatus] = useState<AnnouncementStatus>("DRAFT");
  const [isPinned, setIsPinned] = useState(false);
  const [publishAt, setPublishAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [expireAt, setExpireAt] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setFetching(true);
        const propRes = await fetch("/api/v1/properties");
        const propJson = await propRes.json();
        if (propJson.success) {
          setProperties(propJson.data);
        }

        if (id) {
          const annRes = await fetch(`/api/v1/announcements/${id}`);
          const annJson = await annRes.json();
          if (annJson.success && annJson.data) {
            const ann = annJson.data;
            setTitle(ann.title);
            setContent(ann.content);
            setPropertyId(ann.property_id || "");
            setPriority(ann.priority);
            setStatus(ann.status);
            setIsPinned(ann.is_pinned);
            if (ann.publish_at) {
              setPublishAt(new Date(ann.publish_at).toISOString().slice(0, 16));
            }
            if (ann.expire_at) {
              setExpireAt(new Date(ann.expire_at).toISOString().slice(0, 16));
            }
          } else {
            setError(annJson.message || "Failed to load announcement details");
          }
        }
      } catch (err) {
        console.error(err);
        setError("Error loading form dependencies.");
      } finally {
        setFetching(false);
      }
    };

    queueMicrotask(() => {
      loadData();
    });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        title,
        content,
        property_id: propertyId !== "" ? propertyId : null,
        priority,
        status,
        is_pinned: isPinned,
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
        expire_at: expireAt ? new Date(expireAt).toISOString() : null,
      };

      const url = id ? `/api/v1/announcements/${id}` : "/api/v1/announcements";
      const method = id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        router.push("/announcements");
        router.refresh();
      } else {
        setError(json.message || "Failed to save announcement");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unexpected error during save";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            {id
              ? language === "en"
                ? "Edit Announcement"
                : "แก้ไขข่าวประกาศ"
              : language === "en"
              ? "Create Announcement"
              : "สร้างข่าวประกาศ"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === "en"
              ? "Publish messages and announcements to the resident dashboard."
              : "เผยแพร่ข่าวสารและประกาศไปยังบอร์ดข่าวสำหรับผู้พักอาศัย"}
          </p>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-slate-500">{t.common.loading}</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Title */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Title" : "หัวข้อประกาศ"}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === "en" ? "Enter title..." : "กรอกหัวข้อประกาศ..."}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Content" : "เนื้อหา"}
                </label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={language === "en" ? "Enter announcement body content..." : "กรอกเนื้อหาข่าวประกาศ..."}
                  className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm outline-none resize-y min-h-[140px]"
                />
              </div>

              {/* Property mapping */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {language === "en" ? "Target Property" : "โครงการเป้าหมาย"}
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
                >
                  <option value="">{language === "en" ? "All Properties (Global)" : "ทุกโครงการ (ส่วนกลาง)"}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Priority" : "ระดับความสำคัญ"}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Status" : "สถานะ"}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                    className="p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none cursor-pointer"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              {/* Is Pinned */}
              <div className="flex items-center gap-2 py-2">
                <input
                  id="isPinned"
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-[#D4AF37] focus:ring-[#D4AF37] border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="isPinned" className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider cursor-pointer">
                  📌 {language === "en" ? "Pin to top of list" : "ปักหมุดไว้บนสุด"}
                </label>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Publish Date" : "วันที่เริ่มต้นเผยแพร่"}
                  </label>
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Expire Date (Optional)" : "วันที่สิ้นสุดการเผยแพร่ (ไม่จำเป็น)"}
                  </label>
                  <input
                    type="datetime-local"
                    value={expireAt}
                    onChange={(e) => setExpireAt(e.target.value)}
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm font-semibold outline-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => router.push("/announcements")}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold shadow-md shadow-[#D4AF37]/10 disabled:opacity-50 transition"
                >
                  {loading ? t.common.processing : t.common.save}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
