import { NextResponse } from "next/server";
import { propertyService } from "@/services/property/property.service";

export async function GET() {
  try {
    const properties = await propertyService.getAll();
    return NextResponse.json({
      success: true,
      message: "Properties retrieved successfully",
      data: properties,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve properties";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const property = await propertyService.create(body);
    return NextResponse.json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create property";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
