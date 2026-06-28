"use client";

import React, { useState } from "react";
import { useLanguage } from "../../../providers/LanguageProvider";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth/auth.service";

export default function LoginForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (loading) return;

  setLoading(true);

  try {
    const { error } = await authService.signIn(email, password);

    if (error) {
      console.error(error.message);
      return;
    }

    router.replace("/");
  } catch (err) {
    console.error("Unexpected login error:", err);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-[#0F172A] shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Header Section */}
        <div className="p-8 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-[#D4AF37]/20">
            {/* IRM Logo Placeholder */}
            <span className="text-2xl font-bold text-white">IRM</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {t.auth?.welcomeBack || "Welcome Back"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.auth?.loginToAccount || "Please log in to your account"}
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8 pt-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t.auth?.email || "Email"}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                placeholder="admin@irmenterprise.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  {t.auth?.password || "Password"}
                </label>
                <button
    type="button"
  className="text-sm font-medium text-[#D4AF37] hover:text-[#b8952b] transition-colors"
>
                  {t.auth?.forgotPassword || "Forgot Password?"}
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#D4AF37] bg-slate-50 border-slate-300 rounded focus:ring-[#D4AF37] dark:focus:ring-[#D4AF37] dark:ring-offset-slate-900 focus:ring-2 dark:bg-slate-800 dark:border-slate-600"
              />
              <label
                htmlFor="rememberMe"
                className="ml-2 text-sm text-slate-600 dark:text-slate-400"
              >
                {t.auth?.rememberMe || "Remember Me"}
              </label>
            </div>

            <button
    type="submit"
    disabled={loading}
    aria-busy={loading}
              className="w-full py-3 px-4 bg-[#D4AF37] hover:bg-[#b8952b] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all active:scale-[0.98]"
            >
             {loading
    ? "Signing In..."
    : (t.auth?.signIn || "Sign In")}
            </button>
          </form>
        </div>
      </div>

      {/* Language Switcher Footer */}
      <div className="mt-8 flex justify-center text-sm">
        <LanguageSwitcher />
      </div>
    </div>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  
  return (
    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
      <span className="text-xs uppercase tracking-wider">{t.common?.language || "Language"}</span>
      <div className="flex gap-2">
        <button
          onClick={() => setLanguage("en")}
          className={`px-2 py-1 rounded transition-colors ${
            language === "en" ? "text-slate-900 dark:text-white font-medium" : "hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          EN
        </button>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <button
          onClick={() => setLanguage("th")}
          className={`px-2 py-1 rounded transition-colors ${
            language === "th" ? "text-slate-900 dark:text-white font-medium" : "hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          TH
        </button>
      </div>
    </div>
  );
}
