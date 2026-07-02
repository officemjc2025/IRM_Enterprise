import { NextResponse } from "next/server";
import { announcementService } from "@/services/announcement/announcement.service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const publishedOnly = searchParams.get("published_only") === "true";

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && (profile.role === "admin" || profile.role === "super_admin" || profile.role === "property_admin");

    let announcements;
    if (publishedOnly || !isAdmin) {
      announcements = await announcementService.getPublishedAnnouncements();
    } else {
      announcements = await announcementService.getAnnouncements();
    }

    return NextResponse.json({
      success: true,
      message: "Announcements retrieved successfully",
      data: announcements,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve announcements";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

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

    const isAdmin = profile && (profile.role === "admin" || profile.role === "super_admin" || profile.role === "property_admin");

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const announcement = await announcementService.createAnnouncement({
      ...body,
      created_by: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Announcement created successfully",
      data: announcement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create announcement";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
