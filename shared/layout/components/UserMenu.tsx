"use client";

import React, { useState, useContext } from "react";
import { AuthContext } from "@/providers/AuthProvider";
import { RoleBadge } from "./RoleBadge";
import { authService } from "@/services/auth/auth.service";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const auth = useContext(AuthContext);
  const router = useRouter();

  if (!auth || !auth.user) return null;

  const profile = auth.profile;
  const name = profile?.display_name || profile?.full_name || auth.user.email?.split("@")[0] || "User";
  const email = auth.user.email || "";
  const role = profile?.role || "guest";

  const handleLogout = async () => {
    try {
      await authService.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 focus:outline-none"
      >
        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center font-bold text-sm text-white uppercase">
          {name[0]}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-sm font-semibold text-white truncate max-w-[120px]">{name}</span>
          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{email}</span>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 z-20">
            <div className="px-4 py-2 border-b border-slate-700 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-400">Current Role</span>
              <RoleBadge role={role.toUpperCase().replace(/_/g, " ")} />
            </div>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              onClick={(e) => { e.preventDefault(); alert("Profile page is a placeholder"); }}
            >
              My Profile
            </a>
            <button
              onClick={handleLogout}
              className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
