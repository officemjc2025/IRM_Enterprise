import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Fetch only ACTIVE properties that are not soft-deleted
    const { data: properties, error } = await supabase
      .from("property")
      .select("id, property_code, property_name_th, property_name_en")
      .eq("status", "ACTIVE")
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    // Map properties to public format (id, code, name_th, name_en)
    const mapped = (properties || []).map((p: { id: string; property_code: string | null; property_name_th: string | null; property_name_en: string | null }) => ({
      id: p.id,
      code: p.property_code,
      name_th: p.property_name_th,
      name_en: p.property_name_en || "",
    }));

    return NextResponse.json({
      success: true,
      message: "Public properties retrieved successfully",
      data: mapped,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve public properties";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
