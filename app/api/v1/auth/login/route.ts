import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PinActivationService } from "@/services/auth/pin-activation.service";

interface ProfileDetails {
  id: string;
  email: string;
  role: string;
  force_password_change: boolean;
  auth_status: string;
  account_status: string;
  phone?: string | null;
}

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ success: false, message: "Identifier and password/PIN are required." }, { status: 400 });
    }

    const adminClient = createAdminClient();
    let profile: ProfileDetails | null = null;

    // 1. Resolve Profile by identifier (Email, Employee Code, or Phone)
    if (identifier.includes("@")) {
      const { data } = await adminClient
        .from("profiles")
        .select("*")
        .eq("email", identifier.toLowerCase().trim())
        .maybeSingle();
      profile = data as ProfileDetails | null;
    } else {
      // Try Employee Code / Person Code lookup
      const { data: person } = await adminClient
        .from("persons")
        .select("id")
        .eq("person_code", identifier.trim())
        .maybeSingle();

      if (person) {
        const { data } = await adminClient
          .from("profiles")
          .select("*")
          .eq("person_id", person.id)
          .maybeSingle();
        profile = data as ProfileDetails | null;
      } else {
        // Try Phone lookup
        const { data } = await adminClient
          .from("profiles")
          .select("*")
          .eq("phone", identifier.trim())
          .maybeSingle();
        profile = data as ProfileDetails | null;
      }
    }

    if (!profile) {
      console.error("Profile lookup failed for identifier:", identifier);
      return NextResponse.json({
        success: false,
        stage: "profile_lookup",
        message: "Profile not found for the provided identifier: " + identifier,
        details: { identifier }
      }, { status: 401 });
    }

    // Log resolved profile information
    console.log("Profile resolved successfully:", {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      auth_status: profile.auth_status,
      account_status: profile.account_status,
      force_password_change: profile.force_password_change
    });

    // 2. Enforce Lockout / Disable Status Check
    if (profile.auth_status === "LOCKED" || profile.account_status === "LOCKED") {
      console.error("Account status check failed: Profile is locked.", {
        id: profile.id,
        auth_status: profile.auth_status,
        account_status: profile.account_status
      });
      return NextResponse.json({
        success: false,
        stage: "account_status",
        message: "Your account is locked due to too many failed attempts. Please contact your property office.",
        details: { auth_status: profile.auth_status, account_status: profile.account_status }
      }, { status: 403 });
    }
    if (profile.account_status === "DISABLED") {
      console.error("Account status check failed: Profile is disabled.", {
        id: profile.id,
        account_status: profile.account_status
      });
      return NextResponse.json({
        success: false,
        stage: "account_status",
        message: "Your account has been disabled.",
        details: { account_status: profile.account_status }
      }, { status: 403 });
    }

    // 3. Detect 6-digit numeric Temporary PIN for pending/force_change accounts
    const isPin = /^\d{6}$/.test(password);
    if (isPin && profile.force_password_change) {
      try {
        await PinActivationService.validateTemporaryPin(profile.id, password);
        // Success: PIN is valid, user needs to complete password change wizard
        return NextResponse.json({
          success: true,
          mustActivate: true,
          userId: profile.id,
          email: profile.email,
        });
      } catch (pinErr: unknown) {
        console.error("Temporary PIN validation error for profile:", profile.id, pinErr);
        const message = pinErr instanceof Error ? pinErr.message : "Invalid Temporary PIN.";
        return NextResponse.json({
          success: false,
          stage: "pin_validation",
          message,
          details: pinErr
        }, { status: 401 });
      }
    }

    // 4. Fallback to normal GoTrue sign in
    console.log("Attempting password login:", {
      email: profile.email,
      identifierType: identifier.includes("@") ? "email" : "employee_code/other"
    });

    const supabase = await createClient();
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: password,
    });

    if (authErr || !authData.user) {
      console.error("Supabase signInWithPassword failed:", {
        authErr,
        authDataUser: authData?.user ? { id: authData.user.id, email: authData.user.email } : null
      });
      return NextResponse.json({
        success: false,
        stage: "supabase_signin",
        message: authErr?.message || "Invalid password or missing auth user record.",
        details: authErr
      }, { status: 401 });
    }

    // Verify profile mapping
    if (profile.email.toLowerCase() !== authData.user.email?.toLowerCase()) {
      console.error("WARNING: Email mismatch between profile and auth.users:", {
        profileEmail: profile.email,
        authUserEmail: authData.user.email
      });
    }

    // Log successful sign in
    console.log("Supabase signInWithPassword succeeded:", {
      userId: authData.user.id,
      userEmail: authData.user.email
    });

    // If login is successful, return user info and profile info
    return NextResponse.json({
      success: true,
      user: authData.user,
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        force_password_change: profile.force_password_change,
        auth_status: profile.auth_status,
        account_status: profile.account_status,
      }
    });

  } catch (err: unknown) {
    console.error("Login endpoint error:", err);
    return NextResponse.json({
      success: false,
      stage: "unexpected_error",
      message: err instanceof Error ? err.message : "An unexpected error occurred.",
      details: err
    }, { status: 500 });
  }
}
