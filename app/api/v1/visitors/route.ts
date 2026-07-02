import { NextResponse } from "next/server";
import { visitorService } from "@/services/visitor/visitor.service";
import { createClient } from "@/lib/supabase/server";
import { Visitor } from "@/features/visitor/types/visitor.types";

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
    const filterType = searchParams.get("filter") || "today"; // 'today', 'queue', 'history'

    // Retrieve user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && (profile.role === "admin" || profile.role === "super_admin" || profile.role === "property_admin");

    let visitors: Visitor[] = [];
    if (filterType === "queue") {
      visitors = await visitorService.getQueueVisitors();
    } else if (filterType === "history") {
      visitors = await visitorService.getHistoryVisitors();
    } else {
      visitors = await visitorService.getTodayVisitors();
    }

    // Security check: Residents can only view their own visitor requests
    if (!isAdmin) {
      // Find person
      const { data: person } = await supabase
        .from("persons")
        .select("id")
        .eq("email", user.email)
        .is("deleted_at", null)
        .maybeSingle();

      if (!person) {
        visitors = [];
      } else {
        // Find resident assignments
        const { data: assignments } = await supabase
          .from("resident_assignments")
          .select("id")
          .eq("person_id", person.id);

        const assignmentIds = (assignments || []).map((a) => a.id);
        
        visitors = visitors.filter((v) => 
          v.resident_assignment_id && assignmentIds.includes(v.resident_assignment_id)
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Visitors retrieved successfully",
      data: visitors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve visitors";
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

    const body = await request.json();
    
    // Security check: Resident can only request for their own assignment
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && (profile.role === "admin" || profile.role === "super_admin" || profile.role === "property_admin");

    if (!isAdmin) {
      const { data: person } = await supabase
        .from("persons")
        .select("id")
        .eq("email", user.email)
        .is("deleted_at", null)
        .maybeSingle();

      if (!person) {
        return NextResponse.json(
          { success: false, message: "Resident profile not found" },
          { status: 400 }
        );
      }

      const { data: assignment } = await supabase
        .from("resident_assignments")
        .select("id")
        .eq("id", body.resident_assignment_id)
        .eq("person_id", person.id)
        .maybeSingle();

      if (!assignment) {
        return NextResponse.json(
          { success: false, message: "Invalid resident assignment specified" },
          { status: 403 }
        );
      }
    }

    const visitor = await visitorService.createVisitor({
      ...body,
      created_by: user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Visitor request created successfully",
      data: visitor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create visitor request";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
