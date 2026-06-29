import { ComponentType } from "react";
import {
  IconDashboard,
  IconProperty,
  IconResidents,
  IconRental,
  IconVisitors,
  IconSettings,
} from "../../components/icons/LucideLike";

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

export type NavSection = {
  section: string;
  items: NavItem[];
};

export const navConfig: NavSection[] = [
  {
    section: "Master Data",
    items: [
      { id: "properties", label: "Properties", href: "/properties", icon: IconProperty },
      { id: "units", label: "Units", href: "/units", icon: IconProperty },
      { id: "owners", label: "Owners", href: "/owners", icon: IconResidents },
      { id: "persons", label: "Persons", href: "/persons", icon: IconResidents },
      { id: "occupancies", label: "Occupancies", href: "/occupancies", icon: IconRental },
    ]
  },
  {
    section: "Operations",
    items: [
      { id: "import", label: "Import Master Data", href: "/import", icon: IconDashboard },
      { id: "search", label: "Search", href: "/search", icon: IconVisitors },
    ]
  },
  {
    section: "System",
    items: [
      { id: "dashboard", label: "Dashboard (Placeholder)", href: "/", icon: IconDashboard },
      { id: "settings", label: "Settings (Placeholder)", href: "/settings", icon: IconSettings },
    ]
  }
];

export default navConfig;