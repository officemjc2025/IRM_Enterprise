import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .is("deleted_at", null)
      .order("published_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve documents";
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

    const { title, file_path } = await request.json();

    if (!title || title.trim() === "") {
      return NextResponse.json(
        { success: false, message: "Title is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("documents")
      .insert([{
        title: title.trim(),
        file_path: file_path || null,
        published_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Document registered successfully",
      data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register document";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
