"use client";

import LanguageSwitcher from "../common/LanguageSwitcher";
import NotificationBell from "../common/NotificationBell";
import ThemeToggle from "../common/ThemeToggle";
import UserMenu from "../common/UserMenu";
import { useLanguage } from "../../providers/LanguageProvider";

export default function Header({
  className = "",
}: {
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <header
  className={
    "sticky top-0 z-30 w-full border-b border-[#0F172A] bg-[#0F172A] text-white shadow-md " +
    className
  }
>
    
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            className="rounded-lg p-2 text-white hover:bg-white/10 transition-colors"
            aria-label="Open sidebar"
          >
            ☰
          </button>

          <h1 className="text-xl font-bold text-white">
            {t.navigation.dashboard}
          </h1>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <input
            placeholder={t.common.search}
            className="hidden w-64 rounded-lg border border-slate-200 px-4 py-2 text-sm lg:block"
          />

          <LanguageSwitcher />

          <ThemeToggle />

          <NotificationBell count={3} />

          <UserMenu />
        </div>
      </div>
    </header>
  );
}