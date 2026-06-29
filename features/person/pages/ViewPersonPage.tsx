"use client";

import React, { use, useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Person } from "../types/person.types";
import { Occupancy, OccupancyType, OCCUPANCY_TYPES } from "@/features/occupancy/types/occupancy.types";
import { Unit } from "@/features/unit/types/unit.types";
import { Status } from "@/shared/enums/status";

interface ViewPersonProps {
  params: Promise<{ id: string }>;
}

export default function ViewPersonPage({ params }: ViewPersonProps) {
  const router = useRouter();
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedOccupancy, setSelectedOccupancy] = useState<Occupancy | null>(null);
  
  // Form states
  const [formUnitId, setFormUnitId] = useState("");
  const [formOccupancyType, setFormOccupancyType] = useState<OccupancyType>("RESIDENT");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formStatus, setFormStatus] = useState<Status>(Status.ACTIVE);
  const [formRemarks, setFormRemarks] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch person details
        const personRes = await fetch(`/api/v1/persons/${id}`);
        const personJson = await personRes.json();
        if (personJson.success) {
          setPerson(personJson.data);
        } else {
          setError(personJson.message);
        }

        // Fetch occupancies for this person
        const occRes = await fetch(`/api/v1/persons/${id}/occupancies`);
        const occJson = await occRes.json();
        if (occJson.success) {
          setOccupancies(occJson.data);
        }

        // Fetch units for dropdown
        const unitsRes = await fetch("/api/v1/units");
        const unitsJson = await unitsRes.json();
        if (unitsJson.success) {
          setUnits(unitsJson.data);
          if (unitsJson.data.length > 0) {
            setFormUnitId(unitsJson.data[0].id);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load data";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    queueMicrotask(() => {
      fetchData();
    });
  }, [id, refreshKey]);

  const handleOpenAssign = () => {
    setModalMode("create");
    setSelectedOccupancy(null);
    if (units.length > 0) {
      setFormUnitId(units[0].id);
    } else {
      setFormUnitId("");
    }
    setFormOccupancyType("RESIDENT");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormStatus(Status.ACTIVE);
    setFormRemarks("");
    setFormError("");
    setShowModal(true);
  };

  const handleOpenEdit = (occ: Occupancy) => {
    setModalMode("edit");
    setSelectedOccupancy(occ);
    setFormUnitId(occ.unit_id);
    setFormOccupancyType(occ.occupancy_type);
    setFormStartDate(occ.start_date);
    setFormEndDate(occ.end_date || "");
    setFormStatus(occ.status);
    setFormRemarks(occ.remarks || "");
    setFormError("");
    setShowModal(true);
  };

  const handleEndAssignment = async (occ: Occupancy) => {
    const today = new Date().toISOString().split("T")[0];
    if (occ.start_date > today) {
      alert("Cannot end assignment: Start date is in the future");
      return;
    }
    if (!confirm(`Are you sure you want to end this assignment today (${today})?`)) return;

    try {
      const res = await fetch(`/api/v1/occupancies/${occ.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          end_date: today,
          status: Status.INACTIVE,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRefreshKey((k) => k + 1);
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveAssignment = async (occId: string) => {
    if (!confirm("Are you sure you want to archive this occupancy record?")) return;
    try {
      const res = await fetch(`/api/v1/occupancies/${occId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setRefreshKey((k) => k + 1);
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    const payload = {
      unit_id: formUnitId,
      person_id: id,
      occupancy_type: formOccupancyType,
      start_date: formStartDate,
      end_date: formEndDate || null,
      status: formStatus,
      remarks: formRemarks || null,
    };

    try {
      let res;
      if (modalMode === "create") {
        res = await fetch("/api/v1/occupancies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/v1/occupancies/${selectedOccupancy?.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        setRefreshKey((k) => k + 1);
      } else {
        setFormError(json.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Person Details</h2>
          <button
            onClick={() => router.push("/persons")}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
          >
            Back to Directory
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm w-full">
            {error}
          </div>
        ) : (
          person && (
            <>
              {/* Profile Details section */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center gap-4 w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 pb-6 md:pb-0 md:pr-6">
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt={person.display_name || person.first_name}
                      className="w-32 h-32 rounded-full object-cover shadow"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-4xl text-slate-500 shadow">
                      {person.first_name[0]}
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">
                      {person.title ? `${person.title} ` : ""}
                      {person.first_name} {person.last_name}
                    </h3>
                    <p className="text-sm text-slate-400 font-mono mt-1">{person.person_code || "No Code"}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Display Name</span>
                    <span className="col-span-2 text-sm">{person.display_name || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Gender</span>
                    <span className="col-span-2 text-sm">{person.gender || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Date of Birth</span>
                    <span className="col-span-2 text-sm">{person.date_of_birth || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Nationality</span>
                    <span className="col-span-2 text-sm">{person.nationality || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Phone</span>
                    <span className="col-span-2 text-sm">{person.phone || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Email</span>
                    <span className="col-span-2 text-sm">{person.email || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">ID Card</span>
                    <span className="col-span-2 text-sm font-mono">{person.id_card || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Passport No.</span>
                    <span className="col-span-2 text-sm font-mono">{person.passport || "-"}</span>
                  </div>
                  <div className="grid grid-cols-3 border-b border-slate-100 dark:border-slate-700 pb-2">
                    <span className="font-semibold text-slate-500 text-sm">Status</span>
                    <span className="col-span-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          person.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {person.status}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Assignments Section */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Unit Assignments</h3>
                  <button
                    onClick={handleOpenAssign}
                    className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-xs font-medium"
                  >
                    Assign Unit
                  </button>
                </div>

                <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                  {occupancies.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-sm">No unit assignments.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <th className="p-3">Unit Number</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Start Date</th>
                          <th className="p-3">End Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                        {occupancies.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-mono font-medium">{o.unit?.unit_number || "-"}</td>
                            <td className="p-3 font-semibold text-xs text-slate-500">{o.occupancy_type}</td>
                            <td className="p-3 text-xs">{o.start_date}</td>
                            <td className="p-3 text-xs">{o.end_date || "Present"}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  o.status === "active"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {o.status}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2 text-xs">
                              <button
                                onClick={() => handleOpenEdit(o)}
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                              >
                                Edit
                              </button>
                              {o.status === "active" && !o.end_date && (
                                <button
                                  onClick={() => handleEndAssignment(o)}
                                  className="text-amber-600 hover:text-amber-900 dark:text-amber-400"
                                >
                                  End
                                </button>
                              )}
                              <button
                                onClick={() => handleArchiveAssignment(o.id)}
                                className="text-red-600 hover:text-red-900 dark:text-red-400"
                              >
                                Archive
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )
        )}
      </div>

      {/* Modal for Assigning / Editing Occupancy */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold">
              {modalMode === "create" ? "Assign Unit" : "Edit Unit Assignment"}
            </h3>

            {formError && (
              <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Unit *</label>
                <select
                  required
                  disabled={modalMode === "edit"}
                  value={formUnitId}
                  onChange={(e) => setFormUnitId(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm disabled:opacity-60"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} ({u.building_code || "Main"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Occupancy Type *</label>
                <select
                  value={formOccupancyType}
                  onChange={(e) => setFormOccupancyType(e.target.value as OccupancyType)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                >
                  {OCCUPANCY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as Status)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm"
                >
                  <option value={Status.ACTIVE}>Active</option>
                  <option value={Status.INACTIVE}>Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Remarks</label>
                <textarea
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm h-16"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
