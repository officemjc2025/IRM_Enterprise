import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";
import { z } from "zod";
import { CreateRegistrationRequestDto } from "@/features/registration/types/registration.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await request.json()) as Record<string, unknown>;
    
    // Capture request IP and User-Agent
    const userAgent = request.headers.get("user-agent") || null;
    const xForwardedFor = request.headers.get("x-forwarded-for");
    let sourceIp = xForwardedFor ? xForwardedFor.split(",")[0].trim() : null;
    if (sourceIp === "::1") {
      sourceIp = "127.0.0.1";
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let personId = body.person_id as string | undefined;
    let emailVal = body.email as string | undefined;
    let firstNameVal = body.first_name as string | undefined;
    let lastNameVal = body.last_name as string | undefined;
    let phoneVal = body.phone as string | undefined;

    if (user) {
      // Authenticated user registering another unit
      const { data: profile } = await supabase
        .from("profiles")
        .select("person_id, email")
        .eq("id", user.id)
        .single();

      if (profile) {
        personId = profile.person_id || undefined;
        emailVal = profile.email || undefined;
        
        // Fetch person details to populate name & phone
        const { data: person } = await supabase
          .from("person")
          .select("first_name, last_name, phone")
          .eq("id", profile.person_id)
          .single();

        if (person) {
          firstNameVal = person.first_name || undefined;
          lastNameVal = person.last_name || undefined;
          phoneVal = person.phone || undefined;
        }
      }
    }

    const payload = {
      ...(body || {}),
      person_id: personId || null,
      email: emailVal || null,
      first_name: firstNameVal,
      last_name: lastNameVal,
      phone: phoneVal || null,
      registration_type: "RESIDENT",
      source_ip: sourceIp,
      user_agent: userAgent,
    } as unknown as CreateRegistrationRequestDto;

    console.log("[Public Register API] Payload received:", JSON.stringify(payload, null, 2));

    const result = await registrationService.createRegistrationRequest(payload);

    console.log("[Public Register API] Request created successfully:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: "Registration request created successfully",
      data: result,
    });
  } catch (error: unknown) {
    let message = "Failed to create registration request";
    let status = 500;
    let zodErrors: import("zod").ZodIssue[] | null = null;

    if (error instanceof z.ZodError) {
      zodErrors = error.issues;
      message = "Validation Error: " + error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      status = 400;
    } else if (error instanceof Error) {
      message = error.message;
      if (message.includes("already in progress") || message.includes("duplicate")) {
        status = 409;
      } else if (message.includes("closed") || message.includes("disabled")) {
        status = 403;
      } else {
        status = 400; // Client error or bad input
      }
    }

    console.error("[Public Register API] Error occurred:", message, "Status:", status);

    return NextResponse.json(
      {
        success: false,
        message,
        receivedPayload: body,
        zodErrors,
      },
      { status }
    );
  }
}
