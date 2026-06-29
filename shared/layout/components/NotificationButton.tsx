"use client";

import React, { useState } from "react";

export function NotificationButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        aria-label="View notifications"
      >
        <span>🔔</span>
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#0F172A]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-2 z-20">
            <div className="px-4 py-1.5 border-b border-slate-700 font-semibold text-sm text-white flex justify-between items-center">
              <span>Notifications</span>
              <span className="text-xs text-[#D4AF37]">3 unread</span>
            </div>
            <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
              <div className="px-4 py-3 text-xs hover:bg-slate-700 text-slate-300">
                <p className="font-semibold text-white">System Update Completed</p>
                <p className="mt-0.5 text-slate-400">All business units have been updated successfully.</p>
                <span className="text-[10px] text-slate-500 block mt-1">2 hours ago</span>
              </div>
              <div className="px-4 py-3 text-xs hover:bg-slate-700 text-slate-300">
                <p className="font-semibold text-white">New Occupancy Created</p>
                <p className="mt-0.5 text-slate-400">Unit 102 was assigned to Person John Doe.</p>
                <span className="text-[10px] text-slate-500 block mt-1">5 hours ago</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
