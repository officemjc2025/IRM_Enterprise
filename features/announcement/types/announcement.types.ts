
export type AnnouncementPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Announcement {
  id: string;
  property_id: string | null;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  is_pinned: boolean;
  publish_at: string | null;
  expire_at: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;

  property?: {
    id: string;
    property_name_th: string;
    property_name_en: string | null;
  } | null;
}

export interface CreateAnnouncementDto {
  property_id?: string | null;
  title: string;
  content: string;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
  is_pinned?: boolean;
  publish_at?: string | null;
  expire_at?: string | null;
  created_by?: string | null;
}

export interface UpdateAnnouncementDto {
  property_id?: string | null;
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
  is_pinned?: boolean;
  publish_at?: string | null;
  expire_at?: string | null;
  updated_by?: string | null;
}
