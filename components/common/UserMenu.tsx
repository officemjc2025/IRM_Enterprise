"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { useProfile } from "@/hooks/useProfile";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { profile } = useProfile();

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const displayName = profile?.full_name || profile?.display_name || "User";
  const roleName = profile?.role || "Resident";
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="relative">
      {/* User Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A8A] text-sm font-semibold text-white">
          {initials}
        </div>

        <div className="hidden text-left lg:block">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            {displayName}
          </p>
          <p className="text-xs text-slate-500">
            {roleName}
          </p>
        </div>

        <svg
          className={`h-4 w-4 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1E3A8A] text-base font-bold text-white">
              {initials}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {displayName}
              </p>
              <p className="text-xs text-slate-500">
                {roleName}
              </p>
            </div>
          </div>

          {/* Menu */}
          <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
            <span className="text-lg">👤</span>
            <span>My Profile</span>
          </button>

          <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
            <span className="text-lg">⚙</span>
            <span>Settings</span>
          </button>

          <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
            <span className="text-lg">🌐</span>
            <span>Language</span>
          </button>

          <button className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
            <span className="text-lg">🌙</span>
            <span>Theme</span>
          </button>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-5 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-slate-700"
            >
              <span className="text-lg">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}