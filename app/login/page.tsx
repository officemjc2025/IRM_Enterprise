import React from "react";
import LoginForm from "../../features/auth/components/LoginForm";

export const metadata = {
  title: "Login - IRM Enterprise",
  description: "Sign in to IRM Enterprise",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-8">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-[100%] h-[100%] bg-gradient-to-b from-[#D4AF37]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
        <div className="absolute -bottom-1/2 -left-1/2 w-[100%] h-[100%] bg-gradient-to-t from-[#0F172A]/5 to-transparent rounded-full blur-3xl opacity-50 dark:opacity-20" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full flex justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
