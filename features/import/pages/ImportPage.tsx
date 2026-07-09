/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useImport, MAX_FILE_SIZE_MB } from "../hooks/useImport";
import UploadZone from "../components/UploadZone";
import { useLanguage } from "@/providers/LanguageProvider";
import { CanonicalField, ValidationError } from "../types/import.types";
import { getSchema } from "../schemas";
import { useRouter } from "next/navigation";
import { parseFile } from "../utils/excelParser";
import { importService } from "@/services/import/import.service";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function ImportPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const {
    selectedModule,
    handleModuleChange,
    properties,
    selectedPropertyId,
    setSelectedPropertyId,
    file,
    error,
    setError,
    isValidating,
    isImporting,
    validationResult,
    parsedData,
    columnMapping,
    rowValidation,
    importResult,
    importProgress,
    importStrategy,
    setImportStrategy,
    duplicateResolution,
    setDuplicateResolution,
    handleFileSelect,
    runFileValidation,
    updateMappingAndRevalidate,
    commitImport,
    clear,
  } = useImport();

  // Local step state supporting the 8-step wizard
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [previewPage, setPreviewPage] = useState(1);
  const itemsPerPage = 5;

  const currentSchema = getSchema(selectedModule);
  const schemaFields = [...currentSchema.requiredFields, ...currentSchema.optionalFields];

  const steps = [
    { id: 1, label: language === "en" ? "1. Upload File" : "1. อัปโหลดไฟล์" },
    { id: 2, label: language === "en" ? "2. Select Sheet" : "2. เลือกชีต" },
    { id: 3, label: language === "en" ? "3. Check Headers" : "3. ตรวจสอบหัวตาราง" },
    { id: 4, label: language === "en" ? "4. Map Columns" : "4. จับคู่คอลัมน์" },
    { id: 5, label: language === "en" ? "5. Validate Data" : "5. ตรวจสอบข้อมูล" },
    { id: 6, label: language === "en" ? "6. Preview Changes" : "6. ตัวอย่างการเปลี่ยนแปลง" },
    { id: 7, label: language === "en" ? "7. Confirm" : "7. ยืนยันนำเข้า" },
    { id: 8, label: language === "en" ? "8. Summary" : "8. สรุปผล" },
  ];

  // Compute default sheet name during render to avoid useEffect setState cascading renders
  const defaultMatchedSheet = (validationResult?.sheetNames && validationResult.sheetNames.length > 0)
    ? (validationResult.sheetNames.find(
        (name) => name.toLowerCase() === currentSchema.worksheetName.toLowerCase()
      ) || validationResult.sheetNames[0])
    : "";

  const activeSheetName = selectedSheetName || defaultMatchedSheet;

  const getStatusIcon = (status: "success" | "warning" | "error") => {
    switch (status) {
      case "success":
        return <span className="text-green-500 font-bold text-lg">✓</span>;
      case "warning":
        return <span className="text-amber-500 font-bold text-lg">⚠</span>;
      case "error":
        return <span className="text-red-500 font-bold text-lg">✗</span>;
    }
  };

  const getStatusColorClass = (status: "success" | "warning" | "error") => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900/30 text-green-800 dark:text-green-400";
      case "warning":
        return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30 text-amber-800 dark:text-amber-400";
      case "error":
        return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/30 text-red-800 dark:text-red-400";
    }
  };

  // Helper to load sheet data and run data validation on transition to next steps
  const handleLoadSheet = async () => {
    if (!file?.rawFile || !activeSheetName) return;
    try {
      const parsed = await parseFile(file.rawFile, activeSheetName);
      // Auto map columns based on schema
      const mapping = importService.autoMap(parsed.headers, currentSchema);
      // Update hook states directly (which triggers validation internally)
      updateMappingAndRevalidate(mapping);
      setCurrentStep(3);
    } catch (err) {
      console.error("Failed to load sheet:", err);
      setError(language === "en" ? "Failed to parse worksheet." : "ไม่สามารถโหลดข้อมูลในเวิร์กชีทได้");
    }
  };

  const handleMappingChange = (header: string, canonicalField: CanonicalField | "") => {
    const updatedMapping = { ...columnMapping, [header]: canonicalField };
    updateMappingAndRevalidate(updatedMapping);
  };

  // Perform Column Mapping Validation
  const getMappingValidation = () => {
    const errors: string[] = [];
    const mappedFields = Object.entries(columnMapping)
      .map(([, field]) => field)
      .filter((f): f is CanonicalField => f !== "");

    // 1. Required Field Detection from current schema
    const missing = currentSchema.requiredFields.filter((f) => !mappedFields.includes(f));
    if (missing.length > 0) {
      errors.push(
        language === "en"
          ? `Missing required system fields: ${missing.join(", ")}`
          : `ขาดข้อมูลคอลัมน์ที่ระบบบังคับ: ${missing.join(", ")}`
      );
    }

    // 2. Duplicate Mapping Detection
    const fieldCounts: Record<string, number> = {};
    mappedFields.forEach((field) => {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    });
    const duplicates = Object.entries(fieldCounts)
      .filter(([, count]) => count > 1)
      .map(([field]) => field);
    
    if (duplicates.length > 0) {
      errors.push(
        language === "en"
          ? `Duplicate mapping detected for system fields: ${duplicates.join(", ")}`
          : `พบการจับคู่คอลัมน์ระบบซ้ำซ้อนกัน: ${duplicates.join(", ")}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const mappingValidation = getMappingValidation();

  // Group errors by target domain (Phase 4)
  const groupErrorsByDomain = (errors: ValidationError[]) => {
    const categories: Record<string, ValidationError[]> = {
      unit: [],
      person: [],
      ownership: [],
      resident: [],
      duplicate: [],
      referential: [],
      other: [],
    };

    errors.forEach(err => {
      const msg = err.message.toLowerCase();
      if (msg.includes("duplicate") || msg.includes("already exists in database") || msg.includes("ซ้ำ")) {
        categories.duplicate.push(err);
      } else if (msg.includes("not found") || msg.includes("does not exist") || msg.includes("ไม่มี") || msg.includes("ไม่พบ")) {
        categories.referential.push(err);
      } else if (msg.includes("unit") || msg.includes("floor") || msg.includes("area") || msg.includes("ratio") || msg.includes("building") || msg.includes("ห้อง")) {
        categories.unit.push(err);
      } else if (msg.includes("person") || msg.includes("name") || msg.includes("email") || msg.includes("phone") || msg.includes("บุคคล") || msg.includes("ชื่อ")) {
        categories.person.push(err);
      } else if (msg.includes("ownership") || msg.includes("owner") || msg.includes("เจ้าของ")) {
        categories.ownership.push(err);
      } else if (msg.includes("occupancy") || msg.includes("resident") || msg.includes("move-in") || msg.includes("move-out") || msg.includes("date") || msg.includes("เข้า") || msg.includes("ออก")) {
        categories.resident.push(err);
      } else {
        categories.other.push(err);
      }
    });

    return categories;
  };

  // Get transformation statistics preview (Phase 5)
  const getTransformationPreview = () => {
    let unitsCreate = 0;
    let unitsUpdate = 0;
    const unitsMatch = 0;
    
    let personsCreate = 0;
    let personsMatch = 0;
    
    let ownershipsCreate = 0;
    let ownershipsUpdate = 0;
    
    let occupanciesCreate = 0;
    let occupanciesUpdate = 0;

    if (!rowValidation) return null;

    rowValidation.results.forEach(res => {
      const warningMsgs = res.errors.map(e => e.message.toLowerCase());
      
      // Units
      if (selectedModule === "unit" || selectedModule === "combined_metro") {
        const hasUnitExistWarning = warningMsgs.some(m => m.includes("already exists"));
        if (hasUnitExistWarning) {
          unitsUpdate++;
        } else {
          unitsCreate++;
        }
      }

      // Persons
      if (selectedModule === "person") {
        const hasPersonExistWarning = warningMsgs.some(m => m.includes("already exists"));
        if (hasPersonExistWarning) {
          personsMatch++;
        } else {
          personsCreate++;
        }
      } else if (selectedModule === "combined_metro") {
        const matchesExisting = warningMsgs.some(m => m.includes("matches existing person"));
        if (matchesExisting) {
          personsMatch++;
        } else {
          personsCreate++;
        }
      }

      // Owners
      if (selectedModule === "owner") {
        const hasOwnerExistWarning = warningMsgs.some(m => m.includes("already exists"));
        if (hasOwnerExistWarning) {
          personsMatch++;
        } else {
          personsCreate++;
        }
      }

      // Ownership assignments
      if (selectedModule === "owner_relationship" || selectedModule === "combined_metro") {
        const hasOwnExistWarning = warningMsgs.some(m => m.includes("ownership assignment already exists") || m.includes("already exists"));
        if (hasOwnExistWarning) {
          ownershipsUpdate++;
        } else {
          ownershipsCreate++;
        }
      }

      // Occupancies
      if (selectedModule === "occupancy" || selectedModule === "combined_metro") {
        const hasOccExistWarning = warningMsgs.some(m => m.includes("duplicate active occupancy") || m.includes("already exists"));
        if (hasOccExistWarning) {
          occupanciesUpdate++;
        } else {
          occupanciesCreate++;
        }
      }
    });

    return {
      units: { create: unitsCreate, update: unitsUpdate, match: unitsMatch },
      persons: { create: personsCreate, match: personsMatch },
      ownerships: { create: ownershipsCreate, update: ownershipsUpdate },
      occupancies: { create: occupanciesCreate, update: occupanciesUpdate },
    };
  };

  const previewStats = getTransformationPreview();

  const handleStartImport = async () => {
    setCurrentStep(8);
    await commitImport();
  };

  const handleReset = () => {
    clear();
    setCurrentStep(1);
    setSelectedSheetName("");
  };

  const handleViewUnits = () => {
    router.push("/units");
    router.refresh();
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const propertyLabel = selectedProperty
    ? (language === "en" ? selectedProperty.property_name_en || selectedProperty.property_name_th : selectedProperty.property_name_th)
    : "";

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {language === "en" ? "Import Master Data" : "นำเข้าข้อมูลหลัก"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === "en" 
                ? "Upload, validate, map columns, and preview property/unit data before importing into IRM Enterprise." 
                : "อัปโหลด ตรวจสอบความถูกต้อง จัดคู่คอลัมน์ และพรีวิวข้อมูลยูนิตก่อนบันทึกเข้าระบบ IRM Enterprise"}
            </p>
          </div>

          {/* Module Selector & Property Selector (Only enabled in Step 1) */}
          {currentStep === 1 && (
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {language === "en" ? "Module" : "โมดูลนำเข้า"}
                </label>
                <select
                  value={selectedModule}
                  onChange={(e) => handleModuleChange(e.target.value)}
                  className="text-xs font-semibold p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg outline-none cursor-pointer text-[#D4AF37]"
                >
                  <option value="unit">{language === "en" ? "Unit Master (Mode A)" : "ข้อมูลยูนิต (Mode A)"}</option>
                  <option value="owner_relationship">{language === "en" ? "Owner Relationship (Mode B)" : "ความสัมพันธ์เจ้าของร่วม (Mode B)"}</option>
                  <option value="occupancy">{language === "en" ? "Resident Assignment (Mode C)" : "ข้อมูลการพักอาศัย (Mode C)"}</option>
                  <option value="combined_metro">{language === "en" ? "Combined Metro Workbook (Mode D)" : "ไฟล์รวมข้อมูล Metro (Mode D)"}</option>
                  <option value="property">{language === "en" ? "Property Master" : "ข้อมูลโครงการ"}</option>
                  <option value="person">{language === "en" ? "Person Master" : "ข้อมูลบุคคล"}</option>
                  <option value="owner">{language === "en" ? "Corporate Owner" : "ข้อมูลนิติบุคคล/เจ้าของร่วม"}</option>
                </select>
              </div>

              {["unit", "occupancy", "owner_relationship", "combined_metro"].includes(selectedModule) && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {language === "en" ? "Property" : "โครงการ"}
                  </label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="text-xs font-semibold p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg outline-none cursor-pointer text-[#D4AF37] max-w-[200px] truncate"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {language === "en" ? p.property_name_en || p.property_name_th : p.property_name_th}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stepper Wizard Header - 8 Steps */}
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700/80 -translate-y-1/2 z-0" />
          <div className="relative z-10 flex justify-between overflow-x-auto pb-2 scrollbar-thin">
            {steps.map((s) => {
              const isActive = currentStep === s.id;
              const isPast = currentStep > s.id;

              return (
                <div key={s.id} className="flex flex-col items-center space-y-2 bg-slate-50 dark:bg-slate-900 px-3 min-w-[100px] shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 transition duration-200 ${
                      isActive
                        ? "border-[#D4AF37] bg-white dark:bg-slate-800 text-[#D4AF37] shadow-md shadow-[#D4AF37]/10"
                        : isPast
                        ? "border-[#D4AF37] bg-[#D4AF37] text-white"
                        : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isPast ? "✓" : s.id}
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wide truncate max-w-[90px] ${
                      isActive
                        ? "text-[#D4AF37]"
                        : isPast
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error message banner */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 rounded-xl text-sm animate-fade-in flex items-center justify-between">
            <span>
              {error === "invalidFileType"
                ? (language === "en" ? "Invalid file type. Please upload a .xlsx, .xls, or .csv file." : "ประเภทไฟล์ไม่ถูกต้อง กรุณาอัปโหลดไฟล์นามสกุล .xlsx, .xls หรือ .csv")
                : error === "fileTooLarge"
                ? (language === "en" ? `File size exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB.` : `ขนาดไฟล์ใหญ่เกินขีดจำกัดสูงสุด ${MAX_FILE_SIZE_MB}MB`)
                : error === "fileRequired"
                ? (language === "en" ? "Please select a file to proceed." : "กรุณาเลือกไฟล์ก่อนดำเนินการต่อ")
                : error === "validationRequired"
                ? (language === "en" ? "Mapping validation is required before committing." : "กรุณาตรวจสอบการจับคู่ฟิลด์ให้ถูกต้องก่อนนำข้อมูลเข้า")
                : error === "propertyRequired"
                ? (language === "en" ? "Please select a target property before importing." : "กรุณาเลือกโครงการเป้าหมายก่อนทำการนำเข้า")
                : error}
            </span>
            <button onClick={() => setError(null)} className="text-red-500 font-bold ml-2">×</button>
          </div>
        )}

        {/* Step 1: Upload File */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            {!file ? (
              <UploadZone onFileSelected={handleFileSelect} loading={isValidating} onError={setError} />
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📄</span>
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{file.name}</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-lg text-xs font-semibold transition"
                  >
                    {language === "en" ? "Replace File" : "เปลี่ยนไฟล์"}
                  </button>
                </div>

                {["unit", "occupancy", "owner_relationship", "combined_metro"].includes(selectedModule) && selectedPropertyId && (
                  <div className="p-3 bg-amber-50/50 border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20 text-xs text-amber-700 dark:text-amber-400 rounded-lg flex items-center justify-between">
                    <span>
                      {language === "en" ? "Target Property:" : "โครงการเป้าหมาย:"}
                    </span>
                    <span className="font-bold">{propertyLabel}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={async () => {
                      await runFileValidation();
                      setCurrentStep(2);
                    }}
                    disabled={isValidating}
                    className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-50"
                  >
                    {isValidating ? t.common.processing : (language === "en" ? "Analyze structure & Proceed" : "วิเคราะห์โครงสร้างและดำเนินการต่อ")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Sheet */}
        {currentStep === 2 && file && validationResult && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {language === "en" ? "Select Worksheet" : "เลือกชีตที่ต้องการนำเข้า"}
            </h3>
            
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === "en" 
                ? "This Excel workbook contains multiple worksheets. Please select the correct worksheet containing the source data."
                : "ไฟล์เอกสารนี้มีหลายชีตข้อมูล กรุณาเลือกชีตที่มีตารางข้อมูลนำเข้าที่ถูกต้อง"}
            </p>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/50 space-y-3">
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
                {language === "en" ? "Worksheets found:" : "รายชื่อชีตที่พบ:"}
              </label>
              <select
                value={activeSheetName}
                onChange={(e) => setSelectedSheetName(e.target.value)}
                className="w-full font-semibold p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg outline-none cursor-pointer text-slate-800 dark:text-slate-200"
              >
                {validationResult.sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name} {name.toLowerCase() === currentSchema.worksheetName.toLowerCase() ? " (Recommended)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                onClick={handleLoadSheet}
                disabled={!activeSheetName}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10"
              >
                {language === "en" ? "Confirm Sheet & Proceed" : "ยืนยันชีตและดำเนินการต่อ"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Check Headers */}
        {currentStep === 3 && file && validationResult && parsedData && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-3">
                {language === "en" ? "Check Column Headers" : "ตรวจสอบหัวตาราง"}
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 text-xs text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/10 dark:text-blue-400">
                  <p className="font-semibold mb-1">
                    {language === "en" ? "Headers read from selected sheet:" : "หัวคอลัมน์เดิมที่อ่านได้จากชีต:"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {parsedData.headers.map((h, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-white border border-blue-200 dark:bg-slate-800 dark:border-blue-900/50 rounded font-mono font-bold text-slate-700 dark:text-slate-300">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {language === "en" ? "Structure Checklist" : "เช็คลิสต์โครงสร้างไฟล์"}
                  </h4>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                    <div className="py-3 flex justify-between items-center">
                      <span>{language === "en" ? "1. File Open validation" : "1. ความสามารถในการเปิดอ่านไฟล์"}</span>
                      {getStatusIcon(validationResult.checks.fileOpen.status)}
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <span>{language === "en" ? "2. Worksheet found in workbook" : "2. พบชีตที่ระบุในเวิร์กบุ๊ค"}</span>
                      {getStatusIcon(validationResult.checks.sheetExists.status)}
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <span>{language === "en" ? "3. Columns check against schema" : "3. ความถูกต้องของส่วนหัวตาราง"}</span>
                      {getStatusIcon(validationResult.checks.columnsExist.status)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10"
              >
                {language === "en" ? "Proceed to Map Columns" : "ดำเนินการต่อเพื่อจับคู่คอลัมน์"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Map Columns */}
        {currentStep === 4 && parsedData && (
          <div className="space-y-6 animate-fade-in">
            {/* Column Mapping Panel */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {language === "en" ? "Column Mapping Panel" : "แผงจับคู่อินเทอร์เฟซคอลัมน์"}
                </h3>
                <span className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold rounded-full capitalize">
                  {language === "en" ? `${selectedModule} Schema` : `สคีมา: ${selectedModule}`}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === "en"
                  ? "Align the columns of your source file to match the target database fields."
                  : "กรุณาระบุความสัมพันธ์ระหว่าง หัวคอลัมน์เดิมในไฟล์ (ซ้าย) ➔ ฟิลด์ข้อมูลในระบบ (ขวา)"}
              </p>

              {/* Mapping Validation Alert */}
              {!mappingValidation.isValid && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 rounded-xl space-y-1">
                  <h4 className="font-bold text-xs">
                    {language === "en" ? "Mapping Errors Found" : "พบข้อผิดพลาดในการจับคู่คอลัมน์"}
                  </h4>
                  <ul className="text-xs list-disc list-inside space-y-0.5">
                    {mappingValidation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {parsedData.headers.map((header) => {
                  const targetField = columnMapping[header] || "";
                  const isRequired = currentSchema.requiredFields.includes(targetField as CanonicalField);

                  return (
                    <div
                      key={header}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        isRequired
                          ? "border-green-100 bg-green-50/10 dark:border-green-900/30"
                          : "border-slate-100 bg-slate-50 dark:border-slate-700/50"
                      }`}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-sm font-mono font-medium truncate text-slate-800 dark:text-slate-200" title={header}>
                          {header}
                        </span>
                        <span className="text-[10px] text-slate-400">Source Column</span>
                      </div>
                      <span className="text-slate-400 text-xs px-2">➔</span>
                      <div className="flex flex-col items-end">
                        <select
                          value={targetField}
                          onChange={(e) => handleMappingChange(header, e.target.value as CanonicalField | "")}
                          className={`text-xs p-1.5 border rounded bg-white dark:bg-slate-800 outline-none w-48 font-semibold cursor-pointer ${
                            isRequired
                              ? "border-green-500 text-green-700 dark:text-green-400"
                              : "border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="">(Ignore Column / ละเว้นคอลัมน์)</option>
                          {schemaFields.map((field) => {
                            const isReq = currentSchema.requiredFields.includes(field);
                            return (
                              <option key={field} value={field}>
                                {field} {isReq ? "(Required)" : ""}
                              </option>
                            );
                          })}
                        </select>
                        <span className="text-[10px] text-slate-400 mt-1">Target Field</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-4 overflow-hidden">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {language === "en" ? "Preview Table (First 20 Rows)" : "ตารางดูตัวอย่างข้อมูล (20 แถวแรก)"}
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {language === "en" ? `Total: ${parsedData.rows.length} rows` : `ทั้งหมด: ${parsedData.rows.length} แถว`}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-600 dark:text-slate-300">
                      <th className="p-3 w-12 text-center">Row</th>
                      {parsedData.headers.map((h) => (
                        <th key={h} className="p-3 font-mono">
                          {h}
                          {columnMapping[h] && (
                            <span className="block text-[10px] text-[#D4AF37] font-semibold mt-0.5">
                              ({columnMapping[h]})
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {parsedData.rows
                      .slice((previewPage - 1) * itemsPerPage, previewPage * itemsPerPage)
                      .map((row, index) => {
                        const rowNum = (previewPage - 1) * itemsPerPage + index + 2;
                        return (
                          <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 text-slate-400 text-center font-mono">{rowNum}</td>
                            {parsedData.headers.map((h) => (
                              <td key={h} className="p-3 font-mono truncate max-w-[200px] text-slate-700 dark:text-slate-300">
                                {row[h] !== null && row[h] !== undefined ? String(row[h]) : "-"}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Simple pagination */}
              <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                <span>
                  Page {previewPage} of {Math.ceil(Math.min(20, parsedData.rows.length) / itemsPerPage)}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={previewPage === 1}
                    onClick={() => setPreviewPage((p) => p - 1)}
                    className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 font-medium"
                  >
                    Previous
                  </button>
                  <button
                    disabled={previewPage === Math.ceil(Math.min(20, parsedData.rows.length) / itemsPerPage)}
                    onClick={() => setPreviewPage((p) => p + 1)}
                    className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded disabled:opacity-50 font-medium"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Wizard Navigation Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                disabled={!mappingValidation.isValid}
                onClick={() => setCurrentStep(5)}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {language === "en" ? "Run Validation & Proceed" : "ตรวจสอบความถูกต้องข้อมูล"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Validate Data (Domain Grouped Logs) */}
        {currentStep === 5 && rowValidation && (
          <div className="space-y-6 animate-fade-in">
            {/* Validation Dashboard Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm text-center">
                <span className="block text-2xl font-bold text-slate-700 dark:text-slate-300 font-mono">
                  {rowValidation.summary.totalRows}
                </span>
                <span className="text-xs text-slate-400 font-medium">Total Rows</span>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm text-center border-l-4 border-l-green-500">
                <span className="block text-2xl font-bold text-green-600 dark:text-green-400 font-mono">
                  {rowValidation.summary.validRows}
                </span>
                <span className="text-xs text-slate-400 font-medium">Valid Rows</span>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm text-center border-l-4 border-l-amber-500">
                <span className="block text-2xl font-bold text-amber-500 dark:text-amber-400 font-mono">
                  {rowValidation.summary.warningRows}
                </span>
                <span className="text-xs text-slate-400 font-medium">Warnings</span>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 shadow-sm text-center border-l-4 border-l-red-500">
                <span className="block text-2xl font-bold text-red-600 dark:text-red-400 font-mono">
                  {rowValidation.summary.errorRows}
                </span>
                <span className="text-xs text-slate-400 font-medium">Errors</span>
              </div>
            </div>

            {/* Overall Status Banner */}
            <div
              className={`p-5 border rounded-xl flex items-start gap-4 text-sm font-medium ${getStatusColorClass(
                rowValidation.summary.importReady ? "success" : "error"
              )}`}
            >
              <span className="text-2xl leading-none">
                {getStatusIcon(rowValidation.summary.importReady ? "success" : "error")}
              </span>
              <div className="space-y-1">
                <h4 className="font-bold text-base">
                  {rowValidation.summary.importReady
                    ? (language === "en" ? "Validation Passed." : "ผ่านการตรวจสอบข้อมูล")
                    : (language === "en" ? "Validation Errors Detected" : "พบข้อผิดพลาดข้อมูลนำเข้า")}
                </h4>
                <p className="text-xs opacity-90">
                  {rowValidation.summary.importReady
                    ? (language === "en"
                        ? `All ${rowValidation.summary.totalRows} rows are ready. No blocking errors detected.`
                        : `ข้อมูลยูนิตทั้งหมด ${rowValidation.summary.totalRows} แถวพร้อมนำเข้า ไม่พบข้อผิดพลาด`)
                    : (language === "en"
                        ? "Please correct the data rows with errors shown below before you can proceed. Warnings do not block import."
                        : "กรุณาตรวจสอบข้อมูลที่มีสถานะ Error คำเตือน (Warning) จะไม่กีดขวางการนำเข้าข้อมูล")}
                </p>
              </div>
            </div>

            {/* Data Completeness Score Dashboard */}
            {selectedModule === "combined_metro" && (rowValidation as any).completeness && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">📊 DATA COMPLETENESS INDEX</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Unit Completeness */}
                  <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-center space-y-2">
                    <span className="text-xs font-bold text-slate-500 block uppercase">Unit Master</span>
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20">
                            Completeness
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold inline-block text-indigo-600 font-mono">
                            {(rowValidation as any).completeness.unit}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-indigo-100 dark:bg-indigo-950/50">
                        <div
                          style={{ width: `${(rowValidation as any).completeness.unit}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Owner Completeness */}
                  <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-center space-y-2">
                    <span className="text-xs font-bold text-slate-500 block uppercase">Owner Assignment</span>
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
                            Completeness
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold inline-block text-emerald-600 font-mono">
                            {(rowValidation as any).completeness.owner}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-emerald-100 dark:bg-emerald-950/50">
                        <div
                          style={{ width: `${(rowValidation as any).completeness.owner}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Resident Completeness */}
                  <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-center space-y-2">
                    <span className="text-xs font-bold text-slate-500 block uppercase">Resident Assignment</span>
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-violet-600 bg-violet-50 dark:bg-violet-950/20">
                            Completeness
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold inline-block text-violet-600 font-mono">
                            {(rowValidation as any).completeness.resident}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-violet-100 dark:bg-violet-950/50">
                        <div
                          style={{ width: `${(rowValidation as any).completeness.resident}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-violet-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Meter Completeness */}
                  <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-center space-y-2">
                    <span className="text-xs font-bold text-slate-500 block uppercase">Meter Master</span>
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                            Completeness
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold inline-block text-amber-600 font-mono">
                            {(rowValidation as any).completeness.meter}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-amber-100 dark:bg-amber-950/50">
                        <div
                          style={{ width: `${(rowValidation as any).completeness.meter}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-amber-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grouped Logs Panel (Phase 4) */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {language === "en" ? "Domain Grouped Error Log" : "บันทึกแยกรายแผนกข้อมูล (Domain-specific Logs)"}
              </h3>

              {(() => {
                const grouped = groupErrorsByDomain(rowValidation.allErrors);
                const hasErrors = rowValidation.allErrors.length > 0;

                if (!hasErrors) {
                  return (
                    <div className="p-8 text-center text-slate-400 font-medium border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                      🎉 {language === "en" ? "No validation messages. Data is perfectly formatted!" : "ไม่พบข้อผิดพลาดใดๆ โครงสร้างข้อมูลสมบูรณ์แบบ"}
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Unit Domain */}
                    {grouped.unit.length > 0 && (
                      <div className="border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">🏢 UNIT DOMAIN (ยูนิต/ห้อง)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.unit.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/30">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Person Domain */}
                    {grouped.person.length > 0 && (
                      <div className="border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">👤 PERSON DOMAIN (บุคคล/ชื่อ)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.person.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/30">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ownership Domain */}
                    {grouped.ownership.length > 0 && (
                      <div className="border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">🔑 OWNERSHIP RELATIONSHIPS (สิทธิ์การถือครอง)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.ownership.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/30">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resident Domain */}
                    {grouped.resident.length > 0 && (
                      <div className="border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/30">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">🚪 RESIDENT ASSIGNMENT (การเข้าอยู่อาศัย)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.resident.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700/30">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duplicate Errors */}
                    {grouped.duplicate.length > 0 && (
                      <div className="border border-red-100 dark:border-red-950/30 rounded-xl p-4 bg-red-50/10">
                        <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-2">⚠️ DUPLICATE & CONFLICT WARNINGS (รายการซ้ำซ้อน)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.duplicate.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-red-100 dark:border-red-900/20">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Referential Integrity Errors */}
                    {grouped.referential.length > 0 && (
                      <div className="border border-red-100 dark:border-red-950/30 rounded-xl p-4 bg-red-50/10">
                        <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-2">🔗 REFERENTIAL INTEGRITY (การเชื่อมโยงระบบฐานข้อมูล)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.referential.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-red-100 dark:border-red-900/20">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Errors */}
                    {grouped.other.length > 0 && (
                      <div className="border border-slate-100 dark:border-slate-700/50 rounded-xl p-4 bg-slate-50/50">
                        <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">📝 OTHER SYSTEM DIAGNOSTICS (ระบบวิเคราะห์อื่นๆ)</h4>
                        <div className="space-y-1.5 text-xs max-h-32 overflow-y-auto pr-2">
                          {grouped.other.map((err, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-slate-100/50">
                              <span className="font-mono text-slate-500">Row {err.rowNumber} ({err.column})</span>
                              <span className={err.severity === "error" ? "text-red-500 font-semibold" : "text-amber-500"}>{err.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                disabled={!rowValidation.summary.importReady}
                onClick={() => setCurrentStep(6)}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {language === "en" ? "Continue to Preview Changes" : "ดำเนินการต่อเพื่อดูผลลัพธ์พรีวิว"}
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Preview Transformations (Phase 5) */}
        {currentStep === 6 && previewStats && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-6 animate-fade-in">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-3">
              {language === "en" ? "Transformation Preview" : "ดูตัวอย่างการเปลี่ยนแปลงฐานข้อมูล"}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === "en" 
                ? "The system will transform the Excel sheet rows and perform the following database operations:"
                : "ระบบจะแปลงข้อมูลแต่ละแถวในเอกสารต้นทาง เพื่อดำเนินการบันทึกข้อมูลเข้าระบบดังต่อไปนี้:"}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Units Preview */}
              {(selectedModule === "unit" || selectedModule === "combined_metro") && (
                <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  <h4 className="text-xs font-bold text-[#D4AF37] uppercase">🏢 UNITS (ข้อมูลยูนิต/ห้อง)</h4>
                  <ul className="text-xs space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <li className="flex justify-between"><span>Create New:</span> <span className="font-mono text-green-600 font-bold">{previewStats.units.create} records</span></li>
                    <li className="flex justify-between"><span>Update Existing:</span> <span className="font-mono text-blue-600 font-bold">{previewStats.units.update} records</span></li>
                  </ul>
                </div>
              )}

              {/* Persons Preview */}
              {(selectedModule === "person" || selectedModule === "combined_metro" || selectedModule === "owner") && (
                <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  <h4 className="text-xs font-bold text-[#D4AF37] uppercase">👤 PERSONS/OWNERS (ประวัติบุคคลและเจ้าของ)</h4>
                  <ul className="text-xs space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <li className="flex justify-between"><span>Create New Profile:</span> <span className="font-mono text-green-600 font-bold">{previewStats.persons.create} profiles</span></li>
                    <li className="flex justify-between"><span>Match Existing Profile:</span> <span className="font-mono text-blue-600 font-bold">{previewStats.persons.match} profiles</span></li>
                  </ul>
                </div>
              )}

              {/* Ownership Preview */}
              {(selectedModule === "owner_relationship" || selectedModule === "combined_metro") && (
                <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  <h4 className="text-xs font-bold text-[#D4AF37] uppercase">🔑 OWNER ASSIGNMENTS (สิทธิ์การถือกรรมสิทธิ์ห้อง)</h4>
                  <ul className="text-xs space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <li className="flex justify-between"><span>Assign New Owner:</span> <span className="font-mono text-green-600 font-bold">{previewStats.ownerships.create} records</span></li>
                    <li className="flex justify-between"><span>Update Active Assignment:</span> <span className="font-mono text-blue-600 font-bold">{previewStats.ownerships.update} records</span></li>
                  </ul>
                </div>
              )}

              {/* Resident Preview */}
              {(selectedModule === "occupancy" || selectedModule === "combined_metro") && (
                <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  <h4 className="text-xs font-bold text-[#D4AF37] uppercase">🚪 RESIDENT OCCUPANCY (ข้อมูลสัญญาผู้พักอาศัย)</h4>
                  <ul className="text-xs space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <li className="flex justify-between"><span>Assign New Resident:</span> <span className="font-mono text-green-600 font-bold">{previewStats.occupancies.create} records</span></li>
                    <li className="flex justify-between"><span>Update Occupant Details:</span> <span className="font-mono text-blue-600 font-bold">{previewStats.occupancies.update} records</span></li>
                  </ul>
                </div>
              )}

              {/* Utility Meters Preview */}
              {selectedModule === "combined_metro" && (previewStats as any).meters && (
                <div className="p-4 border border-slate-100 dark:border-slate-700/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 space-y-2">
                  <h4 className="text-xs font-bold text-[#D4AF37] uppercase">🔌 UTILITY METERS (มิเตอร์น้ำ/ไฟ)</h4>
                  <ul className="text-xs space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <li className="flex justify-between"><span>Create New Meter:</span> <span className="font-mono text-green-600 font-bold">{(previewStats as any).meters.create} records</span></li>
                    <li className="flex justify-between"><span>Update Serial/Number:</span> <span className="font-mono text-blue-600 font-bold">{(previewStats as any).meters.update} records</span></li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <button
                onClick={() => setCurrentStep(5)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                onClick={() => setCurrentStep(7)}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10"
              >
                {language === "en" ? "Proceed to Confirmation" : "ตรวจสอบข้อมูลเรียบร้อย ยืนยันขั้นตอนถัดไป"}
              </button>
            </div>
          </div>
        )}

        {/* Step 7: Confirm Import */}
        {currentStep === 7 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-8 shadow-sm space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 bg-[#D4AF37]/20 text-[#D4AF37] text-3xl flex items-center justify-center rounded-full mx-auto animate-bounce">
              💾
            </div>
            
            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {language === "en" ? "Confirm Import Execution" : "ยืนยันนำเข้าฐานข้อมูลจริง"}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {language === "en"
                  ? "Are you sure you want to write this parsed Master Data into IRM Enterprise? Existing units and persons will be updated safely."
                  : "กรุณายืนยันการนำเข้าข้อมูลยูนิตเข้าระบบ ข้อมูลเดิมที่มีความขัดแย้งจะได้รับการอัปเดตแบบรักษาประวัติเดิมและไม่สูญหาย"}
              </p>
            </div>

            {selectedModule === "unit" && selectedPropertyId && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/10 text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-900/20 max-w-xs mx-auto">
                {language === "en" ? "Target Property:" : "โครงการนำเข้าเป้าหมาย:"} <span className="font-bold">{propertyLabel}</span>
              </div>
            )}

            {/* Bootstrap Strategies Config */}
            {selectedModule === "combined_metro" && (
              <div className="max-w-md mx-auto p-5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-left space-y-4 shadow-inner">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">⚙️ IMPORT ENGINE STRATEGY (กลยุทธ์การบันทึก)</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Execution Mode</label>
                    <select
                      value={importStrategy}
                      onChange={(e) => setImportStrategy(e.target.value)}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs font-medium"
                    >
                      <option value="dry_run">Dry Run (Simulate & Verify Rollbacks)</option>
                      <option value="upsert">Full Upsert (Insert & Update)</option>
                      <option value="create_only">Create Only (Skip Database Updates)</option>
                      <option value="update_only">Update Only (Skip New Creates)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Duplicate Unit Resolution</label>
                    <select
                      value={duplicateResolution}
                      onChange={(e) => setDuplicateResolution(e.target.value)}
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-xs font-medium"
                    >
                      <option value="update">Overwrite/Update (Compare & Overwrite)</option>
                      <option value="skip">Keep Existing / Skip updates</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <button
                disabled={isImporting}
                onClick={() => setCurrentStep(6)}
                className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-semibold transition disabled:opacity-40"
              >
                {language === "en" ? "Cancel" : "ยกเลิก"}
              </button>
              <button
                disabled={isImporting}
                onClick={handleStartImport}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition shadow-md shadow-green-600/10 disabled:opacity-40 flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {importProgress || "Saving..."}
                  </>
                ) : (
                  language === "en" ? "Confirm & Proceed Import" : "เริ่มนำเข้าฐานข้อมูล"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 8: Summary */}
        {currentStep === 8 && importResult && (
          <div className="space-y-6 animate-fade-in">
            <div
              className={`p-6 border rounded-xl flex flex-col gap-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl leading-none">
                  {importResult.success ? (importResult.isDryRun ? "🧪" : "✔") : "❌"}
                </span>
                <div className="space-y-1 flex-1">
                  <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {importResult.success 
                      ? (importResult.isDryRun 
                          ? (language === "en" ? "🧪 Dry Run Simulation Completed" : "🧪 จำลองนำเข้าเสร็จสมบูรณ์")
                          : (language === "en" ? "✔ Import completed successfully" : "✔ นำเข้าข้อมูลเสร็จสมบูรณ์"))
                      : (language === "en" ? "Import failed." : "นำเข้าข้อมูลไม่สำเร็จ")}
                    {importResult.success && importResult.isDryRun && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded font-normal uppercase">
                        Simulation Mode
                      </span>
                    )}
                  </h4>
                  <p className="text-sm opacity-95 text-slate-500 dark:text-slate-400">
                    {importResult.success
                      ? (importResult.isDryRun
                          ? (language === "en" ? "Dry Run simulation completed successfully. No rows were written to the database." : "การจำลองนำเข้าเสร็จสิ้นด้วยดี ไม่มีการเขียนข้อมูลจริงลงฐานข้อมูล")
                          : importResult.message)
                      : (language === "en" ? "No data has been saved." : "ไม่มีการบันทึกข้อมูลใดๆ")}
                  </p>
                </div>
              </div>

              {importResult.success && importResult.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-200/50 dark:border-slate-700/40 pt-4 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-green-500">
                    <span className="block text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                      {importResult.summary.inserted}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Inserted</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-blue-500">
                    <span className="block text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                      {importResult.summary.updated}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Updated</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-amber-500">
                    <span className="block text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                      {importResult.summary.skipped}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Skipped</span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-slate-400">
                    <span className="block text-2xl font-bold font-mono text-slate-600 dark:text-slate-400">
                      {importResult.summary.elapsedTime}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Duration</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {language === "en" ? "Start New Import" : "นำเข้าไฟล์ใหม่"}
                </button>
                {importResult.success && !importResult.isDryRun && (selectedModule === "unit" || selectedModule === "combined_metro") && (
                  <button
                    onClick={handleViewUnits}
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-xs font-bold transition shadow-md shadow-[#D4AF37]/10"
                  >
                    {language === "en" ? "View Units" : "ดูรายชื่อยูนิต"}
                  </button>
                )}
                {importResult.success && importResult.isDryRun && (
                  <button
                    onClick={() => {
                      setImportStrategy("upsert");
                      setCurrentStep(7);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-green-600/10"
                  >
                    {language === "en" ? "Proceed to Commit" : "ดำเนินการนำเข้าจริง"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
