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
  const [errorMessage, setErrorMessage] = useState("");

  // Force Password Change / Activation wizard state
  const [activationUser, setActivationUser] = useState<{ id: string; role: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState("");


  const handleRoleRedirect = (role: string) => {
    const r = role.toLowerCase();
    if (["super_admin", "admin", "property_admin", "office"].includes(r)) {
      router.replace("/registration-requests");
    } else if (["resident", "owner", "co_owner", "tenant", "committee"].includes(r)) {
      router.replace("/resident");
    } else if (r === "technician") {
      router.replace("/technician");
    } else if (r === "housekeeping") {
      router.replace("/housekeeping");
    } else if (r === "security") {
      router.replace("/security");
    } else {
      router.replace("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      // 1. Authenticate / Validate through custom login API
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.message || "Invalid email, employee code, or password.");
        setLoading(false);
        return;
      }

      // 2. Handle Temporary PIN Activation Flow
      if (json.mustActivate) {
        setActivationUser({
          id: json.userId,
          role: "resident", // default fallback, will be updated/resolved on password change
          email: json.email,
        });
        setLoading(false);
        return;
      }

      // 3. Complete browser sign-in to sync localStorage/cookies
      const { data, error } = await authService.signIn(json.profile.email, password);

      if (error || !data.user) {
        setErrorMessage(error?.message || "Authentication failed on local client.");
        setLoading(false);
        return;
      }

      // Enforce account status checks
      const accStatus = json.profile.account_status;
      if (accStatus === "LOCKED") {
        setErrorMessage("Your account has been locked. Please contact support.");
        setLoading(false);
        return;
      }
      if (accStatus === "DISABLED") {
        setErrorMessage("Your account has been disabled.");
        setLoading(false);
        return;
      }

      if (json.profile.force_password_change) {
        setActivationUser({
          id: json.profile.id,
          role: json.profile.role,
          email: json.profile.email,
        });
      } else {
        handleRoleRedirect(json.profile.role);
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      setErrorMessage("An unexpected error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activating || !activationUser) return;

    // Validations
    if (newPassword.length < 8) {
      setActivationError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setActivationError("Passwords do not match.");
      return;
    }
    if (!acceptTerms || !acceptPrivacy) {
      setActivationError("You must accept both the Terms and Privacy Policy to continue.");
      return;
    }

    try {
      setActivating(true);
      setActivationError("");

      // 1. Submit password change and accept terms to Activation Service
      const actRes = await fetch("/api/v1/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activationUser.id,
          newPassword,
          acceptTerms: true,
        }),
      });

      const actJson = await actRes.json();
      if (!actRes.ok || !actJson.success) {
        throw new Error(actJson.message || "Failed to activate account on the server.");
      }

      // 2. Perform standard client-side browser sign in with new password
      const { data, error: authError } = await authService.signIn(activationUser.email, newPassword);

      if (authError || !data.user) {
        throw new Error(authError?.message || "Failed to establish a local auth session.");
      }

      // Success: redirect by role
      handleRoleRedirect(actJson.profile?.role || activationUser.role);
    } catch (err: unknown) {
      console.error("Error during activation:", err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during activation.";
      setActivationError(msg);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-[#0F172A] shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Header Section */}
        <div className="p-8 pb-6 text-center">
          <div className="mx-auto w-16 h-16 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-[#D4AF37]/20">
            <span className="text-2xl font-bold text-white font-serif">IRM</span>
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
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold text-center">
                {errorMessage}
              </div>
            )}

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
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all text-sm"
                placeholder="email@example.com"
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
                  onClick={() => router.push("/forgot-password")}
                  className="text-xs font-medium text-[#D4AF37] hover:text-[#b8952b] transition-colors"
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
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all text-sm"
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
                className="ml-2 text-xs text-slate-600 dark:text-slate-400"
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
              {loading ? "Signing In..." : (t.auth?.signIn || "Sign In")}
            </button>
          </form>

          {/* Bilingual registration & forgot password links */}
          <div className="mt-6 space-y-4 text-center border-t border-slate-100 dark:border-slate-800 pt-6">
            <div>
              <button
                type="button"
                onClick={() => router.push("/forgot-password")}
                className="text-xs font-semibold text-[#D4AF37] hover:text-[#b8952b] transition-colors"
              >
                Forgot Password? / ลืมรหัสผ่าน?
              </button>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {"Don't have an account? "}
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="font-bold text-[#D4AF37] hover:text-[#b8952b] hover:underline transition-colors"
                >
                  Create Resident Account
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                ยังไม่มีบัญชี?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="font-bold text-[#D4AF37] hover:text-[#b8952b] hover:underline transition-colors"
                >
                  ลงทะเบียนผู้พักอาศัย
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Force Password Change Modal (Overlay) */}
      {activationUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" />

          <div className="relative bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-8 shadow-2xl space-y-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Complete Account Activation
              </h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                This is your first login. For security reasons, you must set a new password and accept our terms before entering.
              </p>
            </div>

            <form onSubmit={handleActivationSubmit} className="space-y-4">
              {activationError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-semibold text-center">
                  {activationError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-xs"
                />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 my-4" />

              <div className="space-y-3">
                <label className="flex items-start gap-2.5 text-xs text-slate-650 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                  />
                  <span>
                    I accept the{" "}
                    <a href="#" className="text-indigo-500 hover:underline">
                      Terms of Service
                    </a>
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-650 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                  />
                  <span>
                    I accept the{" "}
                    <a href="#" className="text-indigo-500 hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={activating}
                className="w-full mt-4 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/20 transition"
              >
                {activating ? "Activating..." : "Activate Account & Login"}
              </button>
            </form>
          </div>
        </div>
      )}

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
      <span className="text-[10px] uppercase tracking-wider">{t.common?.language || "Language"}</span>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setLanguage("en")}
          className={`px-2 py-0.5 rounded transition-colors ${
            language === "en" ? "text-slate-900 dark:text-white font-medium" : "hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          EN
        </button>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <button
          onClick={() => setLanguage("th")}
          className={`px-2 py-0.5 rounded transition-colors ${
            language === "th" ? "text-slate-900 dark:text-white font-medium" : "hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          TH
        </button>
      </div>
    </div>
  );
}
