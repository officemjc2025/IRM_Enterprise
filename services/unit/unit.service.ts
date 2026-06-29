import * as unitRepository from "@/repositories/unit/unit.repository";
import { Unit, CreateUnitDto, UpdateUnitDto } from "@/features/unit/types/unit.types";

export const unitService = {
  async getUnits(): Promise<Unit[]> {
    return unitRepository.findAll();
  },

  async getUnit(id: string): Promise<Unit | null> {
    if (!id) throw new Error("Unit ID is required");
    return unitRepository.findById(id);
  },

  async createUnit(dto: CreateUnitDto): Promise<Unit> {
    if (!dto.property_id) {
      throw new Error("Property is required");
    }
    if (!dto.unit_number || dto.unit_number.trim() === "") {
      throw new Error("Unit number is required");
    }
    if (!dto.floor || dto.floor.trim() === "") {
      throw new Error("Floor is required");
    }
    if (dto.area <= 0) {
      throw new Error("Area must be greater than 0");
    }
    if (dto.ownership_ratio < 0) {
      throw new Error("Ownership ratio must be non-negative");
    }

    return unitRepository.create({
      ...dto,
      unit_number: dto.unit_number.trim(),
      floor: dto.floor.trim(),
      building_code: dto.building_code ? dto.building_code.trim() : "",
    });
  },

  async updateUnit(id: string, dto: UpdateUnitDto): Promise<Unit | null> {
    if (!id) throw new Error("Unit ID is required");

    if (dto.unit_number !== undefined && dto.unit_number.trim() === "") {
      throw new Error("Unit number cannot be empty");
    }
    if (dto.floor !== undefined && dto.floor.trim() === "") {
      throw new Error("Floor cannot be empty");
    }
    if (dto.area !== undefined && dto.area <= 0) {
      throw new Error("Area must be greater than 0");
    }
    if (dto.ownership_ratio !== undefined && dto.ownership_ratio < 0) {
      throw new Error("Ownership ratio must be non-negative");
    }

    const payload: UpdateUnitDto = { ...dto };
    if (dto.unit_number !== undefined) payload.unit_number = dto.unit_number.trim();
    if (dto.floor !== undefined) payload.floor = dto.floor.trim();
    if (dto.building_code !== undefined) payload.building_code = dto.building_code.trim();

    return unitRepository.update(id, payload);
  },

  async archiveUnit(id: string): Promise<boolean> {
    if (!id) throw new Error("Unit ID is required");
    return unitRepository.archive(id);
  }
};
