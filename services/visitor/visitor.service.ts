import * as visitorRepository from "@/repositories/visitor/visitor.repository";
import * as unitRepository from "@/repositories/unit/unit.repository";
import { occupancyService } from "@/services/occupancy/occupancy.service";
import { Visitor, CheckInVisitorDto } from "@/features/visitor/types/visitor.types";

function generateVisitorNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VIS-${dateStr}-${randomStr}`;
}

export const visitorService = {
  async getVisitors(): Promise<Visitor[]> {
    return visitorRepository.findAll();
  },

  async getVisitor(id: string): Promise<Visitor | null> {
    if (!id) throw new Error("Visitor ID is required");
    return visitorRepository.findById(id);
  },

  async checkInVisitor(dto: CheckInVisitorDto): Promise<Visitor> {
    if (!dto.unit_id) throw new Error("Unit is required");
    if (!dto.visitor_name || dto.visitor_name.trim() === "") throw new Error("Visitor name is required");
    if (!dto.purpose || dto.purpose.trim() === "") throw new Error("Visit purpose is required");

    const nameTrimmed = dto.visitor_name.trim();

    // 1. Verify Unit exists
    const unit = await unitRepository.findById(dto.unit_id);
    if (!unit) {
      throw new Error("Target Unit does not exist");
    }

    // 2. Verify Unit has active occupancy
    const occupancies = await occupancyService.getOccupanciesByUnit(dto.unit_id);
    const activeOccs = occupancies.filter((o) => o.status === "ACTIVE");
    if (activeOccs.length === 0) {
      throw new Error("Unit must have at least one active occupancy to register a visitor");
    }

    // 3. Prevent duplicate active visitor with identical name, unit, within 5 minutes (300 seconds)
    const duplicate = await visitorRepository.findDuplicateActive(nameTrimmed, dto.unit_id, 300);
    if (duplicate) {
      throw new Error(`A visitor named "${nameTrimmed}" is already checked into Unit ${unit.unit_number} recently.`);
    }

    // Set first active occupancy's ID if not provided
    const occupancyId = dto.occupancy_id || activeOccs[0].id;
    const visitorNum = generateVisitorNumber();

    return visitorRepository.create({
      ...dto,
      visitor_name: nameTrimmed,
      phone: dto.phone ? dto.phone.trim() : null,
      purpose: dto.purpose.trim(),
      vehicle_plate: dto.vehicle_plate ? dto.vehicle_plate.trim() : null,
      company: dto.company ? dto.company.trim() : null,
      remarks: dto.remarks ? dto.remarks.trim() : null,
      occupancy_id: occupancyId,
    }, visitorNum);
  },

  async checkOutVisitor(id: string): Promise<Visitor | null> {
    if (!id) throw new Error("Visitor ID is required");
    return visitorRepository.checkOut(id);
  }
};
