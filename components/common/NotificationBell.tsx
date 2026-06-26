"use client";

type NotificationBellProps = {
  count?: number;
};

export default function NotificationBell({
  count = 0,
}: NotificationBellProps) {
  return (
    <button
      className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
      aria-label="Notifications"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 text-slate-600 dark:text-slate-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032
          2.032 0 0118 14.158V11a6.002
          6.002 0 00-4-5.659V5a2
          2 0 10-4 0v.341C7.67
          6.165 6 8.388 6 11v3.159
          c0 .538-.214 1.055-.595
          1.436L4 17h5m6 0v1a3
          3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}