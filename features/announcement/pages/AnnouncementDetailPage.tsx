"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { Announcement } from "@/features/announcement/types/announcement.types";
import { useLanguage } from "@/providers/LanguageProvider";
import { LoadingState } from "@/shared/ui";

export default function AnnouncementDetailPage() {
  const { language } = useLanguage();
  const params = useParams<{ id: string }>();

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAnnouncement = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`/api/v1/announcements/${params.id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load announcement");
        }

        setAnnouncement(result.data);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load announcement"
        );
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      void loadAnnouncement();
    }
  }, [params.id]);

  if (loading) {
    return (
      <MainLayout>
        <LoadingState />
      </MainLayout>
    );
  }

  if (error || !announcement) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Link
            href="/announcements"
            className="inline-flex text-sm font-semibold text-blue-600 hover:underline"
          >
            ← {language === "en" ? "Back to Announcements" : "กลับไปหน้าประกาศ"}
          </Link>

          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error || (language === "en" ? "Announcement not found" : "ไม่พบประกาศ")}
          </div>
        </div>
      </MainLayout>
    );
  }

  const propertyName = announcement.property
    ? language === "en"
      ? announcement.property.property_name_en ||
        announcement.property.property_name_th
      : announcement.property.property_name_th
    : language === "en"
      ? "All Properties (Global)"
      : "ทุกโครงการ";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/announcements"
            className="inline-flex text-sm font-semibold text-blue-600 hover:underline"
          >
            ← {language === "en" ? "Back to Announcements" : "กลับไปหน้าประกาศ"}
          </Link>

          <Link
            href={`/announcements/${announcement.id}/edit`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {language === "en" ? "Edit Announcement" : "แก้ไขประกาศ"}
          </Link>
        </div>

        <article className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 p-6 dark:border-slate-700">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {announcement.status}
              </span>

              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {announcement.priority}
              </span>

              {announcement.is_pinned && (
                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {language === "en" ? "Pinned" : "ปักหมุด"}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {announcement.title}
            </h1>

            <div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
              <div>
                <span className="font-semibold">
                  {language === "en" ? "Property: " : "โครงการ: "}
                </span>
                {propertyName}
              </div>

              <div>
                <span className="font-semibold">
                  {language === "en" ? "Created: " : "สร้างเมื่อ: "}
                </span>
                {new Date(announcement.created_at).toLocaleString()}
              </div>

              {announcement.publish_at && (
                <div>
                  <span className="font-semibold">
                    {language === "en" ? "Publish: " : "เผยแพร่: "}
                  </span>
                  {new Date(announcement.publish_at).toLocaleString()}
                </div>
              )}

              {announcement.expire_at && (
                <div>
                  <span className="font-semibold">
                    {language === "en" ? "Expire: " : "หมดอายุ: "}
                  </span>
                  {new Date(announcement.expire_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="whitespace-pre-wrap break-words leading-7 text-slate-700 dark:text-slate-200">
              {announcement.content}
            </div>
          </div>
        </article>
      </div>
    </MainLayout>
  );
}
