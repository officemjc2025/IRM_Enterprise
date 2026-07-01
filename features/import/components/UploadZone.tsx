"use client";

import React, { useRef, useState } from "react";
import { useLanguage } from "@/providers/LanguageProvider";
import { MAX_FILE_SIZE_MB } from "../hooks/useImport";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
  onError: (error: string) => void;
}

export default function UploadZone({ onFileSelected, loading, onError }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const { language } = useLanguage();

  const processFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "xls" || extension === "csv") {
      // Size check
      const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        onError("fileTooLarge");
        return;
      }
      onFileSelected(file);
    } else {
      onError("invalidFileType");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-[#D4AF37] bg-[#D4AF37]/5"
          : "border-slate-200 dark:border-slate-700/80 hover:border-[#D4AF37]"
      }`}
      onClick={() => !loading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
        disabled={loading}
      />
      <div className="flex flex-col items-center justify-center space-y-3">
        <span className="text-4xl text-slate-400">📊</span>
        <div className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-[#D4AF37]">
            {language === "en" ? "Drag & drop your file here " : "ลากและวางไฟล์ของคุณที่นี่ "}
          </span>
          {language === "en" ? "or click to browse" : "หรือคลิกเพื่อเลือกไฟล์"}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {language === "en" 
            ? `Supports Excel (.xlsx, .xls) and CSV (.csv) up to ${MAX_FILE_SIZE_MB}MB`
            : `รองรับไฟล์ Excel (.xlsx, .xls) และ CSV (.csv) ขนาดสูงสุดไม่เกิน ${MAX_FILE_SIZE_MB}MB`}
        </div>
      </div>
    </div>
  );
}
