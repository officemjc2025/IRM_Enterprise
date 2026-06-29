"use client";

import React, { useRef, useState } from "react";
import { useLanguage } from "@/providers/LanguageProvider";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
  onError: (error: string) => void;
}

export default function UploadZone({ onFileSelected, loading, onError }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const { t } = useLanguage();

  const processFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "xls") {
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
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleChange}
        disabled={loading}
      />
      <div className="flex flex-col items-center justify-center space-y-3">
        <span className="text-4xl text-slate-400">📊</span>
        <div className="text-sm text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-[#D4AF37]">{t.import.uploadAreaTitle.split("or")[0]}</span>
          {t.import.uploadAreaTitle.includes("or") ? "or " + t.import.uploadAreaTitle.split("or")[1] : ""}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {t.import.uploadAreaSubtitle}
        </div>
      </div>
    </div>
  );
}
