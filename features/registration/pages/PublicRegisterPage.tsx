"use client";

import React, { useState, useEffect } from "react";
import { SearchableSelect } from "@/shared/ui/SearchableSelect";
import { InvitationSource, RegistrationSettings } from "../types/registration.types";
import { Property } from "@/features/property/types/property.types";
import { createClient } from "@/lib/supabase/client";

interface Unit {
  id: string;
  unit_number: string;
  property_id?: string;
  floor?: string;
  building?: string;
}

export default function PublicRegisterPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"new" | "add-unit">("new");
  const [personId, setPersonId] = useState<string | null>(null);

  // Form fields
  const [propertyId, setPropertyId] = useState<string>("");
  const [regType, setRegType] = useState<string>("RESIDENT");
  const [relationship, setRelationship] = useState<string>("RESIDENT");
  const [unitId, setUnitId] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [nationality, setNationality] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Check auth state on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setMode("add-unit");
          const res = await fetch("/api/v1/portal/me");
          const json = await res.json();
          if (json.success && json.data?.person) {
            const p = json.data.person;
            setPersonId(p.id);
            setFirstName(p.first_name || "");
            setLastName(p.last_name || "");
            setEmail(p.email || user.email || "");
            setPhone(p.phone || "");
          } else {
            setEmail(user.email || "");
            if (user.user_metadata?.first_name) setFirstName(user.user_metadata.first_name);
            if (user.user_metadata?.last_name) setLastName(user.user_metadata.last_name);
          }
        } else {
          setMode("new");
        }
      } catch (err) {
        console.error("Auth initialization check failed:", err);
      }
    }
    checkAuth();
  }, [supabase]);

  // Options fetched from DB
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Property Settings for dynamic toggle & validation
  const [propertySettings, setPropertySettings] = useState<RegistrationSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);

  // Success / Error pages
  const [submitStatus, setSubmitStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch properties on mount
  useEffect(() => {
    async function loadProperties() {
      try {
        setLoadingOptions(true);
        const res = await fetch("/api/public/properties");
        const json = await res.json();
        if (json.success) {
          setProperties(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load property options:", err);
      } finally {
        setLoadingOptions(false);
      }
    }
    loadProperties();
  }, []);

  // Fetch units dynamically when propertyId changes
  useEffect(() => {
    async function loadUnits() {
      if (!propertyId) {
        setUnits([]);
        setUnitId("");
        return;
      }
      try {
        setLoadingOptions(true);
        const res = await fetch(`/api/public/units?property_id=${propertyId}`);
        const json = await res.json();
        if (json.success) {
          setUnits(json.data || []);
          // Reset selected unit if it's no longer in the loaded options
          setUnitId("");
        }
      } catch (err) {
        console.error("Failed to load unit options:", err);
      } finally {
        setLoadingOptions(false);
      }
    }
    loadUnits();
  }, [propertyId]);

  // Fetch settings dynamically when property is selected
  useEffect(() => {
    async function fetchSettings() {
      if (!propertyId) {
        setPropertySettings(null);
        return;
      }
      try {
        setLoadingSettings(true);
        const res = await fetch(`/api/public/registration-settings?property_id=${propertyId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setPropertySettings(json.data);

          // Reset default values based on allowed settings
          const s = json.data;
          if (s.enabled) {
            // Find first allowed regType
            if (s.allow_owner || s.allow_co_owner || s.allow_resident || s.allow_tenant || s.allow_family_member) {
              setRegType("RESIDENT");
              if (s.allow_resident) setRelationship("RESIDENT");
              else if (s.allow_owner) setRelationship("OWNER");
              else if (s.allow_co_owner) setRelationship("CO_OWNER");
              else if (s.allow_tenant) setRelationship("TENANT");
              else if (s.allow_family_member) setRelationship("FAMILY_MEMBER");
            } else if (s.allow_technician) {
              setRegType("TECHNICIAN");
            } else if (s.allow_housekeeping) {
              setRegType("HOUSEKEEPING");
            } else if (s.allow_security) {
              setRegType("SECURITY");
            } else if (s.allow_committee) {
              setRegType("COMMITTEE");
            } else if (s.allow_staff) {
              setRegType("STAFF");
            }
          }
        }
      } catch (err) {
        console.error("Failed to load property settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    }
    fetchSettings();
  }, [propertyId]);

  // Filter units by selected property (pre-filtered by public API)
  const filteredUnits = units;

  // Form options mapping for SearchableSelect
  const propertyOptions = properties.map(p => ({
    value: p.id,
    label: p.name_th ?? p.name_en ?? p.code
  }));

  const unitOptions = filteredUnits.map(u => ({
    value: u.id,
    label: `Unit ${u.unit_number}`
  }));

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!propertyId) errors.propertyId = "Property is required";
    if (!unitId) errors.unitId = "Unit is required";
    if (!regType) errors.regType = "Registration type is required";
    if (regType === "RESIDENT" && !relationship) errors.relationship = "Relationship is required";
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";

    if (!phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (phone.replace(/\D/g, "").length < 8) {
      errors.phone = "Phone number must be at least 8 digits";
    }

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email format";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setErrorMessage("");

      const payload = {
        property_id: propertyId,
        unit_id: unitId,
        person_id: personId || null,
        registration_type: regType,
        relationship: regType === "RESIDENT" ? relationship : "RESIDENT",
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        phone: phone.trim(),
        nationality: nationality.trim() || null,
        remarks: remarks.trim() || null,
        invitation_source: InvitationSource.WEBSITE
      };

      const response = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus("SUCCESS");
      } else {
        setSubmitStatus("ERROR");
        setErrorMessage(result.message || "Failed to submit request.");
      }
    } catch (err: unknown) {
      setSubmitStatus("ERROR");
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Success view
  if (submitStatus === "SUCCESS") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 text-center shadow-2xl flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">
                ส่งคำขอลงทะเบียนเรียบร้อยแล้ว
                <br />
                <span className="text-sm font-semibold text-slate-300">Registration submitted successfully.</span>
              </h2>
              <div className="text-xs text-slate-400 leading-relaxed space-y-4">
                <div className="space-y-1">
                  <p className="text-slate-200">คำขอของคุณอยู่ระหว่างรอการอนุมัติ เมื่อได้รับการอนุมัติ ระบบจะส่งอีเมลสำหรับเปิดใช้งานบัญชี</p>
                  <p className="text-slate-400 italic">Your request is pending approval. Once approved, an activation email will be sent.</p>
                </div>
                <div className="border-t border-white/5 pt-3 space-y-1">
                  <p className="text-slate-200">หากเป็นการลงทะเบียนห้องเพิ่มเติม ห้องใหม่จะถูกเพิ่มในบัญชีเดิมของคุณ</p>
                  <p className="text-slate-400 italic">If this is an additional unit, the new unit will be added to your existing account.</p>
                </div>
              </div>
            </div>
            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setSubmitStatus("IDLE");
                  setPropertyId("");
                  setUnitId("");
                  setFirstName("");
                  setLastName("");
                  setPhone("");
                  setEmail("");
                  setNationality("");
                  setRemarks("");
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wider uppercase transition duration-200"
              >
                Submit Another Request
              </button>
              <a
                href="/login"
                className="block w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white font-semibold text-xs tracking-wider uppercase transition duration-200"
              >
                Back to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error view
  if (submitStatus === "ERROR") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 text-center shadow-2xl flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Submission Failed</h2>
              <p className="mt-3 text-sm text-rose-300 leading-relaxed">
                {errorMessage || "We encountered an issue processing your request."}
              </p>
            </div>
            <button
              onClick={() => setSubmitStatus("IDLE")}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wider uppercase transition duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if chosen property has registration enabled
  const isRegistrationOpen = !propertySettings || propertySettings.enabled;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Resident Registration
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Request access to your condominium unit.
            <br />
            Your request will be reviewed by the property office before your account is activated.
          </p>
        </div>

        <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-8 shadow-2xl space-y-6">
          {/* Section 2: Property Selection (Always visible at top) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Property
            </label>
            <SearchableSelect
              options={propertyOptions}
              value={propertyId}
              onChange={(val) => {
                setPropertyId(val);
                setUnitId(""); // Reset unit
              }}
              placeholder={loadingOptions ? "Loading properties..." : "Select Property..."}
              searchPlaceholder="Search properties..."
              disabled={loadingOptions || submitting}
            />
            {validationErrors.propertyId && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">{validationErrors.propertyId}</p>
            )}
          </div>

          {loadingSettings ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Loading property registration parameters...
            </div>
          ) : propertyId && !isRegistrationOpen ? (
            /* Part 4: Registration Toggle (Closed view) */
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-amber-400">Registration Closed</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {propertySettings?.maintenance_message ||
                  "Registration is temporarily closed for maintenance. Please check back later."}
              </p>
            </div>
          ) : (
            propertyId && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 
                  TODO: IRM-052 Employee Onboarding (/employee/register)
                  This module has been removed from public registration and will be relocated to a future non-public onboarding flow.
                */}

                {/* Section 3: Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Room Unit
                  </label>
                  <SearchableSelect
                    options={unitOptions}
                    value={unitId}
                    onChange={(val) => setUnitId(val)}
                    placeholder="Select Unit..."
                    searchPlaceholder="Search units..."
                    disabled={submitting}
                  />
                  {validationErrors.unitId && (
                    <p className="mt-1.5 text-xs text-rose-400 font-medium">{validationErrors.unitId}</p>
                  )}
                </div>

                {/* Section 4: Relationship (Resident Type Only) */}
                {regType === "RESIDENT" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Relationship to Unit
                    </label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-150"
                    >
                      {(!propertySettings || propertySettings.allow_resident) && (
                        <option value="RESIDENT">Resident (General)</option>
                      )}
                      {(!propertySettings || propertySettings.allow_owner) && (
                        <option value="OWNER">Owner</option>
                      )}
                      {(!propertySettings || propertySettings.allow_co_owner) && (
                        <option value="CO_OWNER">Co-Owner</option>
                      )}
                      {(!propertySettings || propertySettings.allow_tenant) && (
                        <option value="TENANT">Tenant</option>
                      )}
                      {(!propertySettings || propertySettings.allow_family_member) && (
                        <option value="FAMILY_MEMBER">Family Member</option>
                      )}
                    </select>
                  </div>
                )}

                <div className="border-t border-white/10 my-6" />

                {mode === "new" ? (
                  <>
                    {/* Section 5: Personal Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                        {validationErrors.firstName && (
                          <p className="mt-1.5 text-xs text-rose-400 font-medium">{validationErrors.firstName}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                        {validationErrors.lastName && (
                          <p className="mt-1.5 text-xs text-rose-400 font-medium">{validationErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0812345678"
                          className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                        {validationErrors.phone && (
                          <p className="mt-1.5 text-xs text-rose-400 font-medium">{validationErrors.phone}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="john.doe@example.com"
                          className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                        />
                        {validationErrors.email && (
                          <p className="mt-1.5 text-xs text-rose-400 font-medium">{validationErrors.email}</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Current Account / บัญชีปัจจุบัน
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-1">Email / อีเมล</span>
                        <span className="text-white font-medium">{email}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Display Name / ชื่อที่แสดง</span>
                        <span className="text-white font-medium">{firstName} {lastName}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-600/10 border border-indigo-600/20 text-center text-xs font-semibold text-indigo-300">
                      You are registering another unit. / คุณกำลังลงทะเบียนเพิ่มอีกห้องชุด
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Nationality (Optional)
                  </label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="Thai"
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>

                {/* Section 6: Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Additional Notes / Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Provide any additional context or request details here..."
                    className="w-full p-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none"
                  />
                </div>

                {/* Section 7: Submit button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition duration-200 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting Request...
                    </>
                  ) : (
                    "Submit Registration Request"
                  )}
                </button>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
