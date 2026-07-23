import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { compareUnitNumbers } from "@/shared/utils/unit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, message: "Property ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch only ACTIVE units under this property that are not soft-deleted
    const { data: units, error } = await supabase
      .from("unit")
      .select("id, unit_number, floor, building_code")
      .eq("property_id", propertyId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    // Map units to public format (id, unit_number, floor, building)
    const mapped = (units || []).map((u: { id: string; unit_number: string; floor: string | null; building_code: string | null }) => ({
      id: u.id,
      unit_number: u.unit_number,
      floor: u.floor,
      building: u.building_code,
    }));

    // Natural room number sorting
    mapped.sort((a: { unit_number: string }, b: { unit_number: string }) => compareUnitNumbers(a.unit_number, b.unit_number));

    return NextResponse.json({
      success: true,
      message: "Public units retrieved successfully",
      data: mapped,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve public units";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
