import { NextResponse } from "next/server";
import { ownerService } from "@/services/owner/owner.service";

export async function GET() {
  try {
    const owners = await ownerService.getOwners();
    return NextResponse.json({
      success: true,
      message: "Owners retrieved successfully",
      data: owners,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve owners";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const owner = await ownerService.createOwner(body);
    return NextResponse.json({
      success: true,
      message: "Owner created successfully",
      data: owner,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create owner";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
