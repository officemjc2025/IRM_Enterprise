import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveIdentity } from "@/lib/identity/resolver";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Resolve Identity using the canonical resolver
    const resolved = await resolveIdentity(supabase, user.id);

    if (!resolved) {
      return NextResponse.json(
        { success: false, message: "Failed to resolve portal profile" },
        { status: 400 }
      );
    }

    const profile = {
      id: resolved.profile.id,
      email: resolved.profile.email,
      role: resolved.profile.role,
      property_id: resolved.profile.property_id,
      account_status: resolved.profile.account_status,
      is_active: resolved.profile.is_active,
      department: resolved.profile.department,
      team: resolved.profile.team
    };

    return NextResponse.json({
      success: true,
      data: {
        profile,
        person: resolved.person,
        assignments: resolved.assignments
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to resolve portal identity";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
