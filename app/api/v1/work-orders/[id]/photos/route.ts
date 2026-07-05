import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workOrderService } from "@/services/work-order/work-order.service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: workOrderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await workOrderService.getWorkOrderById(workOrderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found" },
        { status: 404 }
      );
    }

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isTechnician = profile && profile.role === "technician";
    const isHousekeeper = profile && profile.role === "housekeeping";

    if (!isAdmin) {
      if (isTechnician) {
        if (order.service_team !== "TECHNICIAN" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else if (isHousekeeper) {
        if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const { data: photos, error: dbErr } = await supabase
      .from("work_order_photos")
      .select("*")
      .eq("work_order_id", workOrderId);

    if (dbErr) {
      throw dbErr;
    }

    return NextResponse.json({
      success: true,
      data: photos
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve photos";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: workOrderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const order = await workOrderService.getWorkOrderById(workOrderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found" },
        { status: 404 }
      );
    }

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isTechnician = profile && profile.role === "technician";
    const isHousekeeper = profile && profile.role === "housekeeping";

    if (!isAdmin) {
      if (isTechnician) {
        if (order.service_team !== "TECHNICIAN" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else if (isHousekeeper) {
        if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const stage = formData.get("photo_stage") as string | null;

    if (!file || !stage || (stage !== "BEFORE" && stage !== "AFTER")) {
      return NextResponse.json(
        { success: false, message: "File and valid photo_stage (BEFORE/AFTER) are required" },
        { status: 400 }
      );
    }

    // 1. Reject empty file
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, message: "Empty file uploaded" },
        { status: 400 }
      );
    }

    // 2. File size validation (10 MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: "File size exceeds the 10 MB limit" },
        { status: 400 }
      );
    }

    // 3. MIME type validation (JPEG, PNG, WebP)
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // 4. Derive extension from MIME type to prevent malicious naming
    let fileExtension = "jpg";
    if (file.type === "image/png") fileExtension = "png";
    else if (file.type === "image/webp") fileExtension = "webp";

    // 5. Generate deterministic path (no user-controlled filename components)
    const uniqueId = crypto.randomUUID();
    const storagePath = `work-orders/${workOrderId}/${stage.toLowerCase()}/${uniqueId}.${fileExtension}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("work-orders")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload photo to storage: ${uploadError.message}`);
    }

    // Insert photo metadata to database
    const { data: photoData, error: dbError } = await supabase
      .from("work_order_photos")
      .insert({
        work_order_id: workOrderId,
        photo_stage: stage,
        storage_path: storagePath,
        uploaded_by: user.id
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file from storage if DB insert fails
      await supabase.storage.from("work-orders").remove([storagePath]);
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      message: "Photo uploaded successfully",
      data: photoData
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload photo";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id: workOrderId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get("photo_id");

    if (!photoId) {
      return NextResponse.json(
        { success: false, message: "photo_id parameter is required" },
        { status: 400 }
      );
    }

    // Fetch photo from DB
    const { data: photo, error: fetchErr } = await supabase
      .from("work_order_photos")
      .select("*")
      .eq("id", photoId)
      .single();

    if (fetchErr || !photo) {
      return NextResponse.json(
        { success: false, message: "Photo record not found" },
        { status: 404 }
      );
    }

    if (photo.work_order_id !== workOrderId) {
      return NextResponse.json(
        { success: false, message: "Photo does not belong to this work order" },
        { status: 400 }
      );
    }

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile && ["admin", "super_admin", "property_admin"].includes(profile.role);
    const isUploader = photo.uploaded_by === user.id;

    // Fetch order to check worker assignment and service team
    const order = await workOrderService.getWorkOrderById(workOrderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: "Work order not found" },
        { status: 404 }
      );
    }

    if (!isAdmin) {
      // Worker validation: must own the upload AND the job must be currently assigned to them and match their role team
      const isTechnician = profile && profile.role === "technician";
      const isHousekeeper = profile && profile.role === "housekeeping";

      if (!isUploader) {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }

      if (isTechnician) {
        if (order.service_team !== "TECHNICIAN" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else if (isHousekeeper) {
        if (order.service_team !== "HOUSEKEEPING" || order.assigned_to !== user.id) {
          return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
      }
    }

    // 1. Remove from Storage first. If it fails, do NOT delete metadata, return error.
    const { data: removeData, error: removeErr } = await supabase.storage
      .from("work-orders")
      .remove([photo.storage_path]);

    if (removeErr || !removeData || removeData.length === 0) {
      return NextResponse.json(
        { success: false, message: removeErr?.message || "Storage object deletion failed" },
        { status: 500 }
      );
    }

    // 2. Delete from DB only after successful storage removal
    const { error: deleteErr } = await supabase
      .from("work_order_photos")
      .delete()
      .eq("id", photoId);

    if (deleteErr) {
      throw deleteErr;
    }

    return NextResponse.json({
      success: true,
      message: "Photo deleted successfully"
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete photo";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
