import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Announcement, CreateAnnouncementDto, UpdateAnnouncementDto, AnnouncementPriority, AnnouncementStatus } from "@/features/announcement/types/announcement.types";

async function getSupabase() {
  if (typeof window === "undefined") {
    return await createServerClient();
  }
  return createBrowserClient();
}

interface AnnouncementDbRow {
  id: string;
  property_id: string | null;
  title: string;
  content: string;
  priority: string | null;
  status: string | null;
  is_pinned: boolean;
  publish_at: string | null;
  expire_at: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  properties?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
  } | null;
}

function mapToAnnouncement(row: AnnouncementDbRow): Announcement {
  return {
    id: row.id,
    property_id: row.property_id,
    title: row.title,
    content: row.content,
    priority: (row.priority || "NORMAL").toUpperCase() as AnnouncementPriority,
    status: (row.status || "DRAFT").toUpperCase() as AnnouncementStatus,
    is_pinned: row.is_pinned || false,
    publish_at: row.publish_at,
    expire_at: row.expire_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
    deleted_at: row.deleted_at,
    property: row.properties ? {
      id: row.properties.id,
      property_name_th: row.properties.property_name_th,
      property_name_en: row.properties.property_name_en,
    } : null,
  };
}

export async function findAll(): Promise<Announcement[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .select(`
      *,
      properties:property_id (id, property_name_th, property_name_en)
    `)
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding announcements:", error);
    return [];
  }

  return (data as AnnouncementDbRow[] || []).map(mapToAnnouncement);
}

export async function findPublished(): Promise<Announcement[]> {
  const supabase = await getSupabase();
  const now = new Date().toISOString();
  
  // Filter for published & not expired announcements
  const { data, error } = await supabase
    .from("announcements")
    .select(`
      *,
      properties:property_id (id, property_name_th, property_name_en)
    `)
    .eq("status", "PUBLISHED")
    .or(`publish_at.is.null,publish_at.lte.${now}`)
    .or(`expire_at.is.null,expire_at.gt.${now}`)
    .is("deleted_at", null);

  if (error) {
    console.error("Error finding published announcements:", error);
    return [];
  }

  return (data as AnnouncementDbRow[] || []).map(mapToAnnouncement);
}

export async function findById(id: string): Promise<Announcement | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .select(`
      *,
      properties:property_id (id, property_name_th, property_name_en)
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(`Error finding announcement by id: ${id}`, error);
    return null;
  }

  return data ? mapToAnnouncement(data as AnnouncementDbRow) : null;
}

export async function create(dto: CreateAnnouncementDto): Promise<Announcement> {
  const supabase = await getSupabase();
  const payload = {
    property_id: dto.property_id || null,
    title: dto.title,
    content: dto.content,
    priority: dto.priority || "NORMAL",
    status: dto.status || "DRAFT",
    is_pinned: dto.is_pinned || false,
    publish_at: dto.publish_at || new Date().toISOString(),
    expire_at: dto.expire_at || null,
    created_by: dto.created_by || null,
  };

  const { data, error } = await supabase
    .from("announcements")
    .insert([payload])
    .select(`
      *,
      properties:property_id (id, property_name_th, property_name_en)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create announcement: ${error.message}`);
  }

  return mapToAnnouncement(data as AnnouncementDbRow);
}

export async function update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement | null> {
  const supabase = await getSupabase();
  const payload: Record<string, unknown> = {};
  
  if (dto.property_id !== undefined) payload.property_id = dto.property_id;
  if (dto.title !== undefined) payload.title = dto.title;
  if (dto.content !== undefined) payload.content = dto.content;
  if (dto.priority !== undefined) payload.priority = dto.priority;
  if (dto.status !== undefined) payload.status = dto.status;
  if (dto.is_pinned !== undefined) payload.is_pinned = dto.is_pinned;
  if (dto.publish_at !== undefined) payload.publish_at = dto.publish_at;
  if (dto.expire_at !== undefined) payload.expire_at = dto.expire_at;
  if (dto.updated_by !== undefined) payload.updated_by = dto.updated_by;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("announcements")
    .update(payload)
    .eq("id", id)
    .select(`
      *,
      properties:property_id (id, property_name_th, property_name_en)
    `)
    .single();

  if (error) {
    console.error(`Error updating announcement ${id}:`, error);
    return null;
  }

  return mapToAnnouncement(data as AnnouncementDbRow);
}

export async function archive(id: string, updatedBy?: string | null): Promise<boolean> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("announcements")
    .update({
      deleted_at: new Date().toISOString(),
      status: "ARCHIVED",
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error(`Error archiving announcement ${id}:`, error);
    return false;
  }

  return true;
}
