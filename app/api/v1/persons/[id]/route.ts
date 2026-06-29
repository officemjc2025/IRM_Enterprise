import { NextResponse } from "next/server";
import { personService } from "@/services/person/person.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const person = await personService.getPerson(id);
    if (!person) {
      return NextResponse.json(
        { success: false, message: "Person not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Person retrieved successfully",
      data: person,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve person";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const person = await personService.updatePerson(id, body);
    if (!person) {
      return NextResponse.json(
        { success: false, message: "Person not found or update failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Person updated successfully",
      data: person,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update person";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const success = await personService.archivePerson(id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Person not found or archive failed" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Person archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive person";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
