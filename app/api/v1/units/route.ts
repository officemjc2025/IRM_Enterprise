import { NextResponse } from "next/server";
import { unitService } from "@/services/unit/unit.service";

export async function GET() {
  try {
    const units = await unitService.getUnits();
    return NextResponse.json({
      success: true,
      message: "Units retrieved successfully",
      data: units,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve units";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const unit = await unitService.createUnit(body);
    return NextResponse.json({
      success: true,
      message: "Unit created successfully",
      data: unit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create unit";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
