import { NextResponse } from "next/server";
import { personService } from "@/services/person/person.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const people = await personService.searchPersons(query);
    return NextResponse.json({
      success: true,
      message: "Search completed successfully",
      data: people,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search people";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
