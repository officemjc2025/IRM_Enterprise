"use client";

import React, { useRef, useState } from "react";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
}

export default function UploadZone({ onFileSelected, loading }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const processFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "csv") {
      onFileSelected(file);
    } else {
      alert("Invalid file type. Please upload a .xlsx or .csv file.");
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
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-[#D4AF37] bg-[#D4AF37]/5"
          : "border-slate-200 dark:border-slate-700 hover:border-[#D4AF37]"
      }`}
      onClick={() => !loading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={handleChange}
        disabled={loading}
      />
      <div className="flex flex-col items-center justify-center space-y-3">
        <span className="text-4xl text-slate-400">📁</span>
        <div className="text-sm">
          <span className="font-semibold text-[#D4AF37]">Click to upload</span> or drag and drop
        </div>
        <div className="text-xs text-slate-400">Excel (.xlsx) or CSV files only</div>
      </div>
    </div>
  );
}
