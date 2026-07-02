import { NextResponse } from "next/server";
import { announcementService } from "@/services/announcement/announcement.service";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const announcement = await announcementService.getAnnouncementById(id);
    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found" },
        { status: 404 }
      );
    }

    // Check permissions: Resident can only view published and not expired
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && (profile.role === "admin" || profile.role === "super_admin" || profile.role === "property_admin");

    if (!isAdmin) {
      const now = new Date();
      if (announcement.status !== "PUBLISHED") {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        );
      }
      if (announcement.publish_at && new Date(announcement.publish_at) > now) {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        );
      }
      if (announcement.expire_at && new Date(announcement.expire_at) < now) {
        return NextResponse.json(
          { success: false, message: "Forbidden" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Announcement retrieved successfully",
      data: announcement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve announcement";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

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
    const announcement = await announcementService.updateAnnouncement(id, {
      ...body,
      updated_by: user.id,
    });

    if (!announcement) {
      return NextResponse.json(
        { success: false, message: "Announcement not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update announcement";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const success = await announcementService.archiveAnnouncement(id, user.id);
    if (!success) {
      return NextResponse.json(
        { success: false, message: "Announcement not found or archive failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Announcement archived successfully",
      data: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive announcement";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
