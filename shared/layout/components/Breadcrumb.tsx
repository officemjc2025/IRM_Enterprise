"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/providers/LanguageProvider";

export function Breadcrumb() {
  const pathname = usePathname();
  const { t } = useLanguage();
  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-400 dark:text-slate-500 py-2">
      <ol className="flex flex-wrap items-center gap-1.5 font-medium">
        <li>
          <Link href="/" className="hover:text-slate-200 transition">
            {t.navigation.dashboard}
          </Link>
        </li>
        {segments.map((seg, idx) => {
          const href = "/" + segments.slice(0, idx + 1).join("/");
          const isLast = idx === segments.length - 1;
          const label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");

          return (
            <li key={href} className="flex items-center gap-1.5">
              <span>/</span>
              {isLast ? (
                <span className="text-slate-200 font-semibold">{label}</span>
              ) : (
                <Link href={href} className="hover:text-slate-200 transition">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
