import React from "react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}

export default function PageHeader({ title, actionHref, actionLabel }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">{title}</h2>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="px-4 py-2 bg-[#D4AF37] hover:bg-[#b8952b] text-white rounded-lg text-sm font-medium transition"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
