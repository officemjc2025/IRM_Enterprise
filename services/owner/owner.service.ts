import * as ownerRepository from "@/repositories/owner/owner.repository";
import { Owner, CreateOwnerDto, UpdateOwnerDto } from "@/features/owner/types/owner.types";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const ownerService = {
  async getOwners(): Promise<Owner[]> {
    return ownerRepository.findAll();
  },

  async getOwner(id: string): Promise<Owner | null> {
    if (!id) throw new Error("Owner ID is required");
    return ownerRepository.findById(id);
  },

  async createOwner(dto: CreateOwnerDto): Promise<Owner> {
    if (!dto.full_name || dto.full_name.trim() === "") {
      throw new Error("Full name is required");
    }
    if (!dto.owner_code || dto.owner_code.trim() === "") {
      throw new Error("Owner code is required");
    }
    if (dto.email && dto.email.trim() !== "" && !isValidEmail(dto.email)) {
      throw new Error("Invalid email format");
    }
    if (dto.phone && dto.phone.trim() !== "") {
      const digitsOnly = dto.phone.replace(/\D/g, "");
      if (digitsOnly.length < 8) {
        throw new Error("Phone number must have at least 8 digits");
      }
    }

    return ownerRepository.create({
      ...dto,
      full_name: dto.full_name.trim(),
      owner_code: dto.owner_code.trim(),
      phone: dto.phone ? dto.phone.trim() : null,
      email: dto.email ? dto.email.trim().toLowerCase() : null,
      nationality: dto.nationality ? dto.nationality.trim() : null,
      tax_id: dto.tax_id ? dto.tax_id.trim() : null,
    });
  },

  async updateOwner(id: string, dto: UpdateOwnerDto): Promise<Owner | null> {
    if (!id) throw new Error("Owner ID is required");

    if (dto.full_name !== undefined && dto.full_name.trim() === "") {
      throw new Error("Full name cannot be empty");
    }
    if (dto.owner_code !== undefined && dto.owner_code.trim() === "") {
      throw new Error("Owner code cannot be empty");
    }
    if (dto.email && dto.email.trim() !== "" && !isValidEmail(dto.email)) {
      throw new Error("Invalid email format");
    }
    if (dto.phone && dto.phone.trim() !== "") {
      const digitsOnly = dto.phone.replace(/\D/g, "");
      if (digitsOnly.length < 8) {
        throw new Error("Phone number must have at least 8 digits");
      }
    }

    const payload: UpdateOwnerDto = { ...dto };
    if (dto.full_name !== undefined) payload.full_name = dto.full_name.trim();
    if (dto.owner_code !== undefined) payload.owner_code = dto.owner_code.trim();
    if (dto.phone !== undefined) payload.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.email !== undefined) payload.email = dto.email ? dto.email.trim().toLowerCase() : null;
    if (dto.nationality !== undefined) payload.nationality = dto.nationality ? dto.nationality.trim() : null;
    if (dto.tax_id !== undefined) payload.tax_id = dto.tax_id ? dto.tax_id.trim() : null;

    return ownerRepository.update(id, payload);
  },

  async archiveOwner(id: string): Promise<boolean> {
    if (!id) throw new Error("Owner ID is required");
    return ownerRepository.archive(id);
  }
};
