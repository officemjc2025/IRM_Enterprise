import { NextResponse } from "next/server";
import { propertyService } from "@/services/property/property.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const property = await propertyService.getById(id);
    if (!property) {
      return NextResponse.json(
        { success: false, message: "Property not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Property retrieved successfully",
      data: property,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve property";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const property = await propertyService.update(id, body);
    if (!property) {
      return NextResponse.json(
        { success: false, message: "Property not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Property updated successfully",
      data: property,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update property";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await propertyService.archive(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Property not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Property archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive property";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
