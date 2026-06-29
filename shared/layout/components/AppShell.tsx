"use client";

import React, { useEffect, useState, useContext } from "react";
import { Sidebar } from "./Sidebar";
import { TopNavigation } from "./TopNavigation";
import { ResponsiveDrawer } from "./ResponsiveDrawer";
import { PageContainer } from "./PageContainer";
import { usePathname } from "next/navigation";
import { AuthContext } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";
import { Permissions } from "@/shared/auth/permissions";
import { hasPermission } from "@/shared/auth/guard";
import { ErrorState } from "./ErrorState";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const auth = useContext(AuthContext);
  const { t } = useLanguage();

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        setCollapsed(true);
      }
    });
  }, []);

  const handleSetCollapsed = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem("sidebar_collapsed", String(val));
  };

  const getRequiredPermissions = (path: string): readonly string[] | null => {
    if (
      path.startsWith("/properties") ||
      path.startsWith("/units") ||
      path.startsWith("/persons") ||
      path.startsWith("/occupancies") ||
      path.startsWith("/owners") ||
      path.startsWith("/import")
    ) {
      return Permissions.ManageProperty;
    }
    if (path.startsWith("/visitors")) {
      return Permissions.SecurityGate;
    }
    if (path.startsWith("/work-orders")) {
      return Permissions.WorkOrder;
    }
    if (path.startsWith("/residents")) {
      return Permissions.ResidentPortal;
    }
    return null;
  };

  const requiredRoles = getRequiredPermissions(pathname);
  const userRole = auth?.profile?.role;
  const isAuthorized =
    !requiredRoles ||
    (userRole && (
      userRole === "super_admin" ||
      userRole === "property_admin" ||
      userRole === "manager" ||
      hasPermission(userRole, requiredRoles)
    ));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <TopNavigation onMenuClick={() => setMobileOpen(true)} />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block h-full">
          <Sidebar
            collapsed={collapsed}
            setCollapsed={handleSetCollapsed}
            onClose={() => setMobileOpen(false)}
          />
        </div>

        {/* Mobile Responsive Drawer */}
        <ResponsiveDrawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
          <Sidebar
            onClose={() => setMobileOpen(false)}
            collapsed={false}
            setCollapsed={() => {}}
          />
        </ResponsiveDrawer>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <PageContainer>
            {isAuthorized ? (
              children
            ) : (
              <ErrorState
                title={t.common.accessDenied}
                message={t.common.accessDeniedMessage}
              />
            )}
          </PageContainer>
        </div>
      </div>
    </div>
  );
}
