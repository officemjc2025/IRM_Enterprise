"use client";

import { useEffect, useState } from "react";
import Logo from "../common/Logo";
import APP_CONFIG from "../../lib/config/app";
import { createClient } from "../../lib/supabase/client";
import { useLanguage } from "../../providers/LanguageProvider";
import {
  IconDashboard,
  IconProperty,
  IconResidents,
  IconRental,
  IconVisitors,
  IconSettings,
} from "../icons/LucideLike";

type SidebarProps = {
  className?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({
  className = "",
  onClose,
}: SidebarProps) {
  const { language } = useLanguage();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          if (profile) {
            setRole(profile.role);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user role for sidebar navigation:", err);
      }
    };
    fetchRole();
  }, []);

  const navSections = [
    {
      section: language === "en" ? "Master Data" : "ข้อมูลระบบ",
      items: [
        { id: "properties", label: language === "en" ? "Properties" : "โครงการ", href: "/properties", icon: IconProperty },
        { id: "units", label: language === "en" ? "Units" : "ห้องชุด", href: "/units", icon: IconProperty },
        { id: "owners", label: language === "en" ? "Owners" : "เจ้าของร่วม", href: "/ownerships", icon: IconResidents },
        { id: "persons", label: language === "en" ? "Persons" : "บุคคล", href: "/persons", icon: IconResidents },
        { id: "occupancies", label: language === "en" ? "Occupancies" : "การเข้าพัก", href: "/occupancies", icon: IconRental },
      ].filter(() => ["super_admin", "admin", "property_admin"].includes(role || ""))
    },
    {
      section: language === "en" ? "Operations" : "การดำเนินงาน",
      items: [
        { id: "import", label: language === "en" ? "Import Master Data" : "นำเข้าข้อมูล", href: "/import", icon: IconDashboard },
        { id: "search", label: language === "en" ? "Search" : "ค้นหา", href: "/search", icon: IconVisitors },
        { id: "announcements", label: language === "en" ? "Announcements" : "ประกาศ", href: "/announcements", icon: IconDashboard },
        { id: "registration-requests", label: language === "en" ? "Registration Requests" : "คำขอลงทะเบียน", href: "/registration-requests", icon: IconResidents },
        { id: "security", label: language === "en" ? "Security Dashboard" : "ระบบรักษาความปลอดภัย", href: "/security", icon: IconVisitors },
        { id: "work-orders", label: language === "en" ? "Work Orders" : "ใบสั่งงาน", href: "/work-orders", icon: IconDashboard },
      ].filter((item) => {
        if (role === "technician") {
          return item.id === "work-orders";
        }
        return ["super_admin", "admin", "property_admin"].includes(role || "");
      })
    },
    {
      section: language === "en" ? "Utilities" : "สาธารณูปโภค",
      items: [
        {
          id: "meter-management",
          label: language === "en" ? "Meter Management" : "จัดการมิเตอร์",
          href: "/meter-management",
          icon: IconDashboard
        },
        {
          id: "meter-reading",
          label: language === "en" ? "Meter Reading" : "จดมิเตอร์",
          href: "/meter-reading",
          icon: IconDashboard
        }
      ].filter((item) => {
        if (role === "technician") {
          return item.id === "meter-reading";
        }
        return ["super_admin", "admin", "property_admin"].includes(role || "");
      })
    },
    {
      section: language === "en" ? "System" : "ระบบ",
      items: [
        { id: "dashboard", label: language === "en" ? "Dashboard" : "แดชบอร์ด", href: "/", icon: IconDashboard },
        { id: "settings", label: language === "en" ? "Settings" : "ตั้งค่า", href: "/settings", icon: IconSettings },
      ].filter(() => ["super_admin", "admin", "property_admin"].includes(role || ""))
    }
  ].filter(section => section.items.length > 0);

  return (
    <aside
      className={`w-72 flex-shrink-0 bg-[#0F172A] border-r border-[#D4AF37]/20 text-white ${className}`}
      aria-label="Primary Navigation"
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="border-b border-[#D4AF37]/20 px-6 py-8">
          <div className="flex justify-center">
            <Logo type="irm" width={140} height={140} />
          </div>
          <div className="mt-4 text-center">
            <h1 className="text-xl font-bold text-white">{APP_CONFIG.app.name}</h1>
            <p className="mt-1 text-sm text-slate-300">{APP_CONFIG.project.shortName}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-6">
          {navSections.map((section) => (
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