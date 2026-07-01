import * as residentAssignmentRepository from "@/repositories/resident-assignment/resident-assignment.repository";
import { ResidentAssignment, CreateResidentAssignmentDto, UpdateResidentAssignmentDto } from "@/features/resident-assignment/types/resident-assignment.types";
import { Status } from "@/shared/enums/status";

export const residentAssignmentService = {
  async getAssignments(): Promise<ResidentAssignment[]> {
    return residentAssignmentRepository.findAll();
  },

  async getAssignment(id: string): Promise<ResidentAssignment | null> {
    if (!id) throw new Error("Assignment ID is required");
    return residentAssignmentRepository.findById(id);
  },

  async getAssignmentsByPerson(personId: string): Promise<ResidentAssignment[]> {
    if (!personId) throw new Error("Person ID is required");
    return residentAssignmentRepository.findByPersonId(personId);
  },

  async getAssignmentsByUnit(unitId: string): Promise<ResidentAssignment[]> {
    if (!unitId) throw new Error("Unit ID is required");
    return residentAssignmentRepository.findByUnitId(unitId);
  },

  async createAssignment(dto: CreateResidentAssignmentDto): Promise<ResidentAssignment> {
    if (!dto.unit_id) throw new Error("Unit is required");
    if (!dto.person_id) throw new Error("Person is required");
    if (!dto.occupancy_type) throw new Error("Occupancy type is required");
    if (!dto.move_in_date) throw new Error("Move-in date is required");

    const isStatusActive = (dto.status || Status.ACTIVE) === Status.ACTIVE;
    if (isStatusActive) {
      const duplicate = await residentAssignmentRepository.findDuplicateActive(dto.person_id, dto.unit_id);
      if (duplicate) {
        throw new Error("This person is already assigned as an active resident to this unit.");
      }
    }

    const payload = { ...dto };
    if (dto.move_out_date && dto.move_out_date.trim() !== "") {
      payload.status = Status.INACTIVE;
    }

    return residentAssignmentRepository.create(payload);
  },

  async updateAssignment(id: string, dto: UpdateResidentAssignmentDto): Promise<ResidentAssignment | null> {
    if (!id) throw new Error("Assignment ID is required");

    const existing = await residentAssignmentRepository.findById(id);
    if (!existing) throw new Error("Resident assignment not found");

    const personId = dto.person_id !== undefined ? dto.person_id : existing.person_id;
    const unitId = dto.unit_id !== undefined ? dto.unit_id : existing.unit_id;
    
    let newStatus = dto.status !== undefined ? dto.status : existing.status;
    if (dto.move_out_date !== undefined && dto.move_out_date !== null && dto.move_out_date.trim() !== "") {
      newStatus = Status.INACTIVE;
    }

    if (newStatus === Status.ACTIVE) {
      const duplicate = await residentAssignmentRepository.findDuplicateActive(personId, unitId);
      if (duplicate && duplicate.id !== id) {
        throw new Error("This person is already assigned as an active resident to this unit.");
      }
    }

    const payload = { ...dto };
    if (dto.move_out_date !== undefined && dto.move_out_date !== null && dto.move_out_date.trim() !== "") {
      payload.status = Status.INACTIVE;
    }

    return residentAssignmentRepository.update(id, payload);
  },

  async archiveAssignment(id: string): Promise<boolean> {
    if (!id) throw new Error("Assignment ID is required");
    return residentAssignmentRepository.archive(id);
  }
};
