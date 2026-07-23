import { NextResponse } from "next/server";
import { staffService } from "@/features/staff/services/staff.service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin", "office"].includes(profile.role);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, ids, department, team } = body;

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid parameters" },
        { status: 400 }
      );
    }

    switch (action) {
      case "activate":
        await staffService.bulkActivate(ids, user.id);
        break;
      case "disable":
        await staffService.bulkDisable(ids, user.id);
        break;
      case "send_invitation":
        await staffService.bulkSendInvitation(ids);
        break;
      case "reset_password":
        await staffService.bulkResetPassword(ids, user.id);
        break;
      case "change_department":
        if (!department) {
          return NextResponse.json(
            { success: false, message: "Missing department parameter" },
            { status: 400 }
          );
        }
        await staffService.bulkChangeDepartment(ids, department, user.id);
        break;
      case "change_team":
        if (team === undefined) {
          return NextResponse.json(
            { success: false, message: "Missing team parameter" },
            { status: 400 }
          );
        }
        await staffService.bulkChangeTeam(ids, team, user.id);
        break;
      default:
        return NextResponse.json(
          { success: false, message: "Invalid action" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Bulk action '${action}' executed successfully against ${ids.length} staff records.`
    });

  } catch (error: unknown) {
    console.error("POST /api/v1/staff/bulk error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute bulk action.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
