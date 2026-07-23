import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  let reqId: string | null = null;
  try {
    const { id } = await params;
    reqId = id;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const isAdmin = role && ["admin", "super_admin", "property_admin", "office"].includes(role);

    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Fetch the request to verify property_admin/office ownership
    const regRequest = await registrationService.getRegistrationRequest(id);
    if (!regRequest) {
      return NextResponse.json({ success: false, message: "Registration request not found" }, { status: 404 });
    }

    if ((role === "property_admin" || role === "office") && regRequest.property_id !== profile.property_id) {
      return NextResponse.json({ success: false, message: "Forbidden: Property mismatch" }, { status: 403 });
    }

    const { origin } = new URL(request.url);
    const result = await registrationService.manuallyActivateRequest(id, user.id, origin);

    return NextResponse.json({
      success: true,
      message: "Registration request activated manually",
      data: result,
      warningMessage: result ? (result as Record<string, unknown>).warningMessage : undefined,
      activationResult: result ? (result as Record<string, unknown>).activationResult : undefined,
      pin: result ? (result as Record<string, unknown>).pin : undefined
    });
  } catch (error: unknown) {
    console.error("================ MANUAL ACTIVATION HANDLER ERROR ================");
    console.error("Request Path Parameters (ID):", reqId);
    const errObj = error as Record<string, unknown>;
    try {
      console.error("Exception properties:", {
        message: errObj?.message,
        code: errObj?.code,
        details: errObj?.details,
        hint: errObj?.hint
      });
      if (error instanceof Error && error.stack) {
        console.error("Exception stack trace:", error.stack);
      }
    } catch (e) {
      console.error("Error logging exception:", e);
    }
    console.error("=================================================================");

    let message = "Failed to activate registration request";
    let code = "UNKNOWN_ERROR";
    let details: unknown = null;
    let hint: string | null = null;

    if (error instanceof Error) {
      message = error.message;
      const parsedErr = error as unknown as Record<string, unknown>;
      code = typeof parsedErr.code === "string" ? parsedErr.code : "ERROR";
      details = parsedErr.details;
      hint = typeof parsedErr.hint === "string" ? parsedErr.hint : null;
    }

    // Check if Zod validation error
    if (error && typeof error === "object" && "issues" in error) {
      const zodErr = error as { issues: Array<{ path: Array<string | number>; message: string }> };
      code = "VALIDATION_ERROR";
      details = zodErr.issues;
      message = "Validation failed: " + zodErr.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(", ");
    }

    const responsePayload: Record<string, unknown> = {
      success: false,
      message,
      code,
      details,
      hint
    };

    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      responsePayload.stack = error.stack;
    }

    return NextResponse.json(responsePayload, { status: 400 });
  }
}
