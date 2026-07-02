import * as visitorRepository from "@/repositories/visitor/visitor.repository";
import { Visitor, VisitorStatus, CreateVisitorDto, UpdateVisitorDto } from "@/features/visitor/types/visitor.types";

const ALLOWED_TRANSITIONS: Record<VisitorStatus, VisitorStatus[]> = {
  CREATED: ["APPROVED", "CANCELLED"],
  APPROVED: ["CHECKED_IN", "INSIDE", "CANCELLED"],
  CHECKED_IN: ["INSIDE"],
  INSIDE: ["CHECKED_OUT", "CLOSED"],
  CHECKED_OUT: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export const visitorService = {
  async getTodayVisitors(): Promise<Visitor[]> {
    return visitorRepository.findToday();
  },

  async getQueueVisitors(): Promise<Visitor[]> {
    return visitorRepository.findQueue();
  },

  async getHistoryVisitors(): Promise<Visitor[]> {
    return visitorRepository.findHistory();
  },

  async getVisitorByCode(visitorCode: string): Promise<Visitor | null> {
    return visitorRepository.findByCode(visitorCode);
  },

  async getVisitorById(id: string): Promise<Visitor | null> {
    return visitorRepository.findById(id);
  },

  async createVisitor(dto: CreateVisitorDto): Promise<Visitor> {
    if (!dto.resident_assignment_id) {
      throw new Error("Resident assignment ID is required");
    }
    if (!dto.visitor_name || dto.visitor_name.trim() === "") {
      throw new Error("Visitor name is required");
    }
    if (!dto.visit_date) {
      throw new Error("Visit date is required");
    }

    // Business rule: Prevent duplicate ACTIVE session for same Resident, Visitor, Visit Date
    const active = await visitorRepository.findActiveSession(
      dto.resident_assignment_id,
      dto.visitor_name.trim(),
      dto.visit_date
    );

    if (active) {
      throw new Error("An active visitor request already exists for this resident, visitor, and date.");
    }

    return visitorRepository.create({
      ...dto,
      visitor_name: dto.visitor_name.trim(),
      status: "CREATED",
    });
  },

  async updateVisitor(id: string, dto: UpdateVisitorDto): Promise<Visitor | null> {
    const existing = await visitorRepository.findById(id);
    if (!existing) {
      throw new Error("Visitor not found");
    }

    // State transition validation
    if (dto.status && dto.status !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new Error(`Invalid status transition from ${existing.status} to ${dto.status}`);
      }
    }

    return visitorRepository.update(id, dto);
  },

  async closeVisitor(id: string, updatedBy?: string | null): Promise<boolean> {
    const existing = await visitorRepository.findById(id);
    if (!existing) {
      throw new Error("Visitor not found");
    }

    // Validate if it can transition to CLOSED/CHECKED_OUT/CLOSED
    const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
    if (!allowed.includes("CLOSED")) {
      throw new Error(`Cannot close visitor from status ${existing.status}`);
    }

    return visitorRepository.close(id, updatedBy);
  },
};
