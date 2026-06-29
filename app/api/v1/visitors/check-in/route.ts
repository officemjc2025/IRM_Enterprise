import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const visitor = await visitorService.checkInVisitor(body);
    return NextResponse.json({
      success: true,
      message: "Visitor checked in successfully",
      data: visitor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check in visitor";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
