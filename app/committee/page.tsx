"use client";

import React from "react";
import UnifiedPortalScaffold from "@/components/portal/UnifiedPortalScaffold";

export default function CommitteePortalPage() {
  const placeholderCards = [
    {
      title: "Committee Board Votes",
      description: "Cast votes on community resolutions, budget approvals, and property policies.",
      icon: "⚖️"
    },
    {
      title: "Community Complaints",
      description: "Review escalated resident complaints and provide administrative feedback.",
      icon: "⚠️"
    },
    {
      title: "Meeting Minutes",
      description: "Access official committee resolution archives and historical minutes.",
      icon: "📝"
    }
  ];

  return (
    <UnifiedPortalScaffold
      allowedRoles={["committee"]}
      portalName="Committee Portal"
      portalIcon="⚖️"
      placeholderCards={placeholderCards}
    />
  );
}
