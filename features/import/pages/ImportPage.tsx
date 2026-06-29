"use client";

import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useImport } from "../hooks/useImport";
import UploadZone from "../components/UploadZone";
import { useLanguage } from "@/providers/LanguageProvider";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function ImportPage() {
  const { t } = useLanguage();
  const {
    file,
    step,
    setStep,
    error,
    setError,
    isValidating,
    validationResult,
    handleFileSelect,
    runFileValidation,
    clear,
  } = useImport();

  const steps = [
    { id: 1, label: t.import.stepUpload },
    { id: 2, label: t.import.stepValidate },
    { id: 3, label: t.import.stepPreview },
    { id: 4, label: t.import.stepImport },
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

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.import.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.import.description}</p>
        </div>

        {/* Stepper Wizard Header */}
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700/80 -translate-y-1/2 z-0" />
          <div className="relative z-10 flex justify-between">
            {steps.map((s) => {
              const isActive = step === s.id;
              const isPast = step > s.id;
              const isDisabled = s.id > 2;

              return (
                <div key={s.id} className="flex flex-col items-center space-y-2 bg-slate-50 dark:bg-slate-900 px-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition duration-200 ${
                      isActive
                        ? "border-[#D4AF37] bg-white dark:bg-slate-800 text-[#D4AF37] shadow-md shadow-[#D4AF37]/10"
                        : isPast
                        ? "border-[#D4AF37] bg-[#D4AF37] text-white"
                        : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400"
                    } ${isDisabled ? "opacity-60" : ""}`}
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
                    } ${isDisabled ? "opacity-60" : ""}`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 rounded-xl text-sm animate-fade-in">
            {error === "invalidFileType" ? t.import.invalidFileType : t.import.validationErrorMsg}
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
                    {t.import.replaceFile}
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={runFileValidation}
                    disabled={isValidating}
                    className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-50"
                  >
                    {isValidating ? t.common.processing : t.import.validateButton}
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
              <span className="text-[#D4AF37] font-semibold">{t.import.stepValidate}</span>
            </div>

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
                    ? t.import.validationSuccessMsg
                    : validationResult.overallStatus === "warning"
                    ? t.import.validationWarningMsg
                    : t.import.validationErrorMsg}
                </p>
              </div>
            </div>

            {/* Checklist items */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 shadow-sm space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t.import.validationTitle}
              </h3>

              <div className="space-y-5">
                {/* Check 1: Open file */}
                <div className="flex items-start gap-4 text-sm">
                  <div className="mt-0.5">{getStatusIcon(validationResult.checks.fileOpen.status)}</div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{t.import.checkFileOpen}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{validationResult.checks.fileOpen.message}</p>
                    {validationResult.checks.fileOpen.details && (
                      <ul className="text-xs text-red-500 list-disc list-inside mt-1 space-y-0.5">
                        {validationResult.checks.fileOpen.details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Check 2: Sheet check */}
                <div className="flex items-start gap-4 text-sm border-t border-slate-100 dark:border-slate-700/50 pt-4">
                  <div className="mt-0.5">{getStatusIcon(validationResult.checks.sheetExists.status)}</div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{t.import.checkSheetExists}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {validationResult.checks.sheetExists.status === "error"
                        ? t.import.missingSheet.replace(
                            "{sheets}",
                            validationResult.sheetNames.join(", ") || "none"
                          )
                        : validationResult.checks.sheetExists.message}
                    </p>
                  </div>
                </div>

                {/* Check 3: Column check */}
                <div className="flex items-start gap-4 text-sm border-t border-slate-100 dark:border-slate-700/50 pt-4">
                  <div className="mt-0.5">{getStatusIcon(validationResult.checks.columnsExist.status)}</div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{t.import.checkColumnsExist}</h4>
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
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold transition"
              >
                Back
              </button>
              <button
                disabled={!validationResult.isValid}
                onClick={() => alert("Preview & Column Mapping step is out of scope for WO-0001")}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-xl text-sm font-semibold transition shadow-md shadow-[#D4AF37]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.import.continueButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
