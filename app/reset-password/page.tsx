"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  role?: string;
  force_password_change?: boolean;
  display_name?: string | null;
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingProfile, setPendingProfile] = useState<UserProfile | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function initSession() {
      try {
        // 1. Check if a session is already present
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setCheckingSession(false);
          return;
        }

        // 2. Parse URL parameters (both hash and query formats)
        const hash = window.location.hash;
        const query = window.location.search;
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.substring(1) : hash);
        const queryParams = new URLSearchParams(query);

        const code = queryParams.get("code") || hashParams.get("code");
        const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
          if (data.session) {
            // Wait for session verification
            const verify = await supabase.auth.getSession();
            if (!verify.data.session) {
              throw new Error("Failed to verify active session after authorization code exchange.");
            }
          }
        } else if (accessToken && refreshToken) {
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            throw setSessionError;
          }
          if (data.session) {
            // Wait for session verification
            const verify = await supabase.auth.getSession();
            if (!verify.data.session) {
              throw new Error("Failed to verify active session after access token recovery.");
            }
          }
        }
      } catch (err: unknown) {
        console.error("Auth session initialization error:", err);
        const errMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
        if (
          errMsg.toLowerCase().includes("expired") ||
          errMsg.toLowerCase().includes("invalid grant") ||
          errMsg.toLowerCase().includes("token") ||
          errMsg.toLowerCase().includes("pkce")
        ) {
          setError("Invitation expired. Request a new invitation.");
        } else {
          setError(errMsg);
        }
      } finally {
        setCheckingSession(false);
      }
    }

    initSession();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      // 4. Verify session exists
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active recovery session found. Please request a new invitation link.");
      }

      // 5. Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // Fetch user profile to check if terms need to be accepted
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Failed to fetch user after password update.");
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile) {
        // If profile cannot be loaded, fallback to redirect to login
        setMessage("Password updated successfully. Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 3000);
        return;
      }

      // 6. Force password change check
      if (profile.force_password_change) {
        setPendingUser(user);
        setPendingProfile(profile);
        setShowTermsDialog(true);
      } else {
        setMessage("Password updated successfully. Redirecting...");
        setTimeout(() => {
          const role = profile.role || "resident";
          if (["admin", "super_admin", "property_admin"].includes(role)) {
            router.push("/dashboard");
          } else {
            router.push("/resident");
          }
        }, 2000);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
      if (
        errMsg.toLowerCase().includes("expired") ||
        errMsg.toLowerCase().includes("invalid grant") ||
        errMsg.toLowerCase().includes("token")
      ) {
        setError("Invitation expired. Request a new invitation.");
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted || !pendingUser) return;
    setLoading(true);
    setError("");

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          force_password_change: false,
          accepted_terms_at: new Date().toISOString(),
          accepted_privacy_at: new Date().toISOString(),
        })
        .eq("id", pendingUser.id);

      if (profileError) {
        throw profileError;
      }

      setShowTermsDialog(false);
      setMessage("Terms accepted. Redirecting...");
      
      const role = pendingProfile?.role || "resident";
      setTimeout(() => {
        if (["admin", "super_admin", "property_admin"].includes(role)) {
          router.push("/dashboard");
        } else {
          router.push("/resident");
        }
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept Terms & Conditions.");
    } finally {
      setLoading(false);
    }
  };

  // Loading view
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-955 p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-505 dark:text-slate-400 font-semibold">Verifying invitation link...</p>
        </div>
      </div>
    );
  }

  // Token expired view
  if (error === "Invitation expired. Request a new invitation.") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-[100%] h-[100%] bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
        </div>
        <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#0F172A] shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mx-auto">
            <svg xmlns="http://www.w3.org/2050/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invitation Expired</h2>
            <p className="text-sm text-slate-550 dark:text-slate-400">
              Invitation expired.
              <br />
              Request a new invitation.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/login" className="block w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#b8952b] text-white font-semibold text-xs tracking-wider uppercase transition duration-200">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-955 p-4 sm:p-8">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-[100%] h-[100%] bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[100%] h-[100%] bg-gradient-to-t from-[#0F172A]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#0F172A] shadow-xl rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Reset Password</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set your new password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold text-center">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 text-xs font-semibold text-center">
              {message}
            </div>
          )}

          <div>
            <label htmlFor="pass" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              New Password
            </label>
            <input
              id="pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all text-sm"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPass" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm Password
            </label>
            <input
              id="confirmPass"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all text-sm"
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-[#D4AF37] hover:bg-[#b8952b] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#D4AF37]/20 transition-all active:scale-[0.98]"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs font-semibold text-[#D4AF37] hover:underline">
            Back to Login
          </Link>
        </div>
      </div>

      {/* Terms & Privacy Dialog Overlay */}
      {showTermsDialog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Terms of Service & Privacy Policy</h3>
              <p className="text-xs text-slate-400 mt-1">Please read and accept the agreements below to access the Resident Portal.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-3 leading-relaxed">
              <p className="font-bold text-slate-800 dark:text-slate-200">1. Agreement to Terms</p>
              <p>By registering and accessing the IRM Resident Portal, you agree to comply with all condominium rules, regulations, and these terms of service. You understand that this portal is provided for the utility administration, operations request submissions, and community communications.</p>
              
              <p className="font-bold text-slate-850 dark:text-slate-200">2. Privacy & Personal Data</p>
              <p>We process your personal information (name, unit information, email, phone number, and history of property access) solely for condominium administration, safety auditing, and user validation. Your data will never be shared with third parties without your explicit consent or legal mandate.</p>

              <p className="font-bold text-slate-850 dark:text-slate-200">3. Credentials Security</p>
              <p>You are responsible for keeping your password secure and for any activity under your account. Notify the property management office immediately of any suspected unauthorized access.</p>
              
              <p className="font-bold text-slate-850 dark:text-slate-200">4. Modifications of Service</p>
              <p>The system administrators reserve the right to temporarily suspend, update, or discontinue the portal functions for maintenance, updates, or operational changes.</p>
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="rounded border-slate-300 text-[#D4AF37] focus:ring-[#D4AF37] mt-0.5"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  I accept the Terms of Service & Privacy Policy and consent to process my data.
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTermsDialog(false);
                    router.push("/login");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350 transition duration-200"
                >
                  Decline
                </button>
                <button
                  disabled={!termsAccepted || loading}
                  onClick={handleAcceptTerms}
                  className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#b8952b] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-[#D4AF37]/10 transition duration-200"
                >
                  {loading ? "Accepting..." : "Accept & Proceed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
