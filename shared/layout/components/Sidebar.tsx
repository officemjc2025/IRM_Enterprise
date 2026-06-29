"use client";

import React from "react";
import Logo from "@/components/common/Logo";
import APP_CONFIG from "@/lib/config/app";
import {
  IconDashboard,
  IconProperty,
  IconResidents,
  IconRental,
  IconVisitors,
  IconSettings,
} from "@/components/icons/LucideLike";
import { useLanguage } from "@/providers/LanguageProvider";

interface SidebarProps {
  onClose?: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ onClose, collapsed, setCollapsed }: SidebarProps) {
  const { t } = useLanguage();

  const navigationItems = [
    {
      section: t.menu.masterData,
      items: [
        { id: "properties", label: t.menu.properties, href: "/properties", icon: IconProperty },
        { id: "units", label: t.menu.units, href: "/units", icon: IconProperty },
        { id: "owners", label: t.menu.owners, href: "/owners", icon: IconResidents },
        { id: "persons", label: t.menu.persons, href: "/persons", icon: IconResidents },
        { id: "occupancies", label: t.menu.occupancies, href: "/occupancies", icon: IconRental },
      ]
    },
    {
      section: t.menu.operations,
      items: [
        { id: "import", label: t.menu.import, href: "/import", icon: IconDashboard },
        { id: "search", label: t.menu.search, href: "/search", icon: IconVisitors },
      ]
    },
    {
      section: t.menu.business,
      items: [
        { id: "visitors", label: t.menu.visitors, href: "/visitors", icon: IconVisitors },
        { id: "workorder-placeholder", label: t.menu.workOrders, href: "/work-orders", icon: IconDashboard },
        { id: "residents-placeholder", label: t.menu.residents, href: "/residents", icon: IconResidents },
        { id: "security-placeholder", label: t.menu.security, href: "/security", icon: IconVisitors },
        { id: "reports-placeholder", label: t.menu.reports, href: "/reports", icon: IconDashboard },
      ]
    },
    {
      section: t.menu.system,
      items: [
        { id: "dashboard", label: t.menu.dashboard, href: "/", icon: IconDashboard },
        { id: "settings", label: t.menu.settings, href: "/settings", icon: IconSettings },
      ]
    }
  ];
  return (
    <aside
      className={`h-full bg-[#0F172A] border-r border-[#D4AF37]/20 text-white flex flex-col transition-all duration-300 ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      {/* Header / Logo */}
      <div className="border-b border-[#D4AF37]/20 p-4 flex flex-col items-center relative">
        <div className="flex justify-center">
          <Logo type="irm" width={collapsed ? 50 : 120} height={collapsed ? 50 : 120} />
        </div>
        {!collapsed && (
          <div className="mt-4 text-center">
            <h1 className="text-lg font-bold text-white">{APP_CONFIG.app.name}</h1>
            <p className="text-xs text-slate-300">{APP_CONFIG.project.shortName}</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:block absolute -right-3 top-6 bg-[#D4AF37] text-white rounded-full p-1 shadow z-10 text-[10px]"
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-6">
        {navigationItems.map((section) => (
          <div key={section.section} className="space-y-2">
            {!collapsed && (
              <h3 className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {section.section}
              </h3>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={`group flex items-center rounded-xl px-4 py-2.5 text-slate-300 transition-all duration-200 hover:bg-[#1E3A8A] hover:text-white text-sm ${
                        collapsed ? "justify-center" : "gap-3"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
