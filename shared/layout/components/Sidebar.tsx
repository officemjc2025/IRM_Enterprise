"use client";

import React, { useContext } from "react";
import { usePathname } from "next/navigation";
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
import { AuthContext } from "@/providers/AuthProvider";

interface SidebarProps {
  onClose?: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ onClose, collapsed, setCollapsed }: SidebarProps) {
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const auth = useContext(AuthContext);
  const userRole = auth?.profile?.role;

  const isSecurity = userRole === "security";
  const isTech = userRole === "technician";
  const isResident = userRole && ["owner", "co_owner", "tenant", "resident"].includes(userRole);

  const getFilteredItems = () => {
    if (isResident) {
      return [
        {
          section: language === "en" ? "Resident Workspace" : "พื้นที่ทำงานลูกบ้าน",
          items: [
            { id: "resident-home", label: language === "en" ? "My Home" : "หน้าหลัก", href: "/resident", icon: IconDashboard },
            { id: "announcements", label: language === "en" ? "Announcements" : "ข่าวประกาศ", href: "/announcements", icon: IconDashboard },
          ]
        }
      ];
    }

    if (isSecurity) {
      return [
        {
          section: "พื้นที่ทำงานฝ่ายรักษาความปลอดภัย",
          items: [
            { id: "my-jobs", label: "งานของฉัน", href: "/security", icon: IconDashboard },
            { id: "calendar", label: "ปฏิทินงาน", href: "/security/calendar", icon: IconDashboard },
            { id: "all-jobs", label: "รายการงานทั้งหมด", href: "/security/jobs", icon: IconDashboard },
            { id: "history", label: "ประวัติงาน", href: "/security/history", icon: IconDashboard },
            { id: "supplies", label: "เบิกอุปกรณ์", href: "/security/supplies", icon: IconDashboard },
            { id: "profile", label: "โปรไฟล์", href: "/security/profile", icon: IconDashboard },
          ]
        }
      ];
    }

    if (isTech) {
      return [
        {
          section: "พื้นที่ทำงานช่างเทคนิค",
          items: [
            { id: "my-jobs", label: "งานของฉัน", href: "/technician", icon: IconDashboard },
            { id: "calendar", label: "ปฏิทินงาน", href: "/technician/calendar", icon: IconDashboard },
            { id: "all-jobs", label: "รายการงานทั้งหมด", href: "/technician/jobs", icon: IconDashboard },
            { id: "history", label: "ประวัติงาน", href: "/technician/history", icon: IconDashboard },
            { id: "supplies", label: "เบิกอุปกรณ์", href: "/technician/supplies", icon: IconDashboard },
            { id: "profile", label: "โปรไฟล์", href: "/technician/profile", icon: IconDashboard },
          ]
        }
      ];
    }

    if (userRole === "housekeeping") {
      return [
        {
          section: "พื้นที่ทำงานแม่บ้าน",
          items: [
            { id: "my-jobs", label: "งานของฉัน", href: "/housekeeping", icon: IconDashboard },
            { id: "calendar", label: "ปฏิทินงาน", href: "/housekeeping/calendar", icon: IconDashboard },
            { id: "all-jobs", label: "รายการงานทั้งหมด", href: "/housekeeping/jobs", icon: IconDashboard },
            { id: "history", label: "ประวัติงาน", href: "/housekeeping/history", icon: IconDashboard },
            { id: "supplies", label: "เบิกอุปกรณ์", href: "/housekeeping/supplies", icon: IconDashboard },
            { id: "profile", label: "โปรไฟล์", href: "/housekeeping/profile", icon: IconDashboard },
          ]
        }
      ];
    }

    // Default (Admins / Managers)
    return [
      {
        section: t.menu.masterData,
        items: [
          { id: "properties", label: t.menu.properties, href: "/properties", icon: IconProperty },
          { id: "units", label: t.menu.units, href: "/units", icon: IconProperty },
          { id: "owners", label: t.menu.owners, href: "/ownerships", icon: IconResidents },
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
          { id: "reservations", label: language === "en" ? "Room Reservations" : "การจองห้องพัก", href: "/reservations", icon: IconRental },
          { id: "registration-requests", label: language === "en" ? "Registration Requests" : "คำขอลงทะเบียน", href: "/registration-requests", icon: IconResidents },
          { id: "announcements", label: language === "en" ? "Announcements" : "สื่อสารกับนิติ", href: "/announcements", icon: IconDashboard },
          { id: "service-bookings", label: language === "en" ? "Service Bookings" : "การจองบริการ", href: "/service-bookings", icon: IconRental },
          { id: "stays", label: language === "en" ? "Stay Tracking" : "ติดตามการเข้าพัก", href: "/stays", icon: IconRental },
          { id: "operations-calendar", label: language === "en" ? "Operational Calendar" : "ปฏิทินงาน", href: "/operations/calendar", icon: IconDashboard },
          { id: "workorder-placeholder", label: t.menu.workOrders, href: "/work-orders", icon: IconDashboard },
          { id: "residents-placeholder", label: t.menu.residents, href: "/residents", icon: IconResidents },
          { id: "security-placeholder", label: t.menu.security, href: "/security", icon: IconVisitors },
          { id: "reports-placeholder", label: t.menu.reports, href: "/reports", icon: IconDashboard },
        ].filter((item) => {
          if (item.id === "registration-requests") {
            return ["super_admin", "admin", "property_admin"].includes(userRole || "");
          }
          return true;
        })
      },
      {
        section: language === "en" ? "Administration" : "การบริหารจัดการ",
        items: [
          { id: "staff-management", label: language === "en" ? "Staff List" : "รายชื่อเจ้าหน้าที่", href: "/staff-management", icon: IconResidents },
          { id: "staff-import", label: language === "en" ? "Import Staff" : "นำเข้าเจ้าหน้าที่", href: "/staff-management/import", icon: IconDashboard },
        ].filter((item) => {
          if (item.id === "staff-management" || item.id === "staff-import") {
            return ["super_admin", "admin", "property_admin"].includes(userRole || "");
          }
          return true;
        })
      },
      {
        section: t.menu.system,
        items: [
          { id: "dashboard", label: t.menu.dashboard, href: "/", icon: IconDashboard },
          { id: "settings", label: t.menu.settings, href: "/settings", icon: IconSettings },
        ]
      }
    ];
  };

  const navigationItems = getFilteredItems();
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
                const isWorkspaceRoute = item.href.startsWith("/housekeeping") || item.href.startsWith("/technician") || item.href.startsWith("/security") || item.href.startsWith("/office");
                const isActive = isWorkspaceRoute 
                  ? pathname === item.href 
                  : pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                return (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      onClick={onClose}
                      title={collapsed ? item.label : undefined}
                      className={`group flex items-center rounded-xl px-4 py-2.5 transition-all duration-200 text-sm ${
                        collapsed ? "justify-center" : "gap-3"
                      } ${
                        isActive
                          ? "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 font-semibold"
                          : "text-slate-300 hover:bg-[#1E3A8A] hover:text-white"
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
