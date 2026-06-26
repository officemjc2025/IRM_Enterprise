"use client";

import { useLanguage } from "../../providers/LanguageProvider";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
      <button
        onClick={() => setLanguage("th")}
        className={`rounded px-3 py-1 text-sm transition ${
          language === "th"
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        🇹🇭 ไทย
      </button>

      <button
        onClick={() => setLanguage("en")}
        className={`rounded px-3 py-1 text-sm transition ${
          language === "en"
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        🇺🇸 EN
      </button>
    </div>
  );
}