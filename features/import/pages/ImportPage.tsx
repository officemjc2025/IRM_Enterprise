"use client";

import React, { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useImport, MAX_FILE_SIZE_MB } from "../hooks/useImport";
import UploadZone from "../components/UploadZone";
import { useLanguage } from "@/providers/LanguageProvider";
import { ColumnMapping, CanonicalField } from "../types/import.types";
import { getSchema } from "../schemas";
import { useRouter } from "next/navigation";

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
    step,
    setStep,
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
    handleFileSelect,
    runFileValidation,
    updateMappingAndRevalidate,
    commitImport,
    clear,
  } = useImport();

  const [previewPage, setPreviewPage] = useState(1);
  const itemsPerPage = 5;

  const currentSchema = getSchema(selectedModule);
  const schemaFields = [...currentSchema.requiredFields, ...currentSchema.optionalFields];

  const steps = [
    { id: 1, label: language === "en" ? "Upload" : "อัปโหลด" },
    { id: 2, label: language === "en" ? "Validate" : "ตรวจสอบ" },
    { id: 3, label: language === "en" ? "Preview" : "พรีวิว" },
    { id: 4, label: language === "en" ? "Ready" : "พร้อมนำเข้า" },
  ];

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

  const handleMappingChange = (header: string, canonicalField: string) => {
    const updatedMapping = { ...columnMapping, [header]: canonicalField as any };
    updateMappingAndRevalidate(updatedMapping);
  };

  // Perform Column Mapping Validation
  const getMappingValidation = () => {
    const errors: string[] = [];
    const mappedFields = Object.entries(columnMapping)
      .map(([_, field]) => field)
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
      .filter(([_, count]) => count > 1)
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

  // Navigate to Units page and refresh route cache
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
          {step === 1 && (
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {language === "en" ? "Module" : "โมดูล"}
                </label>
                <select
                  value={selectedModule}
                  onChange={(e) => handleModuleChange(e.target.value)}
                  className="text-xs font-semibold p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg outline-none cursor-pointer text-[#D4AF37]"
                >
                  <option value="unit">{language === "en" ? "Unit (Metro Pilot)" : "ยูนิต (Metro Pilot)"}</option>
                  <option value="property">{language === "en" ? "Property" : "โครงการ"}</option>
                  <option value="person">{language === "en" ? "Person" : "บุคคล"}</option>
                  <option value="owner">{language === "en" ? "Owner" : "เจ้าของร่วม"}</option>
                  <option value="occupancy">{language === "en" ? "Occupancy" : "การอยู่อาศัย"}</option>
                </select>
              </div>

              {selectedModule === "unit" && (
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

        {/* Stepper Wizard Header */}
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700/80 -translate-y-1/2 z-0" />
          <div className="relative z-10 flex justify-between">
            {steps.map((s) => {
              const isActive = step === s.id;
              const isPast = step > s.id;

              return (
                <div key={s.id} className="flex flex-col items-center space-y-2 bg-slate-50 dark:bg-slate-900 px-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition duration-200 ${
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
                    className={`text-xs font-semibold tracking-wide ${
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
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 rounded-xl text-sm animate-fade-in">
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
          </div>
        )}

        {/* Step 1: Upload File */}
        {step === 1 && (
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
                    onClick={clear}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-lg text-xs font-semibold transition"
                  >
                    {language === "en" ? "Replace File" : "เปลี่ยนไฟล์"}
                  </button>
                </div>

                {selectedModule === "unit" && selectedPropertyId && (
                  <div className="p-3 bg-amber-50/50 border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20 text-xs text-amber-700 dark:text-amber-400 rounded-lg flex items-center justify-between">
                    <span>
                      {language === "en" ? "Target Property:" : "โครงการเป้าหมาย:"}
                    </span>
                    <span className="font-bold">{propertyLabel}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={runFileValidation}
                    disabled={isValidating}
                    className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-50"
                  >
                    {isValidating ? t.common.processing : (language === "en" ? "Validate File Structure" : "ตรวจสอบโครงสร้างไฟล์")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Validate File */}
        {step === 2 && file && validationResult && (
          <div className="space-y-6 animate-fade-in">
            {/* File Info */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-xl p-4 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{file.name}</span>
                <span className="text-slate-400 font-mono">({formatFileSize(file.size)})</span>
              </div>
              <span className="text-[#D4AF37] font-semibold">{language === "en" ? "Validation Results" : "ผลการตรวจสอบโครงสร้าง"}</span>
            </div>

            {/* Target Property label if applicable */}
            {selectedModule === "unit" && selectedPropertyId && (
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 p-3 rounded-lg text-xs flex justify-between">
                <span className="text-slate-500">{language === "en" ? "Target Property" : "โครงการเป้าหมาย"}</span>
                <span className="font-bold text-[#D4AF37]">{propertyLabel}</span>
              </div>
            )}

            {/* Overall status Banner */}
            <div
              className={`p-4 border rounded-xl flex items-start gap-3 text-sm font-medium ${getStatusColorClass(
                validationResult.overallStatus
              )}`}
            >
              <span className="text-lg leading-none">{getStatusIcon(validationResult.overallStatus)}</span>
              <div>
                <p className="font-semibold">
                  {validationResult.overallStatus === "success"
                    ? (language === "en" ? "Validation Success! File structure looks great." : "การตรวจสอบเสร็จสมบูรณ์! โครงสร้างไฟล์ถูกต้องดี")
                    : validationResult.overallStatus === "warning"
                    ? (language === "en" ? "Validation Passed with warnings. Some optional columns are missing." : "ผ่านการตรวจสอบ แต่มีข้อแนะนำเนื่องจากบางคอลัมน์ที่ไม่จำเป็นไม่มีข้อมูล")
                    : (language === "en" ? "Validation Failed. Please correct the errors below." : "การตรวจสอบล้มเหลว กรุณาแก้ไขข้อผิดพลาดด้านล่าง")}
                </p>
              </div>
            </div>

            {/* Checklist items */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {language === "en" ? "Structure Checklist" : "เช็คลิสต์โครงสร้างไฟล์"}
              </h3>

              <div className="space-y-5">
                {/* Check 1: Open file */}
                <div className="flex items-start gap-4 text-sm">
                  <div className="mt-0.5">{getStatusIcon(validationResult.checks.fileOpen.status)}</div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === "en" ? "Read Fileability" : "การอ่านไฟล์ข้อมูล"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{validationResult.checks.fileOpen.message}</p>
                  </div>
                </div>

                {/* Check 2: Sheet check */}
                <div className="flex items-start gap-4 text-sm border-t border-slate-100 dark:border-slate-700/50 pt-4">
                  <div className="mt-0.5">{getStatusIcon(validationResult.checks.sheetExists.status)}</div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === "en" ? "Required Sheets check" : "การตรวจสอบชีทที่จำเป็น"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {validationResult.checks.sheetExists.message}
                    </p>
                  </div>
                </div>

                {/* Check 3: Column check */}
                <div className="flex items-start gap-4 text-sm border-t border-slate-100 dark:border-slate-700/50 pt-4">
                  <div className="mt-0.5">{getStatusIcon(validationResult.checks.columnsExist.status)}</div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {language === "en" ? "Required Columns presence" : "การมีอยู่ของคอลัมน์ที่จำเป็น"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{validationResult.checks.columnsExist.message}</p>
                    {validationResult.checks.columnsExist.details && (
                      <ul className="text-xs list-disc list-inside mt-1.5 space-y-1 text-slate-500 dark:text-slate-400">
                        {validationResult.checks.columnsExist.details.map((detail, index) => (
                          <li
                            key={index}
                            className={
                              validationResult.checks.columnsExist.status === "error"
                                ? "text-red-500 dark:text-red-400 font-medium"
                                : "text-amber-500 dark:text-amber-400 font-medium"
                            }
                          >
                            {detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Wizard Navigation Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700/60">
              <button
                onClick={clear}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                disabled={!validationResult.isValid}
                onClick={() => setStep(3)}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {language === "en" ? "Continue to Preview" : "ดำเนินการต่อเพื่อดูตัวอย่าง"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview Table & Mapping Panel */}
        {step === 3 && parsedData && (
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

              {selectedModule === "unit" && selectedPropertyId && (
                <div className="p-3 bg-amber-50/50 border border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20 text-xs text-amber-700 dark:text-amber-400 rounded-lg flex items-center justify-between">
                  <span>
                    {language === "en" ? "Mapping for Target Property:" : "จับคู่สำหรับโครงการเป้าหมาย:"}
                  </span>
                  <span className="font-bold">{propertyLabel}</span>
                </div>
              )}

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
                        <span className="text-sm font-mono font-medium truncate" title={header}>
                          {header}
                        </span>
                        <span className="text-[10px] text-slate-400">Source Column</span>
                      </div>
                      <span className="text-slate-400 text-xs px-2">➔</span>
                      <div className="flex flex-col items-end">
                        <select
                          value={targetField}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          className={`text-xs p-1.5 border rounded bg-white dark:bg-slate-800 outline-none w-48 font-semibold cursor-pointer ${
                            isRequired
                              ? "border-green-500 text-green-700 dark:text-green-400"
                              : "border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <option value="">(Ignore Column)</option>
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
                              <td key={h} className="p-3 font-mono truncate max-w-[200px]">
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
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                {language === "en" ? "Back" : "ย้อนกลับ"}
              </button>
              <button
                disabled={!mappingValidation.isValid}
                onClick={() => setStep(4)}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {language === "en" ? "Analyze & Ready to Import" : "วิเคราะห์และพร้อมนำเข้า"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Import Summary & Commit */}
        {step === 4 && rowValidation && (
          <div className="space-y-6 animate-fade-in">
            {/* Import result alert card */}
            {importResult && (
              <div
                className={`p-6 border rounded-xl flex flex-col gap-4 ${
                  importResult.success
                    ? "bg-green-50 border-green-200 text-green-900 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-400"
                    : "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl leading-none">{importResult.success ? "✔" : "❌"}</span>
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-lg">
                      {importResult.success 
                        ? (language === "en" ? "✔ Import completed successfully" : "✔ นำเข้าข้อมูลเสร็จสมบูรณ์")
                        : (language === "en" ? "Import failed." : "นำเข้าข้อมูลไม่สำเร็จ")}
                    </h4>
                    <p className="text-sm opacity-95">
                      {importResult.success
                        ? importResult.message
                        : (language === "en" ? "No data has been saved." : "ไม่มีการบันทึกข้อมูลใดๆ")}
                    </p>
                  </div>
                </div>

                {importResult.success && importResult.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-200/50 dark:border-slate-700/40 pt-4 text-center">
                    <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-green-500">
                      <span className="block text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                        {importResult.summary.inserted}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Inserted</span>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-blue-500">
                      <span className="block text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                        {importResult.summary.updated}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Updated</span>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-amber-500">
                      <span className="block text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                        {importResult.summary.skipped}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Skipped</span>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border-b-2 border-b-slate-400">
                      <span className="block text-2xl font-bold font-mono text-slate-600 dark:text-slate-400">
                        {importResult.summary.elapsedTime}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Duration</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={clear}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {language === "en" ? "Start New Import" : "นำเข้าไฟล์ใหม่"}
                  </button>
                  {importResult.success && selectedModule === "unit" && (
                    <button
                      onClick={handleViewUnits}
                      className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-xs font-bold transition shadow-md shadow-[#D4AF37]/10"
                    >
                      {language === "en" ? "View Units" : "ดูยูนิต"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Target Property Card */}
            {!importResult && selectedModule === "unit" && selectedPropertyId && (
              <div className="bg-gradient-to-r from-[#D4AF37]/10 via-[#D4AF37]/5 to-transparent border border-[#D4AF37]/25 rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-lg font-bold">🏢</div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                    {language === "en" ? "Target Property" : "โครงการเป้าหมาย"}
                  </span>
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{propertyLabel}</h4>
                </div>
              </div>
            )}

            {/* Overall Status Banner */}
            {!importResult && (
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
                      ? (language === "en" ? "Ready to import." : "พร้อมนำเข้าข้อมูล")
                      : (language === "en" ? "Validation Errors Detected" : "พบข้อผิดพลาดด้านข้อมูลในบางแถว")}
                  </h4>
                  <p className="text-xs opacity-90">
                    {rowValidation.summary.importReady
                      ? (language === "en"
                          ? `All ${rowValidation.summary.totalRows} rows passed validation. No errors detected.`
                          : `ข้อมูลทั้ง ${rowValidation.summary.totalRows} แถวผ่านการตรวจสอบ ไม่พบข้อผิดพลาด`)
                      : (language === "en"
                          ? "Please correct the data rows with errors shown below before you can proceed. Warnings do not block import."
                          : "กรุณาแก้ไขแถวข้อมูลที่มี Error ก่อนนำข้อมูลเข้าระบบ คำเตือน (Warning) ไม่กีดขวางการนำเข้า")}
                  </p>
                </div>
              </div>
            )}

            {/* Validation Dashboard Statistics */}
            {!importResult && (
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
            )}

            {/* Grouped Validation Logs */}
            {!importResult && rowValidation.allErrors.length > 0 && (() => {
              const errorItems = rowValidation.allErrors.filter(e => e.severity === "error");
              const warningItems = rowValidation.allErrors.filter(e => e.severity === "warning");
              const passedCount = rowValidation.summary.validRows;
              return (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {language === "en" ? "Validation Results" : "ผลการตรวจสอบข้อมูล"}
                  </h3>

                  {/* ✓ Passed */}
                  {passedCount > 0 && (
                    <div className="border border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-950/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-500 font-bold text-base">✓</span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">
                          {language === "en" ? "Passed" : "ผ่าน"} — {passedCount} {language === "en" ? "rows" : "แถว"}
                        </span>
                      </div>
                      <p className="text-xs text-green-600/80 dark:text-green-400/70 ml-6">
                        {language === "en" ? "These rows are valid and ready to import." : "แถวเหล่านี้ถูกต้องและพร้อมนำเข้า"}
                      </p>
                    </div>
                  )}

                  {/* ⚠ Warnings */}
                  {warningItems.length > 0 && (
                    <div className="border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold text-base">⚠</span>
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                          {language === "en" ? "Warnings" : "คำเตือน"} — {warningItems.length}
                        </span>
                        <span className="ml-auto text-[10px] uppercase font-bold tracking-wide text-amber-500/60 dark:text-amber-400/50">
                          {language === "en" ? "Does not block import" : "ไม่กีดขวางการนำเข้า"}
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-amber-100 dark:border-amber-900/20 rounded-lg divide-y divide-amber-100 dark:divide-amber-900/20 text-xs">
                        {warningItems.map((err, i) => (
                          <div key={i} className="p-3 flex items-start gap-3">
                            <span className="px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 shrink-0 mt-0.5">⚠</span>
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                Row {err.rowNumber}, Column &quot;{err.column}&quot;
                              </span>
                              <p className="text-slate-500 dark:text-slate-400">{err.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ✗ Errors */}
                  {errorItems.length > 0 && (
                    <div className="border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/10 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 font-bold text-base">✗</span>
                        <span className="text-sm font-bold text-red-700 dark:text-red-400">
                          {language === "en" ? "Errors" : "ข้อผิดพลาด"} — {errorItems.length}
                        </span>
                        <span className="ml-auto text-[10px] uppercase font-bold tracking-wide text-red-500/60 dark:text-red-400/50">
                          {language === "en" ? "Blocks import" : "กีดขวางการนำเข้า"}
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-red-100 dark:border-red-900/20 rounded-lg divide-y divide-red-100 dark:divide-red-900/20 text-xs">
                        {errorItems.map((err, i) => (
                          <div key={i} className="p-3 flex items-start gap-3">
                            <span className="px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 shrink-0 mt-0.5">✗</span>
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                Row {err.rowNumber}, Column &quot;{err.column}&quot;
                              </span>
                              <p className="text-slate-500 dark:text-slate-400">{err.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Wizard Navigation Footer */}
            {!importResult && (
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700/60">
                <button
                  disabled={isImporting}
                  onClick={() => setStep(3)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition disabled:opacity-40"
                >
                  {language === "en" ? "Back" : "ย้อนกลับ"}
                </button>

                <button
                  disabled={!rowValidation.summary.importReady || isImporting}
                  onClick={commitImport}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition shadow-md shadow-green-600/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {importProgress || (language === "en" ? "Importing Data..." : "กำลังนำเข้าข้อมูล...")}
                    </>
                  ) : (
                    language === "en" ? "Proceed Import" : "เริ่มนำเข้าฐานข้อมูล"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
