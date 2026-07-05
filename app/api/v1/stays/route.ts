import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const search = searchParams.get("search");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        property:property_id (id, property_name_th, property_name_en),
        unit:unit_id (id, unit_number),
        primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
        extensions:reservation_extensions (*),
        stay_charge_periods (*)
      `)
      .eq("status", "CHECKED_IN")
      .order("created_at", { ascending: false });

    // Property Admin Scope Enforcer
    if (profile.role === "property_admin") {
      if (!profile.property_id) {
        return NextResponse.json({ success: true, data: [] });
      }
      query = query.eq("property_id", profile.property_id);
    } else if (propertyId && propertyId !== "ALL") {
      query = query.eq("property_id", propertyId);
    }

    const { data: stays, error: dbErr } = await query;
    if (dbErr) throw dbErr;

    let filtered = stays || [];
    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const num = r.reservation_number.toLowerCase();
        const unit = r.unit ? r.unit.unit_number.toLowerCase() : "";
        const name = r.primary_guest ? `${r.primary_guest.first_name} ${r.primary_guest.last_name || ""}`.toLowerCase() : "";
        return num.includes(term) || unit.includes(term) || name.includes(term);
      });
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
