import { NextResponse } from "next/server";
import { searchService } from "@/shared/search/services/search.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    const results = await searchService.globalSearch(query);

    return NextResponse.json({
      success: true,
      message: "Global search completed successfully",
      data: results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute global search";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
