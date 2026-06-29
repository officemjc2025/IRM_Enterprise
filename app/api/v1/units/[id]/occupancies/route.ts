import { NextResponse } from "next/server";
import { occupancyService } from "@/services/occupancy/occupancy.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const occupancies = await occupancyService.getOccupanciesByUnit(id);
    return NextResponse.json({
      success: true,
      message: "Unit occupancies retrieved successfully",
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
