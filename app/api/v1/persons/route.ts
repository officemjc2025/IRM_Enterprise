import { NextResponse } from "next/server";
import { personService } from "@/services/person/person.service";

export async function GET() {
  try {
    const people = await personService.getPersons();
    return NextResponse.json({
      success: true,
      message: "People retrieved successfully",
      data: people,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve people";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const person = await personService.createPerson(body);
    return NextResponse.json({
      success: true,
      message: "Person created successfully",
      data: person,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create person";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
