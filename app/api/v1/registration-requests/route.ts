import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    // Retrieve registration requests
    const requests = await registrationService.getRegistrationRequests();

    return NextResponse.json({
      success: true,
      message: "Registration requests retrieved successfully",
      data: requests,
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
  try {
    const body = await request.json();
    
    // Capture request IP and User-Agent
    const userAgent = request.headers.get("user-agent") || null;
    const xForwardedFor = request.headers.get("x-forwarded-for");
    let sourceIp = xForwardedFor ? xForwardedFor.split(",")[0].trim() : null;
    if (sourceIp === "::1") {
      sourceIp = "127.0.0.1";
    }

    const result = await registrationService.createRegistrationRequest({
      ...body,
      source_ip: sourceIp,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Registration request created successfully",
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create registration request";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
