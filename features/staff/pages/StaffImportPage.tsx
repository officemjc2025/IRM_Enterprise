"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { PageHeader, LoadingState } from "@/shared/ui";
import * as XLSX from "xlsx";
import { importService } from "@/services/import/import.service";
import { getSchema } from "@/features/import/schemas";
import { CanonicalField, ValidationError, ColumnMapping } from "@/features/import/types/import.types";
import { FiUpload, FiDownload, FiCheckCircle, FiAlertCircle, FiXCircle, FiPlay, FiTrash2, FiEdit2, FiX } from "react-icons/fi";

interface ImportHistoryBatch {
  id: string;
  batch_name: string;
  status: string;
  summary: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  created_at: string;
}

interface StaffImportRow extends Record<string, unknown> {
  employee_code?: string;
  prefix?: string | null;
  first_name?: string;
  last_name?: string;
  nickname?: string | null;
  display_name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  department?: string | null;
  team?: string | null;
  property_code?: string;
  property_id?: string | null;
  language?: string | null;
  account_status?: string | null;
  send_invitation?: string | null;
  active?: string;
  photo_url?: string | null;
  action?: string;
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
}

interface ImportResult {
  success: boolean;
  message: string;
  summary?: {
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
    elapsedTime: string;
  };
}

function StaffImportPageInner() {
  const currentSchema = getSchema("staff");

  // Wizard Steps: 1: Upload, 2: Column Map, 3: Review & Edit, 4: History & Status
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  
  // Review & Validation States
  const [reviewRows, setReviewRows] = useState<StaffImportRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<number, ValidationError[]>>({});
  const [rowConflicts, setRowConflicts] = useState<Record<number, string[]>>({});
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary>({
    totalRows: 0,
    validRows: 0,
    warningRows: 0,
    errorRows: 0
  });

  // Settings
  const [importMode, setImportMode] = useState<"create_only" | "update_only" | "upsert">("upsert");
  const [postImportAction, setPostImportAction] = useState<"send_invitation" | "activate" | "skip">("send_invitation");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Bulk Edit and Single Edit states
  const [selectedRowIndices, setSelectedRowIndices] = useState<number[]>([]);
  const [bulkRole, setBulkRole] = useState("");
  const [bulkDept, setBulkDept] = useState("");
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<StaffImportRow | null>(null);

  // History List
  const [historyList, setHistoryList] = useState<ImportHistoryBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load Import History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/v1/import/history?moduleName=staff");
      const json = await res.json();
      if (json.success) {
        setHistoryList(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load import history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchHistory();
    });
  }, [fetchHistory]);

  // Download excel template
  const handleDownloadTemplate = () => {
    const columns = [
      "employee_code", "prefix", "first_name", "last_name", "nickname", "display_name", 
      "email", "phone", "role", "department", "team", "property_code", "language", "account_status", "send_invitation", "photo_url"
    ];
    const sample = [
      {
        employee_code: "PAD001",
        prefix: "Mr.",
        first_name: "Somchai",
        last_name: "Jaidee",
        nickname: "Chai",
        display_name: "Somchai Jaidee",
        email: "somchai.j@example.com",
        phone: "0812345678",
        role: "property_admin",
        department: "Office",
        team: "Lobby",
        property_code: "PROP001",
        language: "th",
        account_status: "ACTIVE",
        send_invitation: "TRUE",
        photo_url: ""
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sample, { header: columns });

    const rolesData = [
      { "Supported Roles": "super_admin" },
      { "Supported Roles": "admin" },
      { "Supported Roles": "property_admin" },
      { "Supported Roles": "office" },
      { "Supported Roles": "security" },
      { "Supported Roles": "technician" },
      { "Supported Roles": "housekeeping" },
      { "Supported Roles": "committee" }
    ];

    const deptsData = [
      { "Supported Departments": "Administration" },
      { "Supported Departments": "Office" },
      { "Supported Departments": "Engineering" },
      { "Supported Departments": "Housekeeping" },
      { "Supported Departments": "Security" },
      { "Supported Departments": "Committee" }
    ];

    const wsRoles = XLSX.utils.json_to_sheet(rolesData);
    const wsDepts = XLSX.utils.json_to_sheet(deptsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Import Template");
    XLSX.utils.book_append_sheet(wb, wsRoles, "Supported Roles List");
    XLSX.utils.book_append_sheet(wb, wsDepts, "Supported Departments List");
    XLSX.writeFile(wb, "Staff_Import_Template_v1.xlsx");
  };

  // Upload Excel handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selectedFile = files[0];
    setFile(selectedFile);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const sheetArrays = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: "",
        });
        
        const rawHeaders = (sheetArrays[0] || []).map((h) => String(h).trim()).filter((h) => h !== "");
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

        setHeaders(rawHeaders);
        setRawRows(rows);

        // Auto map columns
        const mapping = importService.autoMap(rawHeaders, currentSchema);
        setColumnMapping(mapping);
        setStep(2);
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch {
      alert("Error reading file");
    }
  };

  // Run backend validation on preview
  const runValidation = useCallback(async (rowsData: StaffImportRow[]) => {
    setIsRevalidating(true);
    try {
      const res = await fetch("/api/v1/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsData,
          mapping: columnMapping,
          moduleName: "staff"
        })
      });
      const json = await res.json();
      if (json.success) {
        // Map back error arrays mapped by rowNumber (2-indexed)
        const errorMap: Record<number, ValidationError[]> = {};
        const conflictMap: Record<number, string[]> = {};
        json.results.forEach((r: { rowNumber: number; errors: ValidationError[]; conflicts?: string[] }) => {
          errorMap[r.rowNumber] = r.errors || [];
          conflictMap[r.rowNumber] = r.conflicts || [];
        });
        setRowErrors(errorMap);
        setRowConflicts(conflictMap);
        setValidationSummary(json.summary);
        
        // Update Action parameter in reviewRows based on validation results
        const updatedRows = rowsData.map((r, idx) => {
          const matchedResult = json.results.find((resItem: { rowNumber: number }) => resItem.rowNumber === (idx + 2));
          return {
            ...r,
            action: matchedResult?.normalizedData?.action || "CREATE",
            property_id: matchedResult?.normalizedData?.property_id || null
          };
        });
        setReviewRows(updatedRows);
      }
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setIsRevalidating(false);
    }
  }, [columnMapping]);

  // Handle proceed from column mapping to preview
  const handleProceedToPreview = async () => {
    // Generate normalized data array from rawRows using mapping
    const normalizedList = rawRows.map((rawRow) => {
      const norm: StaffImportRow = {};
      Object.entries(columnMapping).forEach(([header, field]) => {
        if (field) {
          norm[field] = rawRow[header] !== undefined && rawRow[header] !== null ? String(rawRow[header]).trim() : "";
        }
      });
      return norm;
    });

    setReviewRows(normalizedList);
    setStep(3);
    runValidation(normalizedList);
  };

  // Inline cell editor
  const handleCellChange = (rowIndex: number, field: string, val: string) => {
    const updated = [...reviewRows];
    updated[rowIndex] = { ...updated[rowIndex], [field]: val };
    setReviewRows(updated);
    
    // Auto-revalidate with debounce / immediate trigger
    runValidation(updated);
  };

  // Bulk set values for selected rows
  const handleBulkEdit = () => {
    if (selectedRowIndices.length === 0) return;
    const updated = [...reviewRows];
    selectedRowIndices.forEach((idx) => {
      if (bulkRole) updated[idx].role = bulkRole;
      if (bulkDept) updated[idx].department = bulkDept;
    });
    setReviewRows(updated);
    setSelectedRowIndices([]);
    setBulkRole("");
    setBulkDept("");
    runValidation(updated);
  };

  // Open single edit drawer
  const handleOpenEditDrawer = (rowIndex: number) => {
    setEditingRowIndex(rowIndex);
    setEditingRowData({ ...reviewRows[rowIndex] });
  };

  // Save single edit from drawer
  const handleSaveDrawerEdit = () => {
    if (editingRowIndex === null || !editingRowData) return;
    const updated = [...reviewRows];
    updated[editingRowIndex] = editingRowData;
    setReviewRows(updated);
    setEditingRowIndex(null);
    setEditingRowData(null);
    runValidation(updated);
  };

  // Download validation errors only
  const handleDownloadErrors = () => {
    const errorsOnly = reviewRows.filter((_, idx) => {
      const errors = rowErrors[idx + 2] || [];
      return errors.some(e => e.severity === "error");
    });
    
    if (errorsOnly.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(errorsOnly);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "Import_Errors.xlsx");
  };

  // Commit Import
  const handleCommitImport = async (strategy: "dry_run" | "commit") => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/v1/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: reviewRows,
          moduleName: "staff",
          importStrategy: strategy,
          importMode,
          postImportAction
        })
      });
      const json = await res.json();
      setImportResult(json);
      if (json.success) {
        if (strategy === "commit") {
          setStep(4);
        }
      }
      fetchHistory();
    } catch (err: unknown) {
      setImportResult({
        success: false,
        message: err instanceof Error ? err.message : "Unexpected commit failure"
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Rollback batch
  const handleRollbackBatch = async (batchId: string) => {
    if (!confirm("Are you sure you want to rollback this import batch? All imported profiles and users will be deleted!")) {
      return;
    }
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/v1/import/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId })
      });
      const json = await res.json();
      alert(json.message);
      fetchHistory();
    } catch {
      alert("Rollback failed.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30";
      case "UPDATE": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";
      case "ERROR": return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30";
      default: return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-900/30";
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader title="Bulk Staff Import" />

        {/* Steps Breadcrumbs */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-xs font-semibold text-slate-400 overflow-x-auto">
          <span className={`${step >= 1 ? "text-indigo-600 dark:text-indigo-400" : ""}`}>1. Upload File</span>
          <span className="text-slate-350">➔</span>
          <span className={`${step >= 2 ? "text-indigo-600 dark:text-indigo-400" : ""}`}>2. Column Mapping</span>
          <span className="text-slate-350">➔</span>
          <span className={`${step >= 3 ? "text-indigo-600 dark:text-indigo-400" : ""}`}>3. Review & Validate</span>
          <span className="text-slate-350">➔</span>
          <span className={`${step >= 4 ? "text-indigo-600 dark:text-indigo-400" : ""}`}>4. Commit & History</span>
        </div>

        {/* Step 1: Upload File */}
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-8 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-2xl font-bold">
                <FiUpload />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100">Upload Staff Directory Spreadsheet</h3>
                <p className="text-xs text-slate-400 mt-1">Supports Excel (.xlsx, .xls) and CSV files up to 10MB</p>
              </div>
              <label className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer">
                <span>Browse Files</span>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-850 dark:text-slate-100 uppercase tracking-wider text-slate-400">Import Template</h3>
                <p className="text-xs text-slate-500">Download the preformatted template file with standard column mapping for staff data.</p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FiDownload />
                <span>Download Template</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100">Map File Headers to System Fields</h3>
                <p className="text-xs text-slate-400 mt-1">Review matches between Excel column headers and canonical Staff attributes.</p>
              </div>
              {file && (
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-mono font-semibold">
                  File: {file.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {headers.map((header) => (
                <div key={header} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{header}</span>
                  <div className="flex items-center gap-2">
                    <span>➔</span>
                    <select
                      value={columnMapping[header] || ""}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value as CanonicalField })}
                      className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="">-- Ignored / Not Mapped --</option>
                      <option value="employee_code">Employee Code (Optional)</option>
                      <option value="first_name">First Name (Required)</option>
                      <option value="last_name">Last Name (Required)</option>
                      <option value="display_name">Display Name (Optional)</option>
                      <option value="email">Email Address (Required)</option>
                      <option value="phone">Phone Number (Optional)</option>
                      <option value="role">System Role (Required)</option>
                      <option value="department">Department (Optional)</option>
                      <option value="property_code">Property Code (Optional)</option>
                      <option value="active">Active (Optional, True/False)</option>
                      <option value="photo_url">Photo URL (Optional)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleProceedToPreview}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Proceed to Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Edit Spreadsheet Grid */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Validation Counts Summary Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400">Total Rows</p>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{validationSummary.totalRows}</h3>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400">Valid Rows</p>
                <h3 className="text-lg font-bold text-green-600 mt-1">{validationSummary.validRows}</h3>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400">Warning Rows</p>
                <h3 className="text-lg font-bold text-amber-600 mt-1">{validationSummary.warningRows}</h3>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400">Error Rows</p>
                <div className="flex items-center justify-between mt-1">
                  <h3 className="text-lg font-bold text-rose-600">{validationSummary.errorRows}</h3>
                  {isRevalidating && (
                    <span className="text-[10px] text-indigo-500 font-semibold animate-pulse">Re-validating...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Edit Actions Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-500">Bulk Edit ({selectedRowIndices.length} selected):</span>
                <select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                >
                  <option value="">Set Role...</option>
                  <option value="admin">Admin</option>
                  <option value="property_admin">Property Admin</option>
                  <option value="office">Office Staff</option>
                  <option value="security">Security</option>
                  <option value="technician">Technician</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="committee">Committee</option>
                </select>

                <input
                  type="text"
                  placeholder="Set Department..."
                  value={bulkDept}
                  onChange={(e) => setBulkDept(e.target.value)}
                  className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                />

                <button
                  onClick={handleBulkEdit}
                  disabled={selectedRowIndices.length === 0}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {validationSummary.errorRows > 0 && (
                <button
                  onClick={handleDownloadErrors}
                  className="px-3 py-1.5 border border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FiAlertCircle />
                  <span>Download Error Rows</span>
                </button>
              )}
            </div>

            {/* Spreadsheet table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50/90 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 z-10">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRowIndices(reviewRows.map((_, i) => i));
                            } else {
                              setSelectedRowIndices([]);
                            }
                          }}
                          checked={selectedRowIndices.length === reviewRows.length && reviewRows.length > 0}
                          className="rounded border-slate-330 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3 w-14">Row</th>
                      <th className="p-3 w-28">Action</th>
                      <th className="p-3">Employee Code</th>
                      <th className="p-3">First Name</th>
                      <th className="p-3">Last Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Department</th>
                      <th className="p-3 w-20 text-center">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
                    {reviewRows.map((row, index) => {
                      const rowNumber = index + 2;
                      const errors = rowErrors[rowNumber] || [];
                      const conflicts = rowConflicts[rowNumber] || [];
                      const hasRowErrors = errors.some(e => e.severity === "error") || conflicts.length > 0;
                      const isSelected = selectedRowIndices.includes(index);

                      return (
                        <tr
                          key={index}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition ${
                            hasRowErrors ? "bg-rose-50/10 dark:bg-rose-950/5" : ""
                          } ${isSelected ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""}`}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRowIndices([...selectedRowIndices, index]);
                                } else {
                                  setSelectedRowIndices(selectedRowIndices.filter(i => i !== index));
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-semibold text-slate-400">{rowNumber}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold ${getActionBadgeColor(row.action || "CREATE")}`}>
                              {row.action || "CREATE"}
                            </span>
                            {conflicts.map((c, i) => (
                              <div key={i} className="text-[9px] text-rose-500 font-semibold mt-1 leading-tight max-w-[150px] whitespace-normal">
                                {c}
                              </div>
                            ))}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.employee_code || ""}
                              placeholder="Auto Generated"
                              onChange={(e) => handleCellChange(index, "employee_code", e.target.value)}
                              className="w-full p-1 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white dark:focus:bg-slate-950 outline-none font-mono"
                            />
                            {errors.filter(e => e.column === "employee_code").map((e, idx) => (
                              <div key={idx} className="text-[9px] text-rose-500 font-semibold mt-0.5">{e.message}</div>
                            ))}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              required
                              value={row.first_name || ""}
                              onChange={(e) => handleCellChange(index, "first_name", e.target.value)}
                              className="w-full p-1 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white dark:focus:bg-slate-950 outline-none font-medium"
                            />
                            {errors.filter(e => e.column === "first_name").map((e, idx) => (
                              <div key={idx} className="text-[9px] text-rose-500 font-semibold mt-0.5">{e.message}</div>
                            ))}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              required
                              value={row.last_name || ""}
                              onChange={(e) => handleCellChange(index, "last_name", e.target.value)}
                              className="w-full p-1 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white dark:focus:bg-slate-950 outline-none font-medium"
                            />
                            {errors.filter(e => e.column === "last_name").map((e, idx) => (
                              <div key={idx} className="text-[9px] text-rose-500 font-semibold mt-0.5">{e.message}</div>
                            ))}
                          </td>
                          <td className="p-3">
                            <input
                              type="email"
                              required
                              value={row.email || ""}
                              onChange={(e) => handleCellChange(index, "email", e.target.value)}
                              className="w-full p-1 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white dark:focus:bg-slate-950 outline-none"
                            />
                            {errors.filter(e => e.column === "email").map((e, idx) => (
                              <div key={idx} className="text-[9px] text-rose-500 font-semibold mt-0.5">{e.message}</div>
                            ))}
                          </td>
                          <td className="p-3">
                            <select
                              value={row.role || ""}
                              onChange={(e) => handleCellChange(index, "role", e.target.value)}
                              className="w-full p-1 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white dark:focus:bg-slate-950 outline-none cursor-pointer font-medium"
                            >
                              <option value="admin">Admin</option>
                              <option value="property_admin">Property Admin</option>
                              <option value="office">Office Staff</option>
                              <option value="security">Security</option>
                              <option value="technician">Technician</option>
                              <option value="housekeeping">Housekeeping</option>
                              <option value="committee">Committee</option>
                            </select>
                            {errors.filter(e => e.column === "role").map((e, idx) => (
                              <div key={idx} className="text-[9px] text-rose-500 font-semibold mt-0.5">{e.message}</div>
                            ))}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.department || ""}
                              onChange={(e) => handleCellChange(index, "department", e.target.value)}
                              className="w-full p-1 border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white dark:focus:bg-slate-950 outline-none"
                            />
                            {errors.filter(e => e.column === "department").map((e, idx) => (
                              <div key={idx} className="text-[9px] text-rose-500 font-semibold mt-0.5">{e.message}</div>
                            ))}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleOpenEditDrawer(index)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            >
                              <FiEdit2 />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3 Footer - Import settings panel */}
            <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-850 p-5 rounded-3xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Import Strategy Mode</label>
                  <select
                    value={importMode}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setImportMode(e.target.value as "create_only" | "update_only" | "upsert")}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 outline-none cursor-pointer"
                  >
                    <option value="upsert">Upsert (Insert new + Update existing)</option>
                    <option value="create_only">Create Only (Ignore existing)</option>
                    <option value="update_only">Update Existing Only (Ignore new)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Post-Import Settings</label>
                  <select
                    value={postImportAction}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPostImportAction(e.target.value as "send_invitation" | "activate" | "skip")}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 outline-none cursor-pointer"
                  >
                    <option value="send_invitation">Send Invitation Emails (Standard)</option>
                    <option value="activate">Activate Accounts (Skip email, active now)</option>
                    <option value="skip">Create Accounts (Email verification pending)</option>
                  </select>
                </div>

              </div>

              {/* Commit Result Card */}
              {importResult && (
                <div className={`p-4 border rounded-2xl text-xs space-y-2 ${
                  importResult.success
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-400"
                    : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    {importResult.success ? <FiCheckCircle className="text-sm shrink-0" /> : <FiXCircle className="text-sm shrink-0" />}
                    <span>{importResult.message}</span>
                  </div>
                  {importResult.summary && (
                    <div className="grid grid-cols-4 gap-2 font-semibold text-[10px] uppercase text-slate-500 mt-2">
                      <div>Created: {importResult.summary.inserted}</div>
                      <div>Updated: {importResult.summary.updated}</div>
                      <div>Skipped: {importResult.summary.skipped}</div>
                      <div>Duration: {importResult.summary.elapsedTime}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Commit Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Back
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCommitImport("dry_run")}
                    disabled={isImporting || validationSummary.errorRows > 0}
                    className="px-5 py-2.5 border border-indigo-600 text-indigo-650 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-xl text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    {isImporting ? (
                      <span>Validating...</span>
                    ) : (
                      <>
                        <FiPlay />
                        <span>Validate Only (Dry Run)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCommitImport("commit")}
                    disabled={isImporting || validationSummary.errorRows > 0}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    {isImporting ? (
                      <span>Importing...</span>
                    ) : (
                      <>
                        <FiPlay />
                        <span>Commit Import</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Single Edit Drawer */}
        {editingRowIndex !== null && editingRowData && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditingRowIndex(null)} />
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col z-10">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Edit Row {editingRowIndex + 2}</h3>
                </div>
                <button
                  onClick={() => setEditingRowIndex(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={editingRowData.employee_code || ""}
                    onChange={(e) => setEditingRowData({ ...editingRowData, employee_code: e.target.value })}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={editingRowData.first_name || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, first_name: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={editingRowData.last_name || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, last_name: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingRowData.email || ""}
                    onChange={(e) => setEditingRowData({ ...editingRowData, email: e.target.value })}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingRowData.phone || ""}
                    onChange={(e) => setEditingRowData({ ...editingRowData, phone: e.target.value })}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Role</label>
                    <select
                      value={editingRowData.role || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, role: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none cursor-pointer"
                    >
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
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Department</label>
                    <input
                      type="text"
                      value={editingRowData.department || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, department: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Prefix</label>
                    <input
                      type="text"
                      placeholder="e.g. Mr., Ms."
                      value={editingRowData.prefix || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, prefix: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nickname</label>
                    <input
                      type="text"
                      value={editingRowData.nickname || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, nickname: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Team</label>
                    <input
                      type="text"
                      placeholder="e.g. Cleaning, Electrical"
                      value={editingRowData.team || ""}
                      onChange={(e) => setEditingRowData({ ...editingRowData, team: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Language</label>
                    <select
                      value={editingRowData.language || "th"}
                      onChange={(e) => setEditingRowData({ ...editingRowData, language: e.target.value })}
                      className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none cursor-pointer"
                    >
                      <option value="th">Thai (th)</option>
                      <option value="en">English (en)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Property Code</label>
                  <input
                    type="text"
                    value={editingRowData.property_code || ""}
                    onChange={(e) => setEditingRowData({ ...editingRowData, property_code: e.target.value })}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Photo URL</label>
                  <input
                    type="text"
                    value={editingRowData.photo_url || ""}
                    onChange={(e) => setEditingRowData({ ...editingRowData, photo_url: e.target.value })}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  type="button"
                  onClick={() => setEditingRowIndex(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDrawerEdit}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History List Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100">Import Batches History</h3>
            <p className="text-xs text-slate-400 mt-1">View past import batch summaries and perform rollback recovery.</p>
          </div>

          {loadingHistory ? (
            <LoadingState message="Loading import history..." />
          ) : historyList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No past import batches found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                    <th className="p-3">Batch Name</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Imported Counts</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {historyList.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition">
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{batch.batch_name}</td>
                      <td className="p-3 text-slate-400">{new Date(batch.created_at).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                          batch.status === "COMPLETED"
                            ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                            : batch.status === "ROLLED_BACK"
                            ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                        }`}>
                          {batch.status}
                        </span>
                      </td>
                      <td className="p-3 font-medium">
                        {batch.summary ? (
                          <span>
                            Created: {batch.summary.inserted} | Updated: {batch.summary.updated} | Skipped: {batch.summary.skipped}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {batch.status === "COMPLETED" && (
                          <button
                            onClick={() => handleRollbackBatch(batch.id)}
                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <FiTrash2 className="text-xs" />
                            <span>Rollback</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export function StaffImportPage() {
  return (
    <Suspense fallback={<MainLayout><div className="p-6 text-center text-slate-500">Loading import page...</div></MainLayout>}>
      <StaffImportPageInner />
    </Suspense>
  );
}
export default StaffImportPage;
