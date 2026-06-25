"use client";

import React from "react";
import {
  IconDashboard,
  IconProperty,
  IconResidents,
  IconRental,
  IconWorkOrders,
  IconVisitors,
  IconSecurity,
  IconReports,
  IconSettings,
} from "../../components/icons/LucideLike";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string; // placeholder for RBAC permission key
  badge?: string | number;
};

export const navConfig: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: <IconDashboard /> },
  { id: "property", label: "Property", href: "/property", icon: <IconProperty /> },
  { id: "residents", label: "Residents", href: "/residents", icon: <IconResidents /> },
  { id: "rental", label: "Rental", href: "/rental", icon: <IconRental /> },
  { id: "work-orders", label: "Work Orders", href: "/work-orders", icon: <IconWorkOrders /> },
  { id: "visitors", label: "Visitors", href: "/visitors", icon: <IconVisitors /> },
  { id: "security", label: "Security", href: "/security", icon: <IconSecurity /> },
  { id: "reports", label: "Reports", href: "/reports", icon: <IconReports /> },
  { id: "settings", label: "Settings", href: "/settings", icon: <IconSettings /> },
];

export default navConfig;
