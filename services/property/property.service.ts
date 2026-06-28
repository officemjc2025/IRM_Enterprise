import * as propertyRepository from "@/repositories/property/property.repository";
import { Property, CreatePropertyDto, UpdatePropertyDto } from "@/features/property/types/property.types";

export const propertyService = {
  async getAll(): Promise<Property[]> {
    return propertyRepository.findAll();
  },

  async getById(id: string): Promise<Property | null> {
    if (!id) throw new Error("Property ID is required");
    return propertyRepository.findById(id);
  },

  async create(dto: CreatePropertyDto): Promise<Property> {
    if (!dto.code || dto.code.trim() === "") {
      throw new Error("Property code is required");
    }
    if (!dto.name_th || dto.name_th.trim() === "") {
      throw new Error("Property name (TH) is required");
    }
    return propertyRepository.create(dto);
  },

  async update(id: string, dto: UpdatePropertyDto): Promise<Property | null> {
    if (!id) throw new Error("Property ID is required");
    
    // Validation for updates if fields are provided
    if (dto.code !== undefined && dto.code.trim() === "") {
      throw new Error("Property code cannot be empty");
    }
    if (dto.name_th !== undefined && dto.name_th.trim() === "") {
      throw new Error("Property name (TH) cannot be empty");
    }
    
    return propertyRepository.update(id, dto);
  },

  async archive(id: string): Promise<boolean> {
    if (!id) throw new Error("Property ID is required");
    return propertyRepository.archive(id);
  }
};
