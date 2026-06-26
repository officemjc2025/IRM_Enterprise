"use client";

export default function ThemeToggle() {
  return (
    <button
      className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
      aria-label="Toggle Theme"
    >
      🌙
    </button>
  );
}