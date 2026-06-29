"use client";

import React from "react";
import { AppShell } from "@/shared/layout";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}