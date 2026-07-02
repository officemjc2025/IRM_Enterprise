import * as announcementRepository from "@/repositories/announcement/announcement.repository";
import { Announcement, CreateAnnouncementDto, UpdateAnnouncementDto } from "@/features/announcement/types/announcement.types";

const PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => {
    // 1. Pinned first
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;

    // 2. Priority descending
    const weightA = PRIORITY_WEIGHTS[a.priority] || 0;
    const weightB = PRIORITY_WEIGHTS[b.priority] || 0;
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // 3. Publish Date DESC
    const dateA = a.publish_at ? new Date(a.publish_at).getTime() : 0;
    const dateB = b.publish_at ? new Date(b.publish_at).getTime() : 0;
    return dateB - dateA;
  });
}

export const announcementService = {
  async getAnnouncements(): Promise<Announcement[]> {
    const list = await announcementRepository.findAll();
    return sortAnnouncements(list);
  },

  async getPublishedAnnouncements(): Promise<Announcement[]> {
    const list = await announcementRepository.findPublished();
    
    // Filter expired announcements programmatically (double check timezone / local expiration check)
    const now = new Date();
    const published = list.filter((item) => {
      // Must be published status
      if (item.status !== "PUBLISHED") return false;
      
      // Must not be draft or deleted
      if (item.deleted_at) return false;
      
      // Must be after publish_at
      if (item.publish_at && new Date(item.publish_at) > now) return false;
      
      // Must not be expired
      if (item.expire_at && new Date(item.expire_at) < now) return false;
      
      return true;
    });

    return sortAnnouncements(published);
  },

  async getAnnouncementById(id: string): Promise<Announcement | null> {
    return announcementRepository.findById(id);
  },

  async createAnnouncement(dto: CreateAnnouncementDto): Promise<Announcement> {
    if (!dto.title || dto.title.trim() === "") {
      throw new Error("Title is required");
    }
    if (!dto.content || dto.content.trim() === "") {
      throw new Error("Content is required");
    }
    return announcementRepository.create(dto);
  },

  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto): Promise<Announcement | null> {
    return announcementRepository.update(id, dto);
  },

  async archiveAnnouncement(id: string, updatedBy?: string | null): Promise<boolean> {
    return announcementRepository.archive(id, updatedBy);
  },
};
