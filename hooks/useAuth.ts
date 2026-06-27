"use client";

import { authService } from "@/services/auth.service";

export function useAuth() {
  return authService;
}