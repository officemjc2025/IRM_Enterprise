import { ImportSchema } from "../types/import.types";
import { propertySchema } from "./property.schema";
import { unitSchema } from "./unit.schema";
import { personSchema } from "./person.schema";
import { ownerSchema } from "./owner.schema";
import { occupancySchema } from "./occupancy.schema";
import { ownerRelationshipSchema } from "./owner_relationship.schema";
import { combinedMetroSchema } from "./combined_metro.schema";
import { staffSchema } from "./staff.schema";

export const schemas: Record<string, ImportSchema> = {
  property: propertySchema,
  unit: unitSchema,
  person: personSchema,
  owner: ownerSchema,
  occupancy: occupancySchema,
  owner_relationship: ownerRelationshipSchema,
  combined_metro: combinedMetroSchema,
  staff: staffSchema,
};

export function getSchema(moduleName: string): ImportSchema {
  const schema = schemas[moduleName];
  if (!schema) {
    throw new Error(`Import schema not found for module: ${moduleName}`);
  }
  return schema;
}

export * from "./property.schema";
export * from "./unit.schema";
export * from "./person.schema";
export * from "./owner.schema";
export * from "./occupancy.schema";
export * from "./owner_relationship.schema";
export * from "./combined_metro.schema";
export * from "./staff.schema";
