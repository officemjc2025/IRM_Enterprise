import * as occupancyRepository from "@/repositories/occupancy/occupancy.repository";
import { Occupancy, CreateOccupancyDto, UpdateOccupancyDto, OCCUPANCY_TYPES } from "@/features/occupancy/types/occupancy.types";

export const occupancyService = {
  async getOccupancies(): Promise<Occupancy[]> {
    return occupancyRepository.findAll();
  },

  async getOccupancy(id: string): Promise<Occupancy | null> {
    if (!id) throw new Error("Occupancy ID is required");
    return occupancyRepository.findById(id);
  },

  async getOccupanciesByPerson(personId: string): Promise<Occupancy[]> {
    if (!personId) throw new Error("Person ID is required");
    return occupancyRepository.findByPersonId(personId);
  },

  async getOccupanciesByUnit(unitId: string): Promise<Occupancy[]> {
    if (!unitId) throw new Error("Unit ID is required");
    return occupancyRepository.findByUnitId(unitId);
  },

  async createOccupancy(dto: CreateOccupancyDto): Promise<Occupancy> {
    if (!dto.unit_id) throw new Error("Unit is required");
    if (!dto.person_id) throw new Error("Person is required");
    if (!dto.occupancy_type) throw new Error("Occupancy type is required");
    if (!dto.start_date) throw new Error("Start date is required");

    if (!OCCUPANCY_TYPES.includes(dto.occupancy_type)) {
      throw new Error(`Invalid occupancy type: ${dto.occupancy_type}`);
    }

    if (dto.end_date && dto.end_date < dto.start_date) {
      throw new Error("End date must be greater than or equal to start date");
    }

    if (dto.occupancy_type === "OWNER" && dto.status !== "inactive") {
      const existing = await occupancyRepository.findByUnitId(dto.unit_id);
      const activeOwnerExists = existing.some(
        (o) => o.occupancy_type === "OWNER" && o.status === "active"
      );
      if (activeOwnerExists) {
        throw new Error("Unit already has an active OWNER assignment");
      }
    }

    if (dto.status !== "inactive") {
      const existing = await occupancyRepository.findByPersonId(dto.person_id);
      const duplicateActiveExists = existing.some(
        (o) =>
          o.unit_id === dto.unit_id &&
          o.occupancy_type === dto.occupancy_type &&
          o.status === "active"
      );
      if (duplicateActiveExists) {
        throw new Error(`Person already has an active ${dto.occupancy_type} assignment for this unit`);
      }
    }

    return occupancyRepository.create(dto);
  },

  async updateOccupancy(id: string, dto: UpdateOccupancyDto): Promise<Occupancy | null> {
    if (!id) throw new Error("Occupancy ID is required");

    const existing = await occupancyRepository.findById(id);
    if (!existing) throw new Error("Occupancy record not found");

    const newType = dto.occupancy_type !== undefined ? dto.occupancy_type : existing.occupancy_type;
    const newStatus = dto.status !== undefined ? dto.status : existing.status;
    const newUnitId = dto.unit_id !== undefined ? dto.unit_id : existing.unit_id;
    const newPersonId = dto.person_id !== undefined ? dto.person_id : existing.person_id;
    const newStartDate = dto.start_date !== undefined ? dto.start_date : existing.start_date;
    const newEndDate = dto.end_date !== undefined ? dto.end_date : existing.end_date;

    if (newType !== undefined && !OCCUPANCY_TYPES.includes(newType)) {
      throw new Error(`Invalid occupancy type: ${newType}`);
    }

    if (newEndDate && newEndDate < newStartDate) {
      throw new Error("End date must be greater than or equal to start date");
    }

    if (newType === "OWNER" && newStatus === "active") {
      const sameUnit = await occupancyRepository.findByUnitId(newUnitId);
      const activeOwnerExists = sameUnit.some(
        (o) => o.occupancy_type === "OWNER" && o.status === "active" && o.id !== id
      );
      if (activeOwnerExists) {
        throw new Error("Unit already has an active OWNER assignment");
      }
    }

    if (newStatus === "active") {
      const samePerson = await occupancyRepository.findByPersonId(newPersonId);
      const duplicateActiveExists = samePerson.some(
        (o) =>
          o.unit_id === newUnitId &&
          o.occupancy_type === newType &&
          o.status === "active" &&
          o.id !== id
      );
      if (duplicateActiveExists) {
        throw new Error(`Person already has an active ${newType} assignment for this unit`);
      }
    }

    return occupancyRepository.update(id, dto);
  },

  async archiveOccupancy(id: string): Promise<boolean> {
    if (!id) throw new Error("Occupancy ID is required");
    return occupancyRepository.archive(id);
  }
};

