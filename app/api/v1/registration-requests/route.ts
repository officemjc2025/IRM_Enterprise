import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { CreateRegistrationRequestDto } from "@/features/registration/types/registration.types";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin", "office"].includes(profile.role);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const propertyId = searchParams.get("property_id") || undefined;
    const dateFrom = searchParams.get("date_from") || undefined;
    const dateTo = searchParams.get("date_to") || undefined;
    const relationship = searchParams.get("relationship") || undefined;
    const registrationType = searchParams.get("registration_type") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Retrieve registration requests
    const result = await registrationService.getPaginatedRegistrationRequests({
      search,
      status,
      propertyId,
      dateFrom,
      dateTo,
      relationship,
      registrationType,
      page,
      limit
    });

    return NextResponse.json({
      success: true,
      message: "Registration requests retrieved successfully",
      data: result.data,
      total: result.total
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve registration requests";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

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

    const payload = {
      ...(body || {}),
      source_ip: sourceIp,
      user_agent: userAgent,
    } as unknown as CreateRegistrationRequestDto;

    console.log("Request payload received:", JSON.stringify(payload, null, 2));

    const result = await registrationService.createRegistrationRequest(payload);

    console.log("Parsed payload successfully:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: "Registration request created successfully",
      data: result,
    });
  } catch (error: unknown) {
    let message = "Failed to create registration request";
    let zodErrors: import("zod").ZodIssue[] | null = null;

    if (error instanceof z.ZodError) {
      zodErrors = error.issues;
      message = "Validation Error: " + error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    } else if (error instanceof Error) {
      message = error.message;
    }

    console.error("Zod validation errors:", JSON.stringify(zodErrors, null, 2));
    console.error("Final error response:", message);

    return NextResponse.json(
      {
        success: false,
        message,
        receivedPayload: body,
        zodErrors,
      },
      { status: 400 }
    );
  }
}
