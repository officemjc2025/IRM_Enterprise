"use client";

import React from "react";
import { Breadcrumb } from "./Breadcrumb";

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <Breadcrumb />
      <div>{children}</div>
    </div>
  );
}
