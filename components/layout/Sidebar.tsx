"use client";

import Logo from "../common/Logo";
import navConfig from "../../shared/navigation/navigation.config";
import APP_CONFIG from "../../lib/config/app";

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
      className={`w-72 flex-shrink-0 bg-[#0F172A] border-r border-[#D4AF37]/20 text-white ${className}`}
      aria-label="Primary Navigation"
    >
      <div className="flex h-full flex-col">

        {/* Logo */}
        <div className="border-b border-[#D4AF37]/20 px-6 py-8">

          <div className="flex justify-center">
            <Logo
              type="irm"
              width={140}
              height={140}
            />
          </div>

          <div className="mt-4 text-center">
            <h1 className="text-xl font-bold text-white">
              {APP_CONFIG.app.name}
            </h1>

            <p className="mt-1 text-sm text-slate-300">
              {APP_CONFIG.project.shortName}
            </p>
          </div>

        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-6">
          {navConfig.map((section) => (
            <div key={section.section} className="space-y-2">
              <h3 className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {section.section}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        onClick={onClose}
                        className="group flex items-center gap-3 rounded-xl px-4 py-2.5 text-slate-300 transition-all duration-200 hover:bg-[#1E3A8A] hover:text-white text-sm"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{item.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}

        <div className="border-t border-[#D4AF37]/20 p-4">

          <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition hover:bg-[#1E3A8A] hover:text-white">

            <span>⚙️</span>

            <span>Account</span>

          </button>

        </div>

      </div>

    </aside>
  );
}