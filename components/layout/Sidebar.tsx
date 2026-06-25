"use client";

import React from "react";
import navConfig from "../../shared/navigation/navigation.config";

export default function Sidebar({
  className = "",
  mobileOpen,
  onClose,
}: {
  className?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  return (
    <aside
      className={
        "bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64 flex-shrink-0 z-20 " +
        className
      }
      aria-label="Primary"
    >
      <div className="h-full flex flex-col">
        <div className="px-4 py-6 flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-pink-500 rounded-md flex items-center justify-center text-white font-bold">IRM</div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">IRM Enterprise</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Property Management</p>
          </div>
        </div>

        <nav className="px-2 py-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {navConfig.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  onClick={onClose}
                  className="group flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 flex items-center justify-center" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5">{item.badge}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
            <span className="h-4 w-4">⚙️</span>
            <span>Account</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
