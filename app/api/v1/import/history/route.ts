import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get("moduleName");

    let query = supabase
      .from("import_batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (moduleName) {
      query = query.eq("module_name", moduleName);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });

  } catch (error: unknown) {
    console.error("GET /api/v1/import/history error:", error);
    const message = error instanceof Error ? error.message : "Failed to retrieve import history.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json({ success: false, message: "Missing batchId parameter" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Fetch profiles and persons associated with this batch
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, person_id")
      .eq("import_batch_id", batchId);

    const { data: persons } = await adminClient
      .from("persons")
      .select("id")
      .eq("import_batch_id", batchId);

    const profileIds = profiles?.map(p => p.id) || [];
    const personIds = Array.from(new Set([
      ...(profiles?.map(p => p.person_id).filter((id): id is string => id !== null) || []),
      ...(persons?.map(p => p.id) || [])
    ]));

    // 2. Delete Supabase Auth users
    for (const authId of profileIds) {
      try {
        await adminClient.auth.admin.deleteUser(authId);
      } catch (authDelErr) {
        console.error(`Failed to delete auth user ${authId}:`, authDelErr);
      }
    }

    // 3. Delete Profiles and Persons from DB
    if (profileIds.length > 0) {
      const { error: profError } = await adminClient
        .from("profiles")
        .delete()
        .in("id", profileIds);
      if (profError) throw profError;
    }

    if (personIds.length > 0) {
      const { error: persError } = await adminClient
        .from("persons")
        .delete()
        .in("id", personIds);
      if (persError) throw persError;
    }

    // 4. Update import batch status to ROLLED_BACK
    const { error: batchUpdateErr } = await adminClient
      .from("import_batches")
      .update({ status: "ROLLED_BACK" })
      .eq("id", batchId);
      
    if (batchUpdateErr) throw batchUpdateErr;

    return NextResponse.json({
      success: true,
      message: "Batch rolled back successfully. Database and Auth users cleared."
    });

  } catch (error: unknown) {
    console.error("POST /api/v1/import/history (rollback) error:", error);
    const message = error instanceof Error ? error.message : "Rollback failed.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
