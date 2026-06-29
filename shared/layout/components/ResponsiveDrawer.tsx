"use client";

import React from "react";

interface ResponsiveDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ResponsiveDrawer({ open, onClose, children }: ResponsiveDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer body */}
      <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-[#0F172A] border-r border-[#D4AF37]/20 shadow-2xl transition-transform duration-300">
        <div className="absolute right-4 top-4">
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
