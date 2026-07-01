"use client";

import React, { useEffect, useState, useContext } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import { Unit } from "@/features/unit/types/unit.types";
import { Occupancy } from "@/features/occupancy/types/occupancy.types";
import { Visitor } from "../types/visitor.types";
import { AuthContext } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

function UnitResultCard({ unit, onSelect }: { unit: Unit; onSelect: (unit: Unit) => void }) {
  const { t } = useLanguage();
  const [occupancies, setOccupancies] = useState<Occupancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOccupants = async () => {
      try {
        const res = await fetch(`/api/v1/units/${unit.id}/occupancies`);
        const json = await res.json();
        if (json.success) {
          setOccupancies(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOccupants();
  }, [unit.id]);

  const activeOccupants = occupancies.filter(o => o.status === "ACTIVE");
  const summaryText = activeOccupants.length > 0 
    ? `${activeOccupants.length} ${t.occupancy.activeOccupants}`
    : t.visitor.noActiveOccupants;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg p-5 shadow-sm space-y-4 hover:border-[#D4AF37] transition duration-200">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-mono font-bold text-lg text-slate-800 dark:text-slate-200">Unit {unit.unit_number}</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Building: {unit.building_code || "Main"} | Floor: {unit.floor}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          unit.status === "ACTIVE" 
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        }`}>
          {unit.status}
        </span>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t.visitor.occupancySummary}</span>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {loading ? t.common.loading : summaryText}
        </p>
      </div>

      {!loading && activeOccupants.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-700/60 pt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t.visitor.currentOccupants}</span>
          <ul className="text-xs space-y-1">
            {activeOccupants.map(o => (
              <li key={o.id} className="text-slate-600 dark:text-slate-400 font-medium">
                👤 {o.person ? `${o.person.first_name} ${o.person.last_name || ""}` : "Unknown"} ({o.occupancy_type})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
        <button
          onClick={() => onSelect(unit)}
          className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-xs font-semibold transition"
        >
          {t.visitor.selectForRegistration}
        </button>
        <a
          href={`/units/${unit.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition text-center flex items-center justify-center font-medium"
        >
          {t.visitor.detailPage}
        </a>
      </div>
    </div>
  );
}

export default function VisitorCheckInPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const auth = useContext(AuthContext);
  const [step, setStep] = useState(0); // 0: Select Unit, 1: Enter Details, 2: Success Confirmation

  // Unit select states
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchUnitTerm, setSearchUnitTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitOccupancies, setUnitOccupancies] = useState<Occupancy[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idCard, setIdCard] = useState("");
  const [passport, setPassport] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [company, setCompany] = useState("");
  const [purpose, setPurpose] = useState("Guest");
  const [expectedCheckout, setExpectedCheckout] = useState("");
  const [remarks, setRemarks] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Success state
  const [createdVisitor, setCreatedVisitor] = useState<Visitor | null>(null);

  const securityUser = auth?.profile?.display_name || auth?.user?.email || "Security Guard";

  // Load units
  useEffect(() => {
    const fetchUnits = async () => {
      try {
        setLoadingUnits(true);
        const res = await fetch("/api/v1/units");
        const json = await res.json();
        if (json.success) {
          setUnits(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch units:", err);
      } finally {
        setLoadingUnits(false);
      }
    };

    queueMicrotask(() => {
      fetchUnits();
    });
  }, []);

  // When a unit is selected, fetch active occupancies
  const handleSelectUnit = async (unit: Unit) => {
    setSelectedUnit(unit);
    try {
      const res = await fetch(`/api/v1/units/${unit.id}/occupancies`);
      const json = await res.json();
      if (json.success) {
        setUnitOccupancies(json.data);
      }
      setStep(1);
      // Pre-fill expected check-out to 2 hours from now
      const defaultCheckout = new Date();
      defaultCheckout.setHours(defaultCheckout.getHours() + 2);
      setExpectedCheckout(defaultCheckout.toISOString().substring(0, 16));
    } catch (err) {
      console.error("Failed to fetch occupancies:", err);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    setFormError("");

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedIdCard = idCard.trim();
    const trimmedPassport = passport.trim();
    const trimmedVehiclePlate = vehiclePlate.trim();
    const trimmedCompany = company.trim();
    const trimmedRemarks = remarks.trim();

    if (!trimmedName) {
      setFormError("Visitor Name is required");
      return;
    }

    if (trimmedPhone && trimmedPhone.replace(/\D/g, "").length < 8) {
      setFormError("Phone number must contain at least 8 digits");
      return;
    }

    if (!expectedCheckout) {
      setFormError("Expected Check-out time is required");
      return;
    }

    const checkinTime = new Date();
    const checkoutTime = new Date(expectedCheckout);
    if (checkoutTime <= checkinTime) {
      setFormError("Expected Check-out time must be after Check-in time");
      return;
    }

    const activeOcc = unitOccupancies.find(o => o.status === "ACTIVE");

    const combinedRemarks = [
      trimmedRemarks,
      trimmedIdCard ? `ID Card: ${trimmedIdCard}` : null,
      trimmedPassport ? `Passport: ${trimmedPassport}` : null
    ].filter(Boolean).join(" | ");

    const payload = {
      unit_id: selectedUnit.id,
      visitor_name: trimmedName,
      phone: trimmedPhone || null,
      purpose,
      vehicle_plate: trimmedVehiclePlate || null,
      company: trimmedCompany || null,
      occupancy_id: activeOcc ? activeOcc.id : null,
      security_user: securityUser,
      expected_checkout_time: checkoutTime.toISOString(),
      remarks: combinedRemarks || null,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setCreatedVisitor(json.data);
        setStep(2);
      } else {
        setFormError(json.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to check in visitor";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUnits = units.filter((u) =>
    u.unit_number.toLowerCase().includes(searchUnitTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Step Indicator */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-4">
          <h2 className="text-xl font-bold">{t.visitor.checkIn}</h2>
          <div className="flex gap-2 text-xs font-semibold text-slate-400">
            <span className={step === 0 ? "text-[#D4AF37]" : ""}>{t.visitor.selectUnit}</span>
            <span>/</span>
            <span className={step === 1 ? "text-[#D4AF37]" : ""}>{t.visitor.checkInForm}</span>
            <span>/</span>
            <span className={step === 2 ? "text-[#D4AF37]" : ""}>{t.visitor.success}</span>
          </div>
        </div>

        {/* Step 0: Select Unit */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold">{t.visitor.searchUnit}</label>
              <input
                type="text"
                placeholder={t.visitor.searchUnitPlaceholder}
                value={searchUnitTerm}
                onChange={(e) => setSearchUnitTerm(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm shadow-sm outline-none focus:border-[#D4AF37]"
                autoFocus
              />
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {loadingUnits ? (
                <div className="p-8 text-center text-slate-500 text-sm">{t.visitor.loadingUnits}</div>
              ) : filteredUnits.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">{t.visitor.noUnitsMatch} &quot;{searchUnitTerm}&quot;.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredUnits.map((u) => (
                    <UnitResultCard
                      key={u.id}
                      unit={u}
                      onSelect={handleSelectUnit}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => router.push("/visitors")}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Check-in Form */}
        {step === 1 && selectedUnit && (
          <div className="space-y-6">
            {/* Autofill / Read-only details banner */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {t.visitor.autoFilledContext}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                <div>
                   <span className="text-slate-400 block mb-0.5">{t.visitor.visitUnit}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">
                    Unit {selectedUnit.unit_number} ({selectedUnit.building_code || "Main"})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t.visitor.currentSecurityUser}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{securityUser}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t.visitor.checkInTime}</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono">{new Date().toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{t.visitor.occupancySummary}</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {unitOccupancies.filter((o) => o.status === "ACTIVE").length} {t.occupancy.activeOccupants}
                  </span>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">{t.visitor.visitorName} *</label>
                <input
                  type="text"
                  required
                  placeholder="Full name of visitor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t.visitor.phoneNumber}</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0812345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t.visitor.vehiclePlate}</label>
                  <input
                    type="text"
                    placeholder="e.g. กข 1234"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t.visitor.idCard}</label>
                  <input
                    type="text"
                    placeholder="National ID"
                    value={idCard}
                    onChange={(e) => setIdCard(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t.visitor.passport}</label>
                  <input
                    type="text"
                    placeholder="Passport Number"
                    value={passport}
                    onChange={(e) => setPassport(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">{t.visitor.company}</label>
                  <input
                    type="text"
                    placeholder="e.g. Kerry, Grab"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">{t.visitor.visitPurpose} *</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                  >
                    <option value="Guest">{t.visitor.purposeGuest}</option>
                    <option value="Delivery">{t.visitor.purposeDelivery}</option>
                    <option value="Maintenance">{t.visitor.purposeMaintenance}</option>
                    <option value="Utility">{t.visitor.purposeUtility}</option>
                    <option value="Other">{t.visitor.purposeOther}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{t.visitor.expectedCheckout} *</label>
                <input
                  type="datetime-local"
                  required
                  value={expectedCheckout}
                  onChange={(e) => setExpectedCheckout(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none"
                />
              </div>

              {/* Photo Placeholder */}
              <div className="space-y-1">
                <span className="block text-sm font-semibold">{t.visitor.visitorPhoto}</span>
                <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                  <span className="text-2xl text-slate-400">📷</span>
                  <span className="text-xs text-slate-400">{t.visitor.photoDisabled}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">{t.visitor.remarks}</label>
                <textarea
                  placeholder="Additional visit notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg dark:bg-slate-900 text-sm focus:border-[#D4AF37] outline-none h-16"
                />
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium"
                >
                   {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  {submitting ? t.common.saving : t.common.continue}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2: Success Confirmation */}
        {step === 2 && createdVisitor && (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-6 shadow-md text-center space-y-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 font-bold text-xl">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t.visitor.successTitle}</h3>
              <p className="text-sm text-slate-500 font-medium">{t.visitor.successDescription}</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-4 text-left divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.visitor.visitorNumber}</span>
                <span className="font-semibold font-mono text-[#D4AF37]">{createdVisitor.visitor_number}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.visitor.visitorName}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{createdVisitor.visitor_name}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.visitor.phoneNumber}</span>
                <span className="font-semibold">{createdVisitor.phone || "-"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.visitor.targetUnit}</span>
                <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">Unit {createdVisitor.unit?.unit_number}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.visitor.vehiclePlate}</span>
                <span className="font-semibold font-mono">{createdVisitor.vehicle_plate || "-"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.visitor.checkInTime}</span>
                <span className="font-semibold">{new Date(createdVisitor.check_in_time).toLocaleString()}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-400 font-medium">{t.common.status}</span>
                <span className="font-semibold text-green-600 dark:text-green-400 uppercase">{t.visitor.checkedIn}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => router.push("/visitors")}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition"
              >
                {t.common.backToDirectory}
              </button>
              <button
                onClick={() => {
                  setName("");
                  setPhone("");
                  setIdCard("");
                  setPassport("");
                  setVehiclePlate("");
                  setCompany("");
                  setPurpose("Guest");
                  setRemarks("");
                  setStep(0);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {t.visitor.checkInAnother}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
