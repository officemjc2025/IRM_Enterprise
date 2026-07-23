"use client";

import React, { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";

interface ScaffoldProfile {
  id: string;
  email: string;
  role: string;
  property_id: string | null;
  account_status: string | null;
  is_active: boolean;
  department: string | null;
  team: string | null;
}

interface ScaffoldPerson {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ScaffoldAssignment {
  id: string;
  unit_id: string;
  unit_number: string;
  building_code: string;
  floor: string;
  property_id: string;
  resident_type: string;
  is_primary: boolean;
}

interface ScaffoldUserData {
  profile: ScaffoldProfile;
  person: ScaffoldPerson | null;
  assignments: ScaffoldAssignment[];
}

interface UnifiedPortalScaffoldProps {
  allowedRoles: string[];
  portalName: string;
  portalIcon: string;
  placeholderCards: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
}

export default function UnifiedPortalScaffold({
  allowedRoles,
  portalName,
  portalIcon,
  placeholderCards
}: UnifiedPortalScaffoldProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState<ScaffoldUserData | null>(null);

  useEffect(() => {
    async function checkAuthAndLoad() {
      try {
        setLoading(true);
        setError("");

        // 1. Fetch resolved identity
        const res = await fetch("/api/v1/portal/me");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        const json = await res.json();
        if (!json.success || !json.data) {
          setError(json.message || "Failed to retrieve account details.");
          setLoading(false);
          return;
        }

        const data = json.data as ScaffoldUserData;
        const profile = data.profile;

        // 2. Authorization constraints validation
        if (!profile) {
          setError("No profile found.");
          setLoading(false);
          return;
        }

        // Active status check
        if (!profile.is_active) {
          setError("Access Denied: Your account is inactive.");
          setLoading(false);
          return;
        }

        // Account status check
        if (!profile.account_status) {
          setError("Access Denied: Configuration Error.");
          setLoading(false);
          return;
        }

        if (profile.account_status !== "ACTIVE") {
          setError(`Access Denied: Your account status is ${profile.account_status}.`);
          setLoading(false);
          return;
        }

        // Role verification
        const userRole = (profile.role || "").toLowerCase();
        const allowedLower = allowedRoles.map(r => r.toLowerCase());
        if (!allowedLower.includes(userRole)) {
          setError("Forbidden: You do not have permission to access this portal.");
          setLoading(false);
          return;
        }

        setUserData(data);
      } catch (err) {
        console.error("Error loading portal:", err);
        setError("An unexpected error occurred while verifying access.");
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoad();
  }, [allowedRoles, router]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-slate-500 font-semibold animate-pulse">Loading dashboard...</div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto mt-12 p-8 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="text-3xl">⚠️</div>
          <h3 className="text-lg font-bold">Access Restrained</h3>
          <p className="text-xs leading-relaxed">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition"
          >
            Go to Login
          </button>
        </div>
      </MainLayout>
    );
  }

  const { profile, person, assignments } = userData || {};

  // Resolve Property Name
  const primaryAssignment = assignments?.[0];
  const propertyName = primaryAssignment?.unit_number
    ? `Property ID: ${primaryAssignment.property_id || "Main Residence"}`
    : "No property assigned";

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#D4AF37]/10 text-2xl rounded-xl flex items-center justify-center text-[#D4AF37]">
              {portalIcon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {portalName}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                  {profile?.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Welcome back, {person?.first_name || profile?.email || "User"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
              System Active
            </span>
          </div>
        </div>

        {/* User Identity Details & Assignment Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Details */}
          <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Current User</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-[10px] text-slate-400 block">Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {person ? `${person.first_name} ${person.last_name}` : "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Email</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 break-all">
                  {profile?.email || "-"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Phone</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {person?.phone || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Property */}
          <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Assigned Property</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-[10px] text-slate-400 block">Property Details</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  {propertyName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Verification Status</span>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Units */}
          <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Assigned Units</h3>
            <div className="max-h-[140px] overflow-y-auto space-y-2 text-sm pr-1">
              {assignments && assignments.length > 0 ? (
                assignments.map((assignment: ScaffoldAssignment, index: number) => (
                  <div
                    key={assignment.id || index}
                    className="flex justify-between items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Unit {assignment.unit_number || "Room"}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Building {assignment.building_code || "-"} • Floor {assignment.floor || "-"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">
                      {assignment.resident_type || "ASSIGNED"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 py-6 text-center">
                  No active unit assignments resolved.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Placeholders */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Portal Services</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {placeholderCards.map((card, index) => (
              <div
                key={index}
                className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-3 opacity-80"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-lg">{card.icon}</span>
                  <h4 className="font-bold text-slate-850 dark:text-slate-200 text-sm">
                    {card.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {card.description}
                </p>
                <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 uppercase tracking-widest">
                  Under Construction
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
