"use client";

import React, { useState, useRef, useEffect } from "react";
import { formatDate } from "@/shared/utils";

interface LocalizedDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (val: string) => void;
  required?: boolean;
  locale: "th" | "en";
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function LocalizedDatePicker({
  value,
  onChange,
  locale,
  label,
  className = "",
  disabled = false
}: LocalizedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const initialDate = value ? new Date(`${value}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update view month/year if value changes externally (State adjustment during render)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const d = new Date(`${value}T12:00:00`);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }

  const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthsTh = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    onChange(`${viewYear}-${formattedMonth}-${formattedDay}`);
    setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
    let newMonth = viewMonth + offset;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  // Generate calendar days
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  // Value formatting for display: convert to Thai Buddhist Era if locale is th
  const getDisplayValue = () => {
    if (!value) return "";
    return formatDate(value, locale);
  };

  const currentYearDisplay = locale === "th" ? viewYear + 543 : viewYear;
  const currentMonthLabel = locale === "th" ? monthsTh[viewMonth] : monthsEn[viewMonth];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {label && (
        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{label}</label>
      )}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none font-bold flex justify-between items-center ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
            : "cursor-pointer text-slate-800 dark:text-slate-200"
        }`}
      >
        <span>{getDisplayValue() || (locale === "th" ? "เลือกวันที่..." : "Select date...")}</span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1 z-55 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
            >
              &lt;
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {currentMonthLabel} {currentYearDisplay}
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
            >
              &gt;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 mb-1">
            {locale === "th"
              ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => <div key={d}>{d}</div>)
              : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d}>{d}</div>)
            }
          </div>

          <div className="grid grid-cols-7 gap-1">
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }
              const isSelected = value && new Date(`${value}T12:00:00`).getDate() === day &&
                new Date(`${value}T12:00:00`).getMonth() === viewMonth &&
                new Date(`${value}T12:00:00`).getFullYear() === viewYear;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`p-1 text-xs rounded transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface LocalizedDateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:MM:SS" or similar
  onChange: (val: string) => void;
  required?: boolean;
  locale: "th" | "en";
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function LocalizedDateTimePicker({
  value,
  onChange,
  required = false,
  locale,
  label,
  className = "",
  disabled = false
}: LocalizedDateTimePickerProps) {
  // Split input value into date and time parts
  let datePart = "";
  let timePart = "12:00";

  if (value) {
    const cleanVal = value.replace("Z", "");
    const parts = cleanVal.split(/[T ]/);
    if (parts[0]) datePart = parts[0];
    if (parts[1]) timePart = parts[1].slice(0, 5); // limit to HH:MM
  }

  const handleDateChange = (newDate: string) => {
    if (newDate) {
      onChange(`${newDate}T${timePart}:00`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    if (datePart) {
      onChange(`${datePart}T${newTime}:00`);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-[10px] font-bold text-slate-500 uppercase block">{label}</label>
      )}
      <div className="flex gap-2 items-center">
        <LocalizedDatePicker
          value={datePart}
          onChange={handleDateChange}
          required={required}
          locale={locale}
          disabled={disabled}
          className="flex-1"
        />
        <input
          type="time"
          value={timePart}
          required={required}
          disabled={disabled}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-900 outline-none font-bold text-slate-800 dark:text-slate-200 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
