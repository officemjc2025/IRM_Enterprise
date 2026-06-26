"use client";

import Logo from "../common/Logo";
import navConfig from "../../shared/navigation/navigation.config";
import { useLanguage } from "../../providers/LanguageProvider";
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
  const { t } = useLanguage();

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
        <nav className="flex-1 px-3 py-5">

          <ul className="space-y-2">

            {navConfig.map((item) => {

              const Icon = item.icon;

              return (
                <li key={item.id}>

                  <a
                    href={item.href}
                    onClick={onClose}
                    className="group flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition-all duration-200 hover:bg-[#1E3A8A] hover:text-white"
                  >

                    <Icon className="h-5 w-5" />

                    <span className="font-medium">
                      {t.navigation[item.labelKey as keyof typeof t.navigation]}
                    </span>

                    {item.badge && (
                      <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
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