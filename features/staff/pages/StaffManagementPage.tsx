"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { PageHeader, LoadingState, EmptyState, SearchInput } from "@/shared/ui";
import { useLanguage } from "@/providers/LanguageProvider";
import { Staff, StaffStats } from "../types/staff.types";
import { Property } from "@/features/property/types/property.types";
import { FiX, FiUserPlus, FiInfo, FiToggleLeft, FiToggleRight, FiEdit2 } from "react-icons/fi";
import { createClient } from "@/lib/supabase/client";

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Never";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function renderAvatar(firstName: string, lastName: string, photoUrl?: string | null) {
  if (photoUrl) {
    return <img src={photoUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" />;
  }
  const initials = ((firstName[0] || "") + (lastName[0] || "")).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-xs shrink-0 select-none">
      {initials || "ST"}
    </div>
  );
}

function renderInvitationBadge(status?: string | null) {
  const s = status || "NOT_SENT";
  let bg = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700";
  let label = "Not Sent";

  if (s === "INVITED") {
    bg = "bg-blue-50 text-blue-750 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
    label = "Invited";
  } else if (s === "ACCEPTED") {
    bg = "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30";
    label = "Accepted";
  } else if (s === "EXPIRED") {
    bg = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30";
    label = "Expired";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold ${bg}`}>
      {label}
    </span>
  );
}

function StaffManagementPageInner() {
  const { t, language } = useLanguage();
  const supabase = createClient();
  
  // Lists & Data
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StaffStats | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Drawer & Form States
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"view" | "create" | "edit">("view");
  
  // Form Fields
  const [employeeCode, setEmployeeCode] = useState("");
  const [prefix, setPrefix] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("property_admin");
  const [department, setDepartment] = useState("");
  const [team, setTeam] = useState("");
  const [languageField, setLanguageField] = useState("th");
  const [photoUrl, setPhotoUrl] = useState("");
  const [propertyId, setPropertyId] = useState("");

  const [formError, setFormError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/staff?stats=true");
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  // Fetch Staff List
  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (propertyFilter) params.set("propertyId", propertyFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/v1/staff?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data || []);
        setTotalCount(json.total || 0);
      }
    } catch (err) {
      console.error("Error fetching staff list:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, propertyFilter, statusFilter]);

  // Fetch Properties
  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/properties");
      const json = await res.json();
      if (json.success) {
        setProperties(json.data || []);
      }
    } catch (err) {
      console.error("Error fetching properties:", err);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchStaff();
      fetchStats();
      fetchProperties();
    });
  }, [fetchStaff, fetchStats, fetchProperties]);

  // Open Drawer in Create Mode
  const handleOpenCreate = () => {
    setSelectedStaff(null);
    setEmployeeCode("");
    setPrefix("");
    setFirstName("");
    setLastName("");
    setNickname("");
    setDisplayName("");
    setEmail("");
    setPhone("");
    setRole("property_admin");
    setDepartment("");
    setTeam("");
    setLanguageField("th");
    setPhotoUrl("");
    setPropertyId("");
    setFormError("");
    setActionSuccess("");
    setActivePin(null);
    setDrawerMode("create");
    setIsDrawerOpen(true);
  };

  // Open Drawer in View Mode
  const handleOpenView = (staff: Staff) => {
    if (!selectedStaff || selectedStaff.id !== staff.id) {
      setActivePin(null);
    }
    setSelectedStaff(staff);
    setEmployeeCode(staff.employee_code || "");
    setPrefix(staff.prefix || "");
    setFirstName(staff.first_name || "");
    setLastName(staff.last_name || "");
    setNickname(staff.nickname || "");
    setDisplayName(staff.display_name || "");
    setEmail(staff.email);
    setPhone(staff.phone || "");
    setRole(staff.role);
    setDepartment(staff.department || "");
    setTeam(staff.team || "");
    setLanguageField(staff.language || "th");
    setPhotoUrl(staff.photo_url || "");
    setPropertyId(staff.property_id || "");
    setFormError("");
    setActionSuccess("");
    setDrawerMode("view");
    setIsDrawerOpen(true);
  };

  // Switch to Edit Mode
  const handleEdit = () => {
    setFormError("");
    setActionSuccess("");
    setDrawerMode("edit");
  };

  // Save / Submit Staff Form (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setActionSuccess("");
    setSubmitting(true);

    try {
      const payload = {
        employee_code: employeeCode || undefined,
        prefix: prefix || null,
        first_name: firstName,
        last_name: lastName,
        nickname: nickname || null,
        display_name: displayName,
        email,
        phone: phone || null,
        role,
        department: department || null,
        team: team || null,
        language: languageField,
        photo_url: photoUrl || null,
        property_id: propertyId || null
      };

      const isEdit = drawerMode === "edit";
      const url = isEdit ? `/api/v1/staff/${selectedStaff?.id}` : "/api/v1/staff";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to save staff record.");
      }

      if (json.pin) {
        setActivePin(json.pin);
      } else {
        setActivePin(null);
      }
      setActionSuccess(isEdit ? "Staff updated successfully" : "Staff created successfully");
      fetchStaff();
      fetchStats();
      
      // Switch to view mode of the newly created/edited staff
      setTimeout(() => {
        handleOpenView(json.data);
      }, 1500);

    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Reset and generate a new Temporary PIN for staff
  const handleResetPin = async () => {
    if (!selectedStaff) return;
    if (!confirm("Are you sure you want to reset and generate a new Temporary PIN? The current PIN will be invalidated immediately.")) return;

    setSubmitting(true);
    setFormError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/v1/staff/${selectedStaff.id}/reset-pin`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActivePin(json.pin);
      setActionSuccess("Temporary PIN reset successfully.");
      
      // Refresh list/selected staff to sync auth_status
      fetchStaff();
      if (selectedStaff) {
        const { data: updatedProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", selectedStaff.id)
          .single();
        if (updatedProfile) {
          setSelectedStaff(prev => prev ? { ...prev, ...updatedProfile } : null);
        }
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to reset Temporary PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle activation (Deactivate / Activate)
  const handleToggleStatus = async () => {
    if (!selectedStaff) return;
    setSubmitting(true);
    setFormError("");
    setActionSuccess("");

    const willEnable = selectedStaff.status !== "active";

    try {
      const res = await fetch(`/api/v1/staff/${selectedStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: willEnable ? "active" : "inactive",
          account_status: willEnable ? "ACTIVE" : "DISABLED"
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccess(willEnable ? "Account activated successfully." : "Account deactivated successfully.");
      fetchStaff();
      fetchStats();
      
      setTimeout(() => {
        handleOpenView(json.data);
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to toggle status.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Floating Bulk Actions
  const handleBulkAction = async (action: string, param?: string) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    setFormError("");
    setActionSuccess("");
    try {
      const res = await fetch("/api/v1/staff/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ids: selectedIds,
          department: action === "change_department" ? param : undefined,
          team: action === "change_team" ? param : undefined
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      
      setSelectedIds([]);
      fetchStaff();
      fetchStats();
      setActionSuccess(json.message || "Bulk action executed successfully.");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to execute bulk action.");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Helper for displaying roles neatly
  const getRoleLabel = (roleStr: string) => {
    switch (roleStr) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "property_admin": return "Property Admin";
      case "office": return "Office Staff";
      case "security": return "Security";
      case "technician": return "Technician";
      case "housekeeping": return "Housekeeping";
      case "committee": return "Committee";
      default: return roleStr;
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title={t.staff?.title || "Staff Management"} />

        {/* Stats Metrics Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Staff</p>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">👤</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Active Staff</p>
                <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">✓</div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Disabled Staff</p>
                <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.disabled}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold">✕</div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {formError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <FiInfo className="text-sm shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <FiInfo className="text-sm shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Floating Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs shadow-sm">
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
              {selectedIds.length} staff selected
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleBulkAction("activate")}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition cursor-pointer"
              >
                Bulk Activate
              </button>
              <button
                onClick={() => handleBulkAction("disable")}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold transition cursor-pointer"
              >
                Bulk Disable
              </button>
              <button
                onClick={() => handleBulkAction("send_invitation")}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition cursor-pointer"
              >
                Resend Invite
              </button>
              <button
                onClick={() => handleBulkAction("reset_password")}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition cursor-pointer"
              >
                Reset Password
              </button>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAction("change_department", e.target.value);
                    e.target.value = "";
                  }
                }}
                className="px-2 py-1.5 border border-indigo-250 dark:border-indigo-800 rounded-lg outline-none cursor-pointer bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold"
              >
                <option value="">Set Dept...</option>
                <option value="Administration">Administration</option>
                <option value="Office">Office</option>
                <option value="Engineering">Engineering</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Security">Security</option>
                <option value="Committee">Committee</option>
              </select>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAction("change_team", e.target.value);
                    e.target.value = "";
                  }
                }}
                className="px-2 py-1.5 border border-indigo-250 dark:border-indigo-800 rounded-lg outline-none cursor-pointer bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold"
              >
                <option value="">Set Team...</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Air Conditioning">Air Conditioning</option>
                <option value="Lobby">Lobby</option>
                <option value="Pool">Pool</option>
                <option value="Garden">Garden</option>
              </select>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full md:w-auto">
            <SearchInput
              placeholder={t.staff?.searchPlaceholder || "Search by employee code, name, email, phone..."}
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Role: All</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="property_admin">Property Admin</option>
              <option value="office">Office Staff</option>
              <option value="security">Security</option>
              <option value="technician">Technician</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="committee">Committee</option>
            </select>

            <select
              value={propertyFilter}
              onChange={(e) => { setPropertyFilter(e.target.value); setPage(1); }}
              className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Property: All</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {language === "en" ? p.name_en : p.name_th}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Status: All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <FiUserPlus className="text-sm" />
              <span>{t.staff?.createStaff || "Add Staff"}</span>
            </button>
          </div>
        </div>

        {/* Staff Table Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <LoadingState message={t.common.loading} />
          ) : staffList.length === 0 ? (
            <EmptyState message={t.staff?.noStaffFound || "No staff members found."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="p-4 w-10">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-650 cursor-pointer"
                        checked={selectedIds.length === staffList.length && staffList.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(staffList.map(s => s.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="p-4">{t.staff?.employeeCode || "Code"}</th>
                    <th className="p-4">{t.staff?.fullName || "Name"}</th>
                    <th className="p-4">{t.staff?.role || "Role"}</th>
                    <th className="p-4">{t.staff?.department || "Dept & Team"}</th>
                    <th className="p-4">{t.staff?.property || "Property"}</th>
                    <th className="p-4">Invited</th>
                    <th className="p-4">Last Login</th>
                    <th className="p-4">{t.staff?.accountStatus || "Status"}</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {staffList.map((staff) => {
                    const isSelected = selectedIds.includes(staff.id);
                    return (
                      <tr
                        key={staff.id}
                        onClick={() => handleOpenView(staff)}
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition cursor-pointer ${
                          isSelected ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                        }`}
                      >
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-650 cursor-pointer"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds([...selectedIds, staff.id]);
                              } else {
                                setSelectedIds(selectedIds.filter(id => id !== staff.id));
                              }
                            }}
                          />
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-850 dark:text-slate-100">
                          {staff.employee_code || "-"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {renderAvatar(staff.first_name || "", staff.last_name || "", staff.photo_url)}
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {staff.prefix ? `${staff.prefix} ` : ""}{staff.full_name}{staff.nickname ? ` (${staff.nickname})` : ""}
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">{staff.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{getRoleLabel(staff.role)}</td>
                        <td className="p-4 text-slate-500 font-medium">
                          <div>{staff.department || "-"}</div>
                          {staff.team && <div className="text-[10px] text-slate-400 font-semibold">{staff.team}</div>}
                        </td>
                        <td className="p-4 font-medium text-slate-600 dark:text-slate-300">
                          {staff.property_id
                            ? (language === "en" ? staff.property_name_en : staff.property_name_th)
                            : "All Properties"}
                        </td>
                        <td className="p-4">
                          {renderInvitationBadge(staff.invitation_status)}
                        </td>
                        <td className="p-4 text-slate-450 font-medium">
                          {formatRelativeTime(staff.last_login)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                              staff.status === "active"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                            }`}
                          >
                            <span className={`w-1 h-1 rounded-full mr-1.5 ${staff.status === "active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                            {staff.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenView(staff)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-lg font-medium transition cursor-pointer text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination bar */}
        {!loading && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm text-xs">
            <span className="text-slate-400 font-semibold">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of {totalCount} staff members
            </span>
            <div className="flex items-center gap-1 font-semibold">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                First
              </button>
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-semibold">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Next
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details/Forms Sliding Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {drawerMode === "create" ? (t.staff?.createStaff || "Add Staff") : drawerMode === "edit" ? (t.staff?.editStaff || "Edit Staff") : "Staff Profile Details"}
                </h3>
                {selectedStaff && (
                  <p className="text-[10px] text-indigo-550 font-mono mt-0.5">ID: {selectedStaff.id}</p>
                )}
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerMode === "view" && selectedStaff ? (
                // View Mode Profile Detail Card
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-4">
                    <div className="flex items-center gap-4">
                      {renderAvatar(selectedStaff.first_name || "", selectedStaff.last_name || "", selectedStaff.photo_url)}
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {selectedStaff.prefix ? `${selectedStaff.prefix} ` : ""}{selectedStaff.full_name}{selectedStaff.nickname ? ` (${selectedStaff.nickname})` : ""}
                        </h4>
                        <p className="text-xs text-slate-400 font-semibold">{getRoleLabel(selectedStaff.role)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650 dark:text-slate-300">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Employee Code</p>
                      <p className="mt-1 font-mono font-bold text-slate-800 dark:text-slate-100">
                        {selectedStaff.employee_code || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Auth Status</p>
                      <p className="mt-1 uppercase tracking-wider text-[11px] font-bold text-slate-800 dark:text-slate-100">
                        {selectedStaff.auth_status || "PENDING"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Display Name</p>
                      <p className="mt-1 text-slate-800 dark:text-slate-100">
                        {selectedStaff.display_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Email</p>
                      <p className="mt-1 text-slate-850 dark:text-slate-100">{selectedStaff.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Phone</p>
                      <p className="mt-1 text-slate-850 dark:text-slate-100">{selectedStaff.phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Department</p>
                      <p className="mt-1 text-slate-800 dark:text-slate-100">{selectedStaff.department || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Team</p>
                      <p className="mt-1 text-slate-800 dark:text-slate-100">{selectedStaff.team || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Preferred Language</p>
                      <p className="mt-1 text-slate-800 dark:text-slate-100">{selectedStaff.language === "en" ? "English" : "Thai"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Property</p>
                      <p className="mt-1 text-slate-850 dark:text-slate-100">
                        {selectedStaff.property_id
                          ? (language === "en" ? selectedStaff.property_name_en : selectedStaff.property_name_th)
                          : "All Properties"}
                      </p>
                    </div>
                  </div>

                  {(selectedStaff.auth_status !== "ACTIVE") && (
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Temporary Activation PIN</span>
                          <span className="font-mono text-sm font-bold text-slate-800 dark:text-white">
                            {activePin || "******"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {activePin && (
                            <>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(activePin);
                                  alert("Temporary PIN copied to clipboard!");
                                }}
                                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-350 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]"
                                title="Copy PIN"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => {
                                  const printWindow = window.open("", "_blank");
                                  if (printWindow) {
                                    printWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>Print Temporary PIN</title>
                                          <style>
                                            body { font-family: sans-serif; text-align: center; padding: 40px; }
                                            .pin-box { border: 2px dashed #000; padding: 20px; display: inline-block; font-size: 24px; font-family: monospace; letter-spacing: 4px; }
                                            .instructions { font-size: 14px; margin-top: 20px; color: #555; }
                                          </style>
                                        </head>
                                        <body>
                                          <h2>Temporary Activation PIN</h2>
                                          <p><strong>Employee:</strong> ${selectedStaff.full_name}</p>
                                          <p><strong>Code:</strong> ${selectedStaff.employee_code || ""}</p>
                                          <div class="pin-box">${activePin}</div>
                                          <div class="instructions">Use this PIN to activate your Employee account at Login.</div>
                                          <script>window.print();</script>
                                        </body>
                                      </html>
                                    `);
                                    printWindow.document.close();
                                  }
                                }}
                                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-350 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]"
                                title="Print PIN"
                              >
                                Print
                              </button>
                            </>
                          )}
                          <button
                            onClick={handleResetPin}
                            disabled={submitting}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-[10px] font-bold uppercase transition"
                          >
                            Reset PIN
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <hr className="border-slate-100 dark:border-slate-800" />

                  {/* Admin actions block */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Administrative Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleEdit}
                        className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        <FiEdit2 />
                        <span>Edit Details</span>
                      </button>
                      <button
                        onClick={handleToggleStatus}
                        disabled={submitting}
                        className={`py-2.5 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          selectedStaff.status === "active"
                            ? "bg-rose-600 hover:bg-rose-500"
                            : "bg-emerald-600 hover:bg-emerald-500"
                        }`}
                      >
                        {selectedStaff.status === "active" ? (
                          <>
                            <FiToggleLeft />
                            <span>Deactivate</span>
                          </>
                        ) : (
                          <>
                            <FiToggleRight />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Form Fields (Create or Edit Mode)
                <form id="staff-form" onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Employee Code {drawerMode === "edit" ? "" : "(Leave empty to auto-generate)"}
                    </label>
                    <input
                      type="text"
                      disabled={drawerMode === "edit"}
                      placeholder={drawerMode === "edit" ? employeeCode : "Auto Generated Sequential Code"}
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Prefix
                      </label>
                      <input
                        type="text"
                        placeholder="Mr., Ms."
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Nickname
                      </label>
                      <input
                        type="text"
                        placeholder="Nick"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. JD"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      disabled={drawerMode === "edit"}
                      placeholder="johndoe@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0812345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Role <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="property_admin">Property Admin</option>
                        <option value="office">Office Staff</option>
                        <option value="security">Security</option>
                        <option value="technician">Technician</option>
                        <option value="housekeeping">Housekeeping</option>
                        <option value="committee">Committee</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Department
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">No Department</option>
                        <option value="Administration">Administration</option>
                        <option value="Office">Office</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Housekeeping">Housekeeping</option>
                        <option value="Security">Security</option>
                        <option value="Committee">Committee</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Team
                      </label>
                      <select
                        value={team}
                        onChange={(e) => setTeam(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">No Team</option>
                        <option value="Cleaning">Cleaning</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Air Conditioning">Air Conditioning</option>
                        <option value="Lobby">Lobby</option>
                        <option value="Pool">Pool</option>
                        <option value="Garden">Garden</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                        Preferred Language
                      </label>
                      <select
                        value={languageField}
                        onChange={(e) => setLanguageField(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="th">Thai (th)</option>
                        <option value="en">English (en)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Photo URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://example.com/avatar.png"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                      Property Assignment
                    </label>
                    <select
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">All Properties (Global Access)</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {language === "en" ? p.name_en : p.name_th}
                        </option>
                      ))}
                    </select>
                  </div>
                </form>
              )}
            </div>

            {/* Footer */}
            {drawerMode !== "view" && (
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  type="button"
                  onClick={() => {
                    if (drawerMode === "edit" && selectedStaff) {
                      handleOpenView(selectedStaff);
                    } else {
                      setIsDrawerOpen(false);
                    }
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="staff-form"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Details"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </MainLayout>
  );
}

export function StaffManagementPage() {
  return (
    <Suspense fallback={<MainLayout><div className="p-6 text-center text-slate-500">Loading staff data...</div></MainLayout>}>
      <StaffManagementPageInner />
    </Suspense>
  );
}
export default StaffManagementPage;
