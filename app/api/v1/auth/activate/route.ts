import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PinActivationService } from "@/services/auth/pin-activation.service";

export async function POST(req: Request) {
  try {
    const { userId, newPassword, acceptTerms } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, message: "User ID and new password are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { success: false, message: "You must accept the Terms and Privacy Policy to continue." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .maybeSingle();

    if (profErr || !profile) {
      return NextResponse.json(
        { success: false, message: "Associated account profile was not found." },
        { status: 404 }
      );
    }

    // 1. Force password change and mark profile ACTIVE
    await PinActivationService.forcePasswordChange(userId, newPassword);

    // 2. Automatically log the user in via GoTrue to establish session cookies
    const supabase = await createClient();
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: newPassword,
    });

    if (authErr || !authData.user) {
      console.error("Auto sign-in failed after password change:", authErr);
      return NextResponse.json({
        success: true,
        message: "Account activated successfully. Please log in using your new password.",
        requiresManualLogin: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Account activated successfully.",
      user: authData.user,
      profile: {
        id: userId,
        email: profile.email,
        role: profile.role,
        auth_status: "ACTIVE",
      },
    });

  } catch (err: unknown) {
    console.error("Activation endpoint error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred during activation.";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
