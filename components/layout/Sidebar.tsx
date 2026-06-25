"use client";

import navConfig from "../../shared/navigation/navigation.config";

type SidebarProps = {
  className?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({
  className = "",
  onClose,
}: SidebarProps) {
  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-64 flex-shrink-0 z-20 ${className}`}
      aria-label="Primary Navigation"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 font-bold text-white">
            IRM
          </div>

          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              IRM Enterprise
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Property Management
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {navConfig.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={onClose}
                    className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="flex-1 truncate">
                      {item.label}
                    </span>

                    {item.badge && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                        {item.badge}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            <span>⚙️</span>
            <span>Account</span>
          </button>
        </div>
      </div>
    </aside>
  );
}