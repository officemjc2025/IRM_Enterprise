"use client";

import React from "react";
import UnifiedPortalScaffold from "@/components/portal/UnifiedPortalScaffold";

export default function StaffPortalPage() {
  const placeholderCards = [
    {
      title: "Task Queue",
      description: "Manage daily tasks, reception services, parcel arrivals, and resident requests.",
      icon: "📋"
    },
    {
      title: "Announcements Control",
      description: "Draft and post property announcements and pin urgent notices.",
      icon: "📢"
    },
    {
      title: "Contact Directory",
      description: "Search corporate contact directories and active technician duty rosters.",
      icon: "📞"
    }
  ];

  return (
    <UnifiedPortalScaffold
      allowedRoles={["staff", "property_admin"]}
      portalName="Staff Portal"
      portalIcon="📋"
      placeholderCards={placeholderCards}
    />
  );
}
