"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Status } from "@/shared/enums/status";
import { Property } from "@/features/property/types/property.types";
import { PageHeader } from "@/shared/ui";
import { createClient } from "@/lib/supabase/client";
import {
  UnitOperationalStatus,
  UNIT_OPERATIONAL_STATUSES,
  STATUS_CHANGE_ALLOWED_ROLES,
  STATUS_COLOR,
  STATUS_LABEL_EN,
  STATUS_ICON,
} from "@/shared/enums/unit-operational-status";

interface EditUnitProps {
  params: Promise<{ id: string }>;
}

export default function EditUnitPage({ params }: EditUnitProps) {
  const router = useRouter();
  const { id } = use(params);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [buildingCode, setBuildingCode] = useState("");
  const [floor, setFloor] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [area, setArea] = useState<number>(0);
  const [ownershipRatio, setOwnershipRatio] = useState<number>(0);
  const [status, setStatus] = useState<Status>(Status.ACTIVE);
  const [operationalStatus, setOperationalStatus] = useState<UnitOperationalStatus>("VACANT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canChangeStatus, setCanChangeStatus] = useState(false);
  // Status control panel state
  const [statusTarget, setStatusTarget] = useState<UnitOperationalStatus>("VACANT");
  const [statusReason, setStatusReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");

  useEffect(() => {
    const fetchPropertiesAndUnit = async () => {
      try {
        const propRes = await fetch("/api/v1/properties");
        const propJson = await propRes.json();
        if (propJson.success) {
          setProperties(propJson.data);
        }

        const unitRes = await fetch(`/api/v1/units/${id}`);
        const unitJson = await unitRes.json();
        if (unitJson.success) {
          setPropertyId(unitJson.data.property_id);
          setBuildingCode(unitJson.data.building_code || "");
          setFloor(unitJson.data.floor);
          setUnitNumber(unitJson.data.unit_number);
          setArea(unitJson.data.area);
          setOwnershipRatio(unitJson.data.ownership_ratio);
          setStatus(unitJson.data.status);
          const opSt = (unitJson.data.operational_status || "VACANT") as UnitOperationalStatus;
          setOperationalStatus(opSt);
          setStatusTarget(opSt);
        } else {
          setError(unitJson.message);
        }

        // Fetch user profile and check role
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          if (profile && profile.role === "super_admin") {
            setIsSuperAdmin(true);
          }
          if (profile && (STATUS_CHANGE_ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
            setCanChangeStatus(true);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load details";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchPropertiesAndUnit();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/v1/units/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          building_code: buildingCode,
          floor,
          unit_number: unitNumber,
          area: Number(area),
          ownership_ratio: Number(ownershipRatio),
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/units");
      } else {
        setError(json.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update unit";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError("");
    setStatusSuccess("");
    if (!statusReason.trim()) {
      setStatusError("Reason is required when changing operational status.");
      return;
    }
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/v1/units/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operational_status: statusTarget, reason: statusReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setOperationalStatus(statusTarget);
        setStatusReason("");
        setStatusSuccess(`Status changed to ${statusTarget}`);
      } else {
        setStatusError(json.message || "Failed to change status.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to change status";
      setStatusError(message);
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        <PageHeader title="Edit Unit" />

        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          {loading ? (
            <div className="text-center text-slate-500">Loading...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  Property * {!isSuperAdmin && <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded font-normal ml-1">🔒 Locked (Super Admin Only)</span>}
                </label>
                <select
                  required
                  disabled={!isSuperAdmin}
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name_th} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Building Code</label>
                <input
                  type="text"
                  value={buildingCode}
                  onChange={(e) => setBuildingCode(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Floor *</label>
                <input
                  type="text"
                  required
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  Unit Number * {!isSuperAdmin && <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded font-normal ml-1">🔒 Locked (Super Admin Only)</span>}
                </label>
                <input
                  type="text"
                  required
                  disabled={!isSuperAdmin}
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Area (sqm) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 font-semibold text-slate-700 dark:text-slate-300">
                  Ownership Ratio * {!isSuperAdmin && <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded font-normal ml-1">🔒 Locked (Super Admin Only)</span>}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  disabled={!isSuperAdmin}
                  value={ownershipRatio}
                  onChange={(e) => setOwnershipRatio(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                >
                  <option value={Status.ACTIVE}>Active</option>
                  <option value={Status.INACTIVE}>Inactive</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => router.push("/units")}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Operational Status Control Panel */}
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span>🔄</span>
            {"Operational Status"}
          </h3>

          {/* Current Status Badge */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Status</p>
            {(() => {
              const colors = STATUS_COLOR[operationalStatus] || STATUS_COLOR.VACANT;
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${colors.badge}`}>
                  <span>{STATUS_ICON[operationalStatus]}</span>
                  <span>{STATUS_LABEL_EN[operationalStatus]}</span>
                </span>
              );
            })()}
          </div>

          {canChangeStatus ? (
            <form onSubmit={handleStatusChange} className="space-y-3">
              {statusError && (
                <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs">
                  {statusError}
                </div>
              )}
              {statusSuccess && (
                <div className="p-3 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs">
                  ✅ {statusSuccess}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Status</label>
                <select
                  value={statusTarget}
                  onChange={(e) => setStatusTarget(e.target.value as UnitOperationalStatus)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm cursor-pointer"
                >
                  {UNIT_OPERATIONAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_ICON[s]} {STATUS_LABEL_EN[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Unit under plumbing repair, Room vacated by owner..."
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={statusSaving || statusTarget === operationalStatus}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition"
                >
                  {statusSaving ? "Applying..." : "Apply Status Change"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Only Admin or Property Admin may change operational status. Contact your administrator.
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
