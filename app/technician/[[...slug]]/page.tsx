"use client";

import React, { use, Suspense } from "react";
import UnifiedStaffWorkspace from "@/components/portal/UnifiedStaffWorkspace";
import { LoadingState } from "@/shared/ui";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default function TechnicianPortalPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const view = slug?.[0] || "dashboard";

  return (
    <Suspense fallback={<LoadingState />}>
      <UnifiedStaffWorkspace
        workspace="technician"
        view={view}
      />
    </Suspense>
  );
}
