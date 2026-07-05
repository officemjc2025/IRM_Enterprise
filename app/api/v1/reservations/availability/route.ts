import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get("unit_id");
    const checkInStr = searchParams.get("check_in_at");
    const checkOutStr = searchParams.get("check_out_at");
    const excludeId = searchParams.get("exclude_id");

    if (!unitId || !checkInStr || !checkOutStr) {
      return NextResponse.json({ success: false, message: "unit_id, check_in_at, and check_out_at are required" }, { status: 400 });
    }

    let query = supabase
      .from("reservations")
      .select("id")
      .eq("unit_id", unitId)
      .in("status", ["CONFIRMED", "CHECKED_IN"])
      .lt("check_in_at", checkOutStr)
      .gt("check_out_at", checkInStr);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data: conflicts, error } = await query;
    if (error) throw error;

    const available = !conflicts || conflicts.length === 0;

    return NextResponse.json({
      success: true,
      available,
      conflicts: conflicts || []
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
