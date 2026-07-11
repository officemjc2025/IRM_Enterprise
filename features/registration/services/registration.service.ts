import * as registrationRepository from "../repositories/registration.repository";
import { createRegistrationRequestSchema, updateRegistrationRequestSchema } from "../schemas/registration.schema";
import {
  RegistrationRequest,
  RegistrationStatus,
  CreateRegistrationRequestDto
} from "../types/registration.types";

export const registrationService = {
  async createRegistrationRequest(dto: CreateRegistrationRequestDto): Promise<RegistrationRequest> {
    // Validate request using Zod schema
    const validatedDto = createRegistrationRequestSchema.parse(dto);

    // Call repository to insert
    return registrationRepository.create({
      ...validatedDto,
      display_name: validatedDto.display_name || `${validatedDto.first_name} ${validatedDto.last_name}`,
    });
  },

  async getRegistrationRequests(): Promise<RegistrationRequest[]> {
    return registrationRepository.findAll();
  },

  async getRegistrationRequest(id: string): Promise<RegistrationRequest | null> {
    if (!id) throw new Error("Registration request ID is required");
    return registrationRepository.findById(id);
  },

  async updateRegistrationRequestStatus(
    id: string,
    status: RegistrationStatus,
    reviewedBy: string | null,
    rejectionReason?: string | null,
    remarks?: string | null
  ): Promise<RegistrationRequest | null> {
    if (!id) throw new Error("Registration request ID is required");

    // Validate the status updates if any
    updateRegistrationRequestSchema.parse({ status, remarks });

    return registrationRepository.updateStatus(id, status, reviewedBy, rejectionReason, remarks);
  },

  // IRM Standard:
  // Transaction soft delete is Super Admin only.
  async deleteRegistrationRequest(id: string, deletedBy: string): Promise<boolean> {
    if (!id) throw new Error("Registration request ID is required");
    return registrationRepository.softDelete(id, deletedBy);
  }
};
