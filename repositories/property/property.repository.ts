import { Property, CreatePropertyDto, UpdatePropertyDto } from "@/features/property/types/property.types";

// Skeleton implementation returning mocks or empty promises to satisfy compiler
export async function findAll(): Promise<Property[]> {
  return [];
}

export async function findById(id: string): Promise<Property | null> {
  console.log("Finding property by id:", id);
  return null;
}

export async function create(dto: CreatePropertyDto): Promise<Property> {
  console.log("Creating property with dto:", dto);
  throw new Error("Not implemented");
}

export async function update(id: string, dto: UpdatePropertyDto): Promise<Property | null> {
  console.log("Updating property with id:", id, "dto:", dto);
  return null;
}

export async function archive(id: string): Promise<boolean> {
  console.log("Archiving property with id:", id);
  return false;
}
