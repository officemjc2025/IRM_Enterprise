import { NextResponse } from "next/server";
import { ownershipService } from "@/services/ownership/ownership.service";

export async function GET() {
  try {
    const ownerships = await ownershipService.getOwnerships();
    return NextResponse.json({
      success: true,
      message: "Ownerships retrieved successfully",
      data: ownerships,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve ownerships";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ownership = await ownershipService.createOwnership(body);
    return NextResponse.json({
      success: true,
      message: "Ownership created successfully",
      data: ownership,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create ownership";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
