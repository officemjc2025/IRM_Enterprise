import { NextResponse } from "next/server";
import * as registrationRepository from "@/features/registration/repositories/registration.repository";
import { PinActivationService } from "@/services/auth/pin-activation.service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Resolve logged in admin user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const request = await registrationRepository.findById(id);
    if (!request) {
      return NextResponse.json({ success: false, message: "Registration request not found." }, { status: 404 });
    }

    if (!request.profile_id) {
      return NextResponse.json(
        { success: false, message: "This request has not been activated yet (no profile linked)." },
        { status: 400 }
      );
    }

    const pin = await PinActivationService.resetTemporaryPin(request.profile_id, user.id);

    return NextResponse.json({
      success: true,
      message: "Temporary PIN reset successfully.",
      pin,
    });
  } catch (err: unknown) {
    console.error("Registration PIN reset error:", err);
    const message = err instanceof Error ? err.message : "Failed to reset Temporary PIN.";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
