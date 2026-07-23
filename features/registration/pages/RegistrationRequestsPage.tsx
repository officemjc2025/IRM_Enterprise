"use client";

import React, { useEffect, useState, useCallback } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { PageHeader, LoadingState, EmptyState } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import {
  RegistrationRequest,
  RegistrationStatus,
  RegistrationStats
} from "../types/registration.types";
import { SearchableSelect } from "@/shared/ui/SearchableSelect";
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiSliders,
  FiCheckCircle,
  FiAlertCircle,
  FiSettings,
  FiList,
  FiActivity,
  FiClock,
  FiXCircle,
  FiInfo,
  FiCalendar
} from "react-icons/fi";

import { Property } from "@/features/property/types/property.types";

export default function RegistrationRequestsPage() {
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserPropId, setCurrentUserPropId] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"queue" | "settings">("queue");

  // Lists
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Stats
  const [stats, setStats] = useState<RegistrationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Settings Tab State
  const [settingsPropertyId, setSettingsPropertyId] = useState<string>("");
  const [settingsEnabled, setSettingsEnabled] = useState<boolean>(true);
  const [settingsMessage, setSettingsMessage] = useState<string>("");
  const [settingsOwner, setSettingsOwner] = useState<boolean>(true);
  const [settingsCoOwner, setSettingsCoOwner] = useState<boolean>(true);
  const [settingsResident, setSettingsResident] = useState<boolean>(true);
  const [settingsTenant, setSettingsTenant] = useState<boolean>(true);
  const [settingsFamilyMember, setSettingsFamilyMember] = useState<boolean>(true);
  const [settingsTechnician, setSettingsTechnician] = useState<boolean>(true);
  const [settingsHousekeeping, setSettingsHousekeeping] = useState<boolean>(true);
  const [settingsSecurity, setSettingsSecurity] = useState<boolean>(true);
  const [settingsCommittee, setSettingsCommittee] = useState<boolean>(true);
  const [settingsStaff, setSettingsStaff] = useState<boolean>(true);
  const [settingsActivationMethod, setSettingsActivationMethod] = useState<"SUPABASE_EMAIL" | "TEMP_PASSWORD" | "MANUAL">("SUPABASE_EMAIL");
  const [settingsEmailNotifications, setSettingsEmailNotifications] = useState<boolean>(true);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  
  interface AssociatedProfile {
    force_password_change: boolean;
    accepted_terms_at: string | null;
    status: string;
    account_status: string;
    invitation_status?: string | null;
    auth_status?: string | null;
    password_changed_at?: string | null;
    first_login_at?: string | null;
  }
  
  // Associated profile state (when viewing detail drawer)
  const [associatedProfile, setAssociatedProfile] = useState<AssociatedProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // Pagination, Search & Filters
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [relationship, setRelationship] = useState<string>("");
  const [regType, setRegType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Drawer
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activePin, setActivePin] = useState<string | null>(null);

  // Confirmation Modal
  const [modalAction, setModalAction] = useState<{
    request: RegistrationRequest;
    targetStatus: RegistrationStatus;
  } | null>(null);
  const [modalRemarks, setModalRemarks] = useState<string>("");
  const [modalReason, setModalReason] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  // Supabase browser client
  const supabase = React.useMemo(() => createClient(), []);

  // Fetch user role
  useEffect(() => {
    async function fetchUserRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, property_id")
            .eq("id", user.id)
            .single();

          if (profile) {
            setCurrentUserRole(profile.role);
            setCurrentUserPropId(profile.property_id);
            // If user is property_admin or office, auto-scope propertyId filter
            if (["property_admin", "office"].includes(profile.role) && profile.property_id) {
              setPropertyId(profile.property_id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
      }
    }
    fetchUserRole();
  }, [supabase]);

  // Fetch properties for filters
  useEffect(() => {
    async function loadProperties() {
      try {
        const res = await fetch("/api/v1/properties");
        const json = await res.json();
        if (json.success) {
          setProperties(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load properties:", err);
      }
    }
    loadProperties();
  }, []);

  // Fetch registration requests
  const fetchRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", page.toString());
      queryParams.set("limit", limit.toString());
      if (search) queryParams.set("search", search);
      if (status) queryParams.set("status", status);
      if (propertyId) queryParams.set("property_id", propertyId);
      if (relationship) queryParams.set("relationship", relationship);
      if (regType) queryParams.set("registration_type", regType);
      if (dateFrom) queryParams.set("date_from", dateFrom);
      if (dateTo) queryParams.set("date_to", dateTo);

      const res = await fetch(`/api/v1/registration-requests?${queryParams.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRequests(json.data || []);
        setTotalCount(json.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch registration requests:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, propertyId, relationship, regType, dateFrom, dateTo, limit]);

  // Fetch stats from server
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const paramPropId = ["property_admin", "office"].includes(currentUserRole || "") ? currentUserPropId : propertyId;
      const url = paramPropId
        ? `/api/v1/registration-requests/stats?property_id=${paramPropId}`
        : "/api/v1/registration-requests/stats";

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [currentUserRole, currentUserPropId, propertyId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchRequests();
    });
  }, [fetchRequests]);

  useEffect(() => {
    if (currentUserRole !== null) {
      queueMicrotask(() => {
        fetchStats();
      });
    }
  }, [fetchStats, currentUserRole]);

  // Load Settings Tab data
  const fetchSettings = useCallback(async (propId: string) => {
    if (!propId) return;
    try {
      setLoadingSettings(true);
      const res = await fetch(`/api/v1/registration-requests/settings?property_id=${propId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const s = json.data;
        setSettingsEnabled(s.enabled);
        setSettingsMessage(s.maintenance_message || "");
        setSettingsOwner(s.allow_owner);
        setSettingsCoOwner(s.allow_co_owner);
        setSettingsResident(s.allow_resident);
        setSettingsTenant(s.allow_tenant);
        setSettingsFamilyMember(s.allow_family_member);
        setSettingsTechnician(s.allow_technician);
        setSettingsHousekeeping(s.allow_housekeeping);
        setSettingsSecurity(s.allow_security);
        setSettingsCommittee(s.allow_committee);
        setSettingsStaff(s.allow_staff);
        if (s.activation_method) {
          setSettingsActivationMethod(s.activation_method);
        }
        if (s.email_notifications_enabled !== undefined) {
          setSettingsEmailNotifications(s.email_notifications_enabled);
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (currentUserRole === "property_admin" && currentUserPropId) {
      queueMicrotask(() => {
        setSettingsPropertyId(currentUserPropId);
      });
    } else if (properties.length > 0 && !settingsPropertyId) {
      queueMicrotask(() => {
        setSettingsPropertyId(properties[0].id);
      });
    }
  }, [currentUserRole, currentUserPropId, properties, settingsPropertyId]);

  useEffect(() => {
    if (settingsPropertyId) {
      queueMicrotask(() => {
        fetchSettings(settingsPropertyId);
      });
    }
  }, [settingsPropertyId, fetchSettings]);

  useEffect(() => {
    async function loadApplicantProfile() {
      if (selectedRequest && selectedRequest.profile_id) {
        try {
          setLoadingProfile(true);
          const { data, error } = await supabase
            .from("profiles")
            .select("force_password_change, accepted_terms_at, status, account_status, invitation_status")
            .eq("id", selectedRequest.profile_id)
            .single();
          if (!error && data) {
            setAssociatedProfile(data);
          } else {
            setAssociatedProfile(null);
          }
        } catch (err) {
          console.error("Error loading associated profile:", err);
          setAssociatedProfile(null);
        } finally {
          setLoadingProfile(false);
        }
      } else {
        setAssociatedProfile(null);
      }
    }
    loadApplicantProfile();
  }, [selectedRequest, supabase]);

  // Save Settings Submit
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsPropertyId) return;

    try {
      setSavingSettings(true);
      const payload = {
        property_id: settingsPropertyId,
        enabled: settingsEnabled,
        maintenance_message: settingsMessage.trim() || null,
        allow_owner: settingsOwner,
        allow_co_owner: settingsCoOwner,
        allow_resident: settingsResident,
        allow_tenant: settingsTenant,
        allow_family_member: settingsFamilyMember,
        allow_technician: settingsTechnician,
        allow_housekeeping: settingsHousekeeping,
        allow_security: settingsSecurity,
        allow_committee: settingsCommittee,
        allow_staff: settingsStaff,
        activation_method: settingsActivationMethod,
        email_notifications_enabled: settingsEmailNotifications,
      };

      const res = await fetch("/api/v1/registration-requests/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        alert("Settings saved successfully.");
      } else {
        alert(json.message || "Failed to save settings.");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("An unexpected error occurred while saving settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleManualActivate = async (id: string) => {
    if (!confirm("Are you sure you want to activate this account and generate a Temporary PIN?")) return;

    try {
      setActionSubmitting(true);
      const res = await fetch(`/api/v1/registration-requests/${id}/activate`, {
        method: "POST"
      });
      const json = await res.json();
      if (json.success) {
        const actResult = json.activationResult;
        if (json.pin) {
          setActivePin(json.pin);
          alert(`Account activated successfully!\n\nTemporary PIN: ${json.pin}\n\nPlease copy or print this PIN for the resident.`);
        } else if (actResult === "ALREADY_ACTIVATED") {
          alert("Account activation skipped: The user has already activated their account previously. Resident assignment was successfully created.");
        } else if (actResult === "PASSWORD_RESET_REQUIRED") {
          alert("Account already exists: This user already has a pending or registered account. Reset PIN to generate a new activation PIN.");
        } else if (json.warningMessage) {
          alert(`Account activated successfully.\n\nWARNING: ${json.warningMessage}`);
        } else {
          alert("Account activated successfully.");
        }
        
        // Refresh request details
        const updatedReq = json.data?.request ? json.data.request : json.data;
        setSelectedRequest(updatedReq);
        fetchRequests();
        fetchStats();
        if (updatedReq?.profile_id) {
          const { data: pData } = await supabase
            .from("profiles")
            .select("force_password_change, accepted_terms_at, status, account_status, invitation_status, auth_status")
            .eq("id", updatedReq.profile_id)
            .single();
          if (pData) setAssociatedProfile(pData);
        }
      } else {
        alert(json.message || "Failed to manually activate account.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      alert(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleResetPin = async (id: string) => {
    if (!confirm("Are you sure you want to reset and generate a new Temporary PIN? The current PIN will be invalidated immediately.")) return;

    try {
      setActionSubmitting(true);
      const res = await fetch(`/api/v1/registration-requests/${id}/reset-pin`, {
        method: "POST"
      });
      const json = await res.json();
      if (json.success) {
        setActivePin(json.pin);
        alert(`New Temporary PIN generated successfully: ${json.pin}`);
        fetchRequests();
        fetchStats();
        if (selectedRequest?.profile_id) {
          const { data: pData } = await supabase
            .from("profiles")
            .select("force_password_change, accepted_terms_at, status, account_status, invitation_status, auth_status")
            .eq("id", selectedRequest.profile_id)
            .single();
          if (pData) setAssociatedProfile(pData);
        }
      } else {
        alert(json.message || "Failed to reset Temporary PIN.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      alert(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle Workflow Status Updates
  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAction) return;

    // Validation: Require reason for Reject or Request More Info
    const requireReason =
      modalAction.targetStatus === RegistrationStatus.REJECTED ||
      modalAction.targetStatus === RegistrationStatus.MORE_INFO;

    if (requireReason && !modalReason.trim()) {
      alert("A reason is required for this action.");
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await fetch(`/api/v1/registration-requests/${modalAction.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: modalAction.targetStatus,
          remarks: modalRemarks.trim() || null,
          rejection_reason: requireReason ? modalReason.trim() : null
        })
      });

      const json = await res.json();
      if (json.success) {
        // Refresh detail in drawer if currently open
        if (selectedRequest && selectedRequest.id === modalAction.request.id) {
          const reqObj = json.data?.request ? json.data.request : json.data;
          setSelectedRequest(reqObj);

          const actResult = json.activationResult;
          if (json.pin) {
            setActivePin(json.pin);
            alert(`Approval Success!\n\nTemporary PIN: ${json.pin}\n\nPlease copy or print this PIN for the resident.`);
          } else if (actResult === "ALREADY_ACTIVATED") {
            alert("Approval Success! The user had already completed activation. Skipping invitation; resident assignment created.");
          } else if (actResult === "PASSWORD_RESET_REQUIRED") {
            alert("Approval Success! This user already has a pending or registered account. Reset PIN to generate a new activation PIN.");
          } else if (json.warningMessage) {
            alert(`Account Activated Successfully!\n\nWARNING: ${json.warningMessage}`);
          } else {
            alert("Registration request approved and activated successfully!");
          }
          
          if (reqObj?.profile_id) {
            const { data: pData } = await supabase
              .from("profiles")
              .select("force_password_change, accepted_terms_at, status, account_status, invitation_status, auth_status")
              .eq("id", reqObj.profile_id)
              .single();
            if (pData) setAssociatedProfile(pData);
          }
        }
        setModalAction(null);
        setModalRemarks("");
        setModalReason("");
        fetchRequests();
        fetchStats();
      } else {
        alert(json.message || "Failed to update status.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      alert(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle Soft Delete (Super Admin only)
  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Are you sure you want to soft delete this registration request? This action is irreversible.")) return;

    try {
      const res = await fetch(`/api/v1/registration-requests/${id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (json.success) {
        setIsDrawerOpen(false);
        setSelectedRequest(null);
        fetchRequests();
        fetchStats();
      } else {
        alert(json.message || "Failed to delete request.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred.";
      alert(msg);
    }
  };

  const getTimelineSteps = () => {
    if (!selectedRequest) return [];

    const isApproved = selectedRequest.status === "APPROVED";
    const status = associatedProfile?.auth_status || "PENDING";
    const isPinGenerated = ["PIN_ISSUED", "PASSWORD_CHANGED", "TERMS_ACCEPTED", "ACTIVE"].includes(status);
    const isPasswordChanged = ["PASSWORD_CHANGED", "TERMS_ACCEPTED", "ACTIVE"].includes(status);
    const isTermsAccepted = ["TERMS_ACCEPTED", "ACTIVE"].includes(status) || !!associatedProfile?.accepted_terms_at;
    const isActivated = status === "ACTIVE" && !associatedProfile?.force_password_change && !!associatedProfile?.accepted_terms_at;

    return [
      { label: "Approved", done: isApproved, time: selectedRequest.approved_at },
      { label: "PIN Generated", done: isPinGenerated, time: selectedRequest.account_created_at },
      { label: "Password Changed", done: isPasswordChanged, time: associatedProfile?.password_changed_at },
      { label: "Terms Accepted", done: isTermsAccepted, time: associatedProfile?.accepted_terms_at },
      { label: "Activated", done: isActivated, time: associatedProfile?.first_login_at || selectedRequest.portal_enabled_at }
    ];
  };

  const totalPages = Math.ceil(totalCount / limit);

  // Status color mapper
  const getStatusBadge = (s: RegistrationStatus) => {
    switch (s) {
      case RegistrationStatus.PENDING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        );
      case RegistrationStatus.UNDER_REVIEW:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Under Review
          </span>
        );
      case RegistrationStatus.MORE_INFO:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Need More Info
          </span>
        );
      case RegistrationStatus.APPROVED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case RegistrationStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
    }
  };

  const isSuperAdmin = currentUserRole === "super_admin";
  const canReview = ["super_admin", "admin", "property_admin"].includes(currentUserRole || "");

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader title="Registration Requests" />

          {/* Tab selectors */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("queue")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition duration-150 ${
                activeTab === "queue"
                  ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
              }`}
            >
              <FiList className="w-4 h-4" />
              Requests Queue
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition duration-150 ${
                activeTab === "settings"
                  ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-850 dark:hover:text-slate-200"
              }`}
            >
              <FiSettings className="w-4 h-4" />
              Registration Settings
            </button>
          </div>
        </div>

        {/* Part 2: Registration Dashboard (Top metric cards) */}
        {loadingStats ? (
          <div className="h-14 flex items-center justify-center text-xs text-slate-400">
            Loading dashboard summaries...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Pending</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-500">{stats?.pending || 0}</span>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Under Review</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-blue-500">{stats?.underReview || 0}</span>
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Approved</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-500">{stats?.approved || 0}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Rejected</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-rose-500">{stats?.rejected || 0}</span>
                <span className="h-2 w-2 rounded-full bg-rose-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Need Info</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-purple-500">{stats?.moreInfo || 0}</span>
                <span className="h-2 w-2 rounded-full bg-purple-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">Today</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{stats?.today || 0}</span>
                <FiClock className="w-4 h-4 text-indigo-500" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider">This Month</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{stats?.thisMonth || 0}</span>
                <FiCalendar className="w-4 h-4 text-indigo-500" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left / Middle: Main Tab content */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === "queue" ? (
              <>
                {/* Filters Panel */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <FiSliders className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold uppercase tracking-wider">Search & Filters</span>
                    </div>
                    {(search || status || propertyId || relationship || regType || dateFrom || dateTo) && (
                      <button
                        onClick={() => {
                          setSearch("");
                          setStatus("");
                          if (currentUserRole !== "property_admin" || !currentUserPropId) {
                            setPropertyId("");
                          }
                          setRelationship("");
                          setRegType("");
                          setDateFrom("");
                          setDateTo("");
                          setPage(1);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-500 transition font-medium flex items-center gap-1"
                      >
                        <FiX className="w-3.5 h-3.5" /> Clear Filters
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search Input */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiSearch className="text-slate-400 w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="Search name, unit..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                      />
                    </div>

                    {/* Status Filter */}
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                      className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="MORE_INFO">Need More Info</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>

                    {/* Property Filter */}
                    {currentUserRole === "property_admin" ? (
                      <select
                        disabled
                        value={propertyId}
                        className="p-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-450 outline-none cursor-not-allowed"
                      >
                        <option value={propertyId}>
                          {(() => {
                            const p = properties.find(p => p.id === propertyId);
                            return p ? (p.name_th ?? p.name_en ?? p.code ?? "Assigned Property") : "Assigned Property";
                          })()}
                        </option>
                      </select>
                    ) : (
                      <SearchableSelect
                        options={properties.map(p => ({ value: p.id, label: p.name_th ?? p.name_en ?? p.code }))}
                        value={propertyId}
                        onChange={(val) => {
                          setPropertyId(val);
                          setPage(1);
                        }}
                        placeholder="All Properties..."
                        searchPlaceholder="Search properties..."
                      />
                    )}

                    {/* Registration Type Filter */}
                    <select
                      value={regType}
                      onChange={(e) => {
                        setRegType(e.target.value);
                        setPage(1);
                      }}
                      className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-855 outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">All Registration Types</option>
                      <option value="RESIDENT">Resident</option>
                      <option value="TECHNICIAN">Technician</option>
                      <option value="HOUSEKEEPING">Housekeeping</option>
                      <option value="SECURITY">Security</option>
                      <option value="COMMITTEE">Committee</option>
                      <option value="STAFF">Staff</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Relationship Filter */}
                    <select
                      value={relationship}
                      onChange={(e) => {
                        setRelationship(e.target.value);
                        setPage(1);
                      }}
                      className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-855 outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">All Relationships</option>
                      <option value="OWNER">Owner</option>
                      <option value="CO_OWNER">Co-Owner</option>
                      <option value="RESIDENT">Resident (General)</option>
                      <option value="TENANT">Tenant</option>
                      <option value="FAMILY_MEMBER">Family Member</option>
                    </select>

                    {/* Date From */}
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                      }}
                      className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-855 outline-none focus:border-indigo-500 transition"
                    />

                    {/* Date To */}
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(1);
                      }}
                      className="p-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-855 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Requests Table */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  {loading ? (
                    <div className="py-20">
                      <LoadingState message="Retrieving registration requests..." />
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="py-20">
                      <EmptyState message="No registration requests found. Try clearing filters or search queries." />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">Request No</th>
                            <th className="px-6 py-4">Created</th>
                            <th className="px-6 py-4">Property</th>
                            <th className="px-6 py-4">Unit</th>
                            <th className="px-6 py-4">Applicant</th>
                            <th className="px-6 py-4">Relationship</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Source</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          {requests.map((r) => (
                            <tr
                              key={r.id}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer transition"
                              onClick={() => {
                                setSelectedRequest(r);
                                setIsDrawerOpen(true);
                              }}
                            >
                              <td className="px-6 py-4 font-mono font-medium text-slate-500">
                                {r.id.slice(0, 8).toUpperCase()}
                              </td>
                              <td className="px-6 py-4">
                                {new Date(r.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 font-medium">
                                {r.requested_property_name || "UNKNOWN"}
                              </td>
                              <td className="px-6 py-4 font-mono">
                                {r.requested_unit_number}
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {r.first_name} {r.last_name}
                                </span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">{r.email}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">
                                  {r.relationship}
                                </span>
                              </td>
                              <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                              <td className="px-6 py-4 font-mono">{r.invitation_source}</td>
                              <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setIsDrawerOpen(true);
                                  }}
                                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4">
                      <span className="text-xs text-slate-500">
                        Showing page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of{" "}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span> ({totalCount} total)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={page === 1}
                          onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          <FiChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={page === totalPages}
                          onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                          <FiChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Part 6: Admin Settings UI */
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <FiSettings className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Registration Settings configuration
                  </h3>
                </div>

                {loadingSettings ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    Retrieving registration settings...
                  </div>
                ) : (
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    {currentUserRole !== "property_admin" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Property Selection
                        </label>
                        <SearchableSelect
                          options={properties.map(p => ({ value: p.id, label: p.name_th ?? p.name_en ?? p.code }))}
                          value={settingsPropertyId}
                          onChange={(val) => setSettingsPropertyId(val)}
                          placeholder="Select Property..."
                          searchPlaceholder="Search properties..."
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Registration Open</h4>
                        <p className="text-[10px] text-slate-500">Toggle whether the public registration form is open for this property.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsEnabled}
                          onChange={(e) => setSettingsEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {!settingsEnabled && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Maintenance Message
                        </label>
                        <textarea
                          rows={3}
                          value={settingsMessage}
                          onChange={(e) => setSettingsMessage(e.target.value)}
                          placeholder="Registration is temporarily closed for maintenance. Please check back later."
                          className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 outline-none focus:border-indigo-500 transition resize-none"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Allowed Registration Roles</h4>
                      <p className="text-[10px] text-slate-500 mb-3">Select which applicant roles or relationships are allowed to submit requests.</p>

                       <div className="grid grid-cols-1 gap-4">
                         {/* Resident roles */}
                         <div className="space-y-2.5 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                           <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Resident Roles</span>
                           <div className="space-y-2 mt-2">
                             <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" checked={settingsOwner} onChange={(e) => setSettingsOwner(e.target.checked)} className="rounded text-indigo-600" />
                               Owner
                             </label>
                             <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" checked={settingsCoOwner} onChange={(e) => setSettingsCoOwner(e.target.checked)} className="rounded text-indigo-600" />
                               Co-Owner
                             </label>
                             <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" checked={settingsResident} onChange={(e) => setSettingsResident(e.target.checked)} className="rounded text-indigo-600" />
                               Resident (General)
                             </label>
                             <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" checked={settingsTenant} onChange={(e) => setSettingsTenant(e.target.checked)} className="rounded text-indigo-600" />
                               Tenant
                             </label>
                             <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" checked={settingsFamilyMember} onChange={(e) => setSettingsFamilyMember(e.target.checked)} className="rounded text-indigo-600" />
                               Family Member
                             </label>
                           </div>
                         </div>
                       </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                      <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">Activation & Notification Settings</h4>
                      <p className="text-[10px] text-slate-500">Configure how applicant user accounts are activated and notified upon approval.</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Activation Method Dropdown */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Activation Method
                          </label>
                          <select
                            value={settingsActivationMethod}
                            onChange={(e) => setSettingsActivationMethod(e.target.value as "SUPABASE_EMAIL" | "TEMP_PASSWORD" | "MANUAL")}
                            className="w-full p-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 outline-none focus:border-indigo-500 transition"
                          >
                            <option value="SUPABASE_EMAIL">Supabase Email Invitation (Recommended)</option>
                            <option value="TEMP_PASSWORD">Temporary Password</option>
                            <option value="MANUAL">Manual Activation (Later)</option>
                          </select>
                        </div>

                        {/* Email Notifications Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Email Notifications</h4>
                            <p className="text-[9px] text-slate-500">Send custom activation/welcome emails.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settingsEmailNotifications}
                              onChange={(e) => setSettingsEmailNotifications(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingSettings || loadingSettings}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                    >
                      {savingSettings ? "Saving Settings..." : "Save Settings"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Right Col: Registration Statistics Panel (Collapsible/Fixed) */}
          <div className="space-y-6">
            {/* Part 3: Registration Statistics */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <FiActivity className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Registration Stats
                </h3>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-3 flex justify-between">
                  <span className="text-slate-500">Website Visits</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stats?.websiteVisits || 0}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-500">Registration Requests</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stats?.totalRequests || 0}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-500">Approved Requests</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stats?.approved || 0}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-500">Rejected Requests</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stats?.rejected || 0}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-500">Approval Rate</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {stats?.approvalRate || 0}%
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-500">Avg. Approval Time</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {stats?.averageApprovalTimeHours || 0} hrs
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Request Detail Drawer */}
        {isDrawerOpen && selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsDrawerOpen(false)}
            />

            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full transform transition-transform duration-300">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Request Details
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedRequest.id}
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Section 1: Applicant Details */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                    Applicant Information
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-450 block mb-0.5">First Name</span>
                        <span className="font-semibold text-slate-800 dark:text-white">{selectedRequest.first_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Last Name</span>
                        <span className="font-semibold text-slate-800 dark:text-white">{selectedRequest.last_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Email</span>
                        <span className="font-semibold text-slate-800 dark:text-white block truncate">{selectedRequest.email || "-"}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Phone</span>
                        <span className="font-semibold text-slate-800 dark:text-white">{selectedRequest.phone || "-"}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Nationality</span>
                        <span className="font-semibold text-slate-800 dark:text-white">{selectedRequest.nationality || "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Target Location & Relationship */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                    Property & Unit Link
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-955 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-455 block mb-0.5">Property Name</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {selectedRequest.requested_property_name || "UNKNOWN"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Unit Room</span>
                        <span className="font-semibold text-slate-800 dark:text-white font-mono">
                          {selectedRequest.requested_unit_number}
                        </span>
                      </div>
                      {selectedRequest.registration_type === "RESIDENT" ? (
                        <div>
                          <span className="text-slate-455 block mb-0.5">Relationship to Unit</span>
                          <span className="font-semibold text-slate-800 dark:text-white uppercase tracking-wider font-semibold">
                            {selectedRequest.relationship}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-slate-455 block mb-0.5">Registration Type</span>
                            <span className="font-semibold text-slate-800 dark:text-white uppercase tracking-wider">
                              {selectedRequest.registration_type}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-455 block mb-0.5">Relationship to Unit</span>
                            <span className="font-semibold text-slate-800 dark:text-white uppercase tracking-wider font-semibold">
                              {selectedRequest.relationship}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2.5: Activation Details (Temporary PIN) */}
                {selectedRequest.status === RegistrationStatus.APPROVED && selectedRequest.profile_id && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                      Activation Details
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-455 block mb-0.5">Temporary PIN</span>
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
                                          <div class="pin-box">${activePin}</div>
                                          <div class="instructions">Use this PIN to activate your Resident Portal account at Login.</div>
                                          <script>window.print();</script>
                                        </body>
                                      </html>
                                    `);
                                    printWindow.document.close();
                                  }
                                }}
                                className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-355 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px]"
                                title="Print PIN"
                              >
                                Print
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleResetPin(selectedRequest.id)}
                            disabled={actionSubmitting}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-[10px] font-bold uppercase transition"
                          >
                            Reset PIN
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Metadata & Notes */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                    Audit & Metadata
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-955 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-455 block mb-0.5">Source IP</span>
                        <span className="font-mono text-slate-800 dark:text-white">{selectedRequest.source_ip || "-"}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">User Agent</span>
                        <span className="font-mono text-slate-800 dark:text-white block truncate" title={selectedRequest.user_agent || ""}>
                          {selectedRequest.user_agent || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Created At</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {new Date(selectedRequest.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-455 block mb-0.5">Invitation Source</span>
                        <span className="font-semibold text-slate-800 dark:text-white uppercase tracking-wider">
                          {selectedRequest.invitation_source}
                        </span>
                      </div>
                    </div>
                    {selectedRequest.remarks && (
                      <div className="text-xs border-t border-slate-150 dark:border-slate-800 pt-3">
                        <span className="text-slate-455 block mb-1">User Remarks</span>
                        <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                          {selectedRequest.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Workflow Status Timeline */}
                {selectedRequest.status === RegistrationStatus.APPROVED ? (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                      Activation Timeline
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                      {loadingProfile ? (
                        <div className="text-xs text-slate-400 text-center py-4">Loading activation status...</div>
                      ) : (
                        <div className="flow-root">
                          <ul className="-mb-8">
                            {getTimelineSteps().map((step, idx) => (
                              <li key={idx}>
                                <div className="relative pb-8">
                                  {idx !== getTimelineSteps().length - 1 && (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
                                  )}
                                  <div className="relative flex space-x-3">
                                    <div>
                                      <span className={`h-8 w-8 rounded-full flex items-center justify-center text-xs border ${
                                        step.done
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                          : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
                                      }`}>
                                        {step.done ? (
                                          <FiCheckCircle className="w-4 h-4" />
                                        ) : (
                                          <FiClock className="w-4 h-4" />
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                      <div>
                                        <p className={`text-xs font-semibold uppercase tracking-wider ${
                                          step.done ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"
                                        }`}>
                                          {step.label}
                                        </p>
                                      </div>
                                      {step.done && step.time ? (
                                        <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-mono">
                                          {new Date(step.time).toLocaleDateString()} {new Date(step.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                      ) : (
                                        <div className="text-right text-[10px] whitespace-nowrap text-slate-400 italic">
                                          Pending
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
                      Status Transition History
                    </span>
                    {selectedRequest.status_history && selectedRequest.status_history.length > 0 ? (
                      <div className="flow-root">
                        <ul className="-mb-8">
                          {selectedRequest.status_history.map((h, hIdx) => (
                            <li key={hIdx}>
                              <div className="relative pb-8">
                                {hIdx !== (selectedRequest.status_history?.length || 0) - 1 && (
                                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
                                )}
                                <div className="relative flex space-x-3">
                                  <div>
                                    <span className="h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs">
                                      {h.status === RegistrationStatus.APPROVED ? (
                                        <FiCheckCircle className="text-emerald-500 w-4 h-4" />
                                      ) : h.status === RegistrationStatus.REJECTED ? (
                                        <FiXCircle className="text-rose-500 w-4 h-4" />
                                      ) : h.status === RegistrationStatus.MORE_INFO ? (
                                        <FiInfo className="text-purple-500 w-4 h-4" />
                                      ) : (
                                        <FiClock className="text-amber-500 w-4 h-4" />
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                    <div>
                                      <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold uppercase tracking-wider">
                                        Transition to {h.status}
                                      </p>
                                      {h.remarks && (
                                        <p className="text-[11px] text-slate-500 mt-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-850">
                                          {h.remarks}
                                        </p>
                                      )}
                                      {h.rejection_reason && (
                                        <p className="text-[11px] text-rose-500 mt-1 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                                          <span className="font-bold">Reason:</span> {h.rejection_reason}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-mono">
                                      <time dateTime={h.changed_at}>
                                        {new Date(h.changed_at).toLocaleDateString()} {new Date(h.changed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </time>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No transition history logged.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              {canReview && selectedRequest.status !== RegistrationStatus.APPROVED && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950 flex flex-wrap gap-2 justify-end">
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDeleteRequest(selectedRequest.id)}
                      className="px-3 py-2 bg-rose-600/10 border border-rose-500/20 text-rose-600 hover:bg-rose-600/20 rounded-xl text-xs font-bold uppercase transition"
                    >
                      Delete
                    </button>
                  )}

                  {selectedRequest.status !== RegistrationStatus.MORE_INFO && (
                    <button
                      onClick={() => setModalAction({ request: selectedRequest, targetStatus: RegistrationStatus.MORE_INFO })}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase transition"
                    >
                      Request Info
                    </button>
                  )}

                  {selectedRequest.status !== RegistrationStatus.UNDER_REVIEW && (
                    <button
                      onClick={() => setModalAction({ request: selectedRequest, targetStatus: RegistrationStatus.UNDER_REVIEW })}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase transition"
                    >
                      Under Review
                    </button>
                  )}

                  <button
                    onClick={() => setModalAction({ request: selectedRequest, targetStatus: RegistrationStatus.REJECTED })}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase transition"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => setModalAction({ request: selectedRequest, targetStatus: RegistrationStatus.APPROVED })}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase transition"
                  >
                    Approve
                  </button>
                </div>
              )}

              {canReview && selectedRequest.status === RegistrationStatus.APPROVED && !selectedRequest.profile_id && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950 flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => handleManualActivate(selectedRequest.id)}
                    disabled={actionSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase transition flex items-center gap-1.5"
                  >
                    {actionSubmitting ? "Activating..." : "Create Auth & Generate PIN"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workflow Confirmation Modal */}
        {modalAction && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setModalAction(null)}
            />

            <div className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2">
                <FiAlertCircle className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Confirm Status Transition
                </h3>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                You are transitioning registration request{" "}
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  #{modalAction.request.id.slice(0, 8).toUpperCase()}
                </span>{" "}
                to status <span className="font-bold text-indigo-600 dark:text-indigo-400">{modalAction.targetStatus}</span>.
              </p>

              <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
                {/* Reason field for reject or more info */}
                {(modalAction.targetStatus === RegistrationStatus.REJECTED ||
                  modalAction.targetStatus === RegistrationStatus.MORE_INFO) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={modalReason}
                      onChange={(e) => setModalReason(e.target.value)}
                      placeholder={`Provide reason for transition to ${modalAction.targetStatus}...`}
                      className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 outline-none focus:border-indigo-500 transition resize-none"
                    />
                  </div>
                )}

                {/* Remarks field */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Internal Remarks / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={modalRemarks}
                    onChange={(e) => setModalRemarks(e.target.value)}
                    placeholder="Provide any additional internal context..."
                    className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAction(null)}
                    className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold uppercase transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionSubmitting}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase transition flex items-center gap-1.5"
                  >
                    {actionSubmitting ? "Processing..." : "Confirm"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
