"use client";

export default function UserMenu() {
  return (
    <button className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E3A8A] text-sm font-semibold text-white">
        MA
      </div>

      <div className="hidden text-left lg:block">
        <p className="text-sm font-medium text-slate-800 dark:text-white">
          Metro Admin
        </p>
        <p className="text-xs text-slate-500">
          Administrator
        </p>
      </div>

      <svg
        className="h-4 w-4 text-slate-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}