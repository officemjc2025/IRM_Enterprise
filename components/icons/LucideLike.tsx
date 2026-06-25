"use client";

import React from "react";

type IconProps = { className?: string; size?: number };

export const IconDashboard = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="7" height="9" rx="1"></rect>
    <rect x="14" y="3" width="7" height="5" rx="1"></rect>
    <rect x="14" y="12" width="7" height="9" rx="1"></rect>
    <rect x="3" y="16" width="7" height="5" rx="1"></rect>
  </svg>
);

export const IconProperty = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 11.5L12 4l9 7.5"></path>
    <path d="M9 22V12h6v10"></path>
  </svg>
);

export const IconResidents = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M4 21v-2a4 4 0 0 1 3-3.87"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

export const IconRental = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 9l9-6 9 6"></path>
    <path d="M9 22V12h6v10"></path>
  </svg>
);

export const IconWorkOrders = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="7" width="20" height="14" rx="2"></rect>
    <path d="M16 3v4"></path>
    <path d="M8 3v4"></path>
    <path d="M2 11h20"></path>
  </svg>
);

export const IconVisitors = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="7" r="4"></circle>
    <path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path>
  </svg>
);

export const IconSecurity = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 2l7 4v6a7 7 0 0 1-14 0V6l7-4z"></path>
  </svg>
);

export const IconReports = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7h18"></path>
    <path d="M7 7v14"></path>
    <path d="M17 7v14"></path>
  </svg>
);

export const IconSettings = ({ className = "", size = 16 }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 2.28 18.9l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.7 0 1.3-.48 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 6.1 2.28l.06.06c.45.45 1.2.55 1.82.33.5-.17 1.03-.27 1.51-.27H12a2 2 0 1 1 4 0h.09c.48 0 1.01.1 1.51.27.62.22 1.37.12 1.82-.33l.06-.06A2 2 0 1 1 21.72 5.1l-.06.06c-.17.5-.27 1.03-.27 1.51V8c0 .48.1 1.01.27 1.51.22.62.12 1.37-.33 1.82l-.06.06c-.49.49-.59 1.24-.33 1.82z"></path>
  </svg>
);

export default {};
