import { ComponentType } from "react";
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
  labelKey: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string | number;
};

export const navConfig: NavItem[] = [
  { id: "dashboard", labelKey: "dashboard", href: "/", icon: IconDashboard },
  { id: "property", labelKey: "property", href: "/property", icon: IconProperty },
  { id: "residents", labelKey: "residents", href: "/residents", icon: IconResidents },
  { id: "rental", labelKey: "rental", href: "/rental", icon: IconRental },
  { id: "work-orders", labelKey: "workOrders", href: "/work-orders", icon: IconWorkOrders },
  { id: "visitors", labelKey: "visitors", href: "/visitors", icon: IconVisitors },
  { id: "security", labelKey: "security", href: "/security", icon: IconSecurity },
  { id: "reports", labelKey: "reports", href: "/reports", icon: IconReports },
  { id: "settings", labelKey: "settings", href: "/settings", icon: IconSettings },
];

export default navConfig;