import * as propertyRepository from "@/repositories/property/property.repository";
import { Property, CreatePropertyDto, UpdatePropertyDto } from "@/features/property/types/property.types";

export const propertyService = {
  async getAll(): Promise<Property[]> {
    return propertyRepository.findAll();
  },

  async getById(id: string): Promise<Property | null> {
    return propertyRepository.findById(id);
  },

  async create(dto: CreatePropertyDto): Promise<Property> {
    return propertyRepository.create(dto);
  },

  async update(id: string, dto: UpdatePropertyDto): Promise<Property | null> {
    return propertyRepository.update(id, dto);
  },

  async archive(id: string): Promise<boolean> {
    return propertyRepository.archive(id);
  }
};
