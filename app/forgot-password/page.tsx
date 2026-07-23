"use client";

import React from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-[100%] h-[100%] bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[100%] h-[100%] bg-gradient-to-t from-[#0F172A]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#0F172A] shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Request PIN Reset</h2>
          <div className="h-1 w-12 bg-[#D4AF37] mx-auto rounded-full mb-4" />
          <p className="text-sm text-slate-600 dark:text-slate-450 leading-relaxed">
            Password recovery and account activation have been migrated to the new <strong>Temporary PIN Activation</strong> framework.
          </p>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 mb-6 text-center">
          <p className="text-xs text-amber-600 dark:text-amber-450 font-medium leading-relaxed">
            Please contact your property management office or administrator to request a PIN Reset. 
            Once generated, you will receive a new 6-digit Temporary PIN to reactivate your account and set a new password.
          </p>
        </div>

        <div className="text-center">
          <Link href="/login" className="text-xs font-semibold text-[#D4AF37] hover:underline transition">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
