import { NextResponse } from "next/server";
import { registrationService } from "@/features/registration/services/registration.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 }
      );
    }

    const settings = await registrationService.getSettings(propertyId);
    return NextResponse.json({
      success: true,
      message: "Registration settings retrieved successfully",
      data: settings
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve settings";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
