import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";

export async function GET() {
  try {
    const visitors = await visitorService.getVisitors();
    return NextResponse.json({
      success: true,
      message: "Visitors retrieved successfully",
      data: visitors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve visitors";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

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
