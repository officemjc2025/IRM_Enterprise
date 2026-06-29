"use client";

import React from "react";
import { UserMenu } from "./UserMenu";
import { NotificationButton } from "./NotificationButton";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useLanguage } from "@/providers/LanguageProvider";

interface TopNavigationProps {
  onMenuClick: () => void;
}

export function TopNavigation({ onMenuClick }: TopNavigationProps) {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#D4AF37]/20 bg-[#0F172A] text-white shadow-md">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden rounded-lg p-2 text-white hover:bg-white/10 transition-colors"
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <span className="font-bold text-base md:text-lg tracking-wide text-white">
            IRM Enterprise
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Search Shortcut */}
          <a
            href="/search"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-[#D4AF37] rounded-lg text-slate-400 hover:text-slate-200 transition text-xs"
          >
            <span>🔍</span>
            <span className="hidden sm:inline">{t.topNav.searchPlaceholder}</span>
          </a>

          <LanguageSwitcher />

          <NotificationButton />
          
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
