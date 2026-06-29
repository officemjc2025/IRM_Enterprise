import { NextResponse } from "next/server";
import { occupancyService } from "@/services/occupancy/occupancy.service";

export async function GET() {
  try {
    const occupancies = await occupancyService.getOccupancies();
    return NextResponse.json({
      success: true,
      message: "Occupancies retrieved successfully",
      data: occupancies,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve occupancies";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const occupancy = await occupancyService.createOccupancy(body);
    return NextResponse.json({
      success: true,
      message: "Occupancy created successfully",
      data: occupancy,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create occupancy";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
