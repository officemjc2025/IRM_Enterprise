import * as ownershipRepository from "@/repositories/ownership/ownership.repository";
import { Ownership, CreateOwnershipDto, UpdateOwnershipDto } from "@/features/ownership/types/ownership.types";

export const ownershipService = {
  async getOwnerships(): Promise<Ownership[]> {
    return ownershipRepository.findAll();
  },

  async getOwnership(id: string): Promise<Ownership | null> {
    if (!id) throw new Error("Ownership ID is required");
    return ownershipRepository.findById(id);
  },

  async createOwnership(dto: CreateOwnershipDto): Promise<Ownership> {
    if (!dto.person_id) {
      throw new Error("Person is required");
    }
    if (!dto.unit_id) {
      throw new Error("Unit is required");
    }
    if (dto.ownership_percentage < 0 || dto.ownership_percentage > 100) {
      throw new Error("Ownership percentage must be between 0 and 100");
    }
    if (!dto.start_date) {
      throw new Error("Start date is required");
    }

    // Duplication Check
    const duplicate = await ownershipRepository.findDuplicate(dto.person_id, dto.unit_id);
    if (duplicate) {
      throw new Error("Active ownership assignment already exists for this person and unit");
    }

    return ownershipRepository.create(dto);
  },

  async updateOwnership(id: string, dto: UpdateOwnershipDto): Promise<Ownership | null> {
    if (!id) throw new Error("Ownership ID is required");

    if (dto.ownership_percentage !== undefined && (dto.ownership_percentage < 0 || dto.ownership_percentage > 100)) {
      throw new Error("Ownership percentage must be between 0 and 100");
    }

    if (dto.person_id || dto.unit_id) {
      const current = await ownershipRepository.findById(id);
      if (current) {
        const checkPerson = dto.person_id || current.person_id;
        const checkUnit = dto.unit_id || current.unit_id;
        if (checkPerson !== current.person_id || checkUnit !== current.unit_id) {
          const duplicate = await ownershipRepository.findDuplicate(checkPerson, checkUnit);
          if (duplicate && duplicate.id !== id) {
            throw new Error("Active ownership assignment already exists for this person and unit");
          }
        }
      }
    }

    return ownershipRepository.update(id, dto);
  },

  async archiveOwnership(id: string): Promise<boolean> {
    if (!id) throw new Error("Ownership ID is required");
    return ownershipRepository.archive(id);
  }
};
export default ownershipService;
