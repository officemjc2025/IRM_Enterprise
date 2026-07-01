import { ImportSchema } from "../types/import.types";

export const occupancySchema: ImportSchema = {
  moduleName: "occupancy",
  worksheetName: "Occupancies",
  requiredFields: ["unit_number", "person_code", "occupancy_type"],
  optionalFields: [],
  defaultMappings: {
    unit_number: ["roomno", "room", "unit", "unitno", "unitnumber"],
    person_code: ["person", "personcode"],
    occupancy_type: ["type", "occupancytype"],
  },
  validationRules: {
    unit_number: (val) => (val ? null : "Unit number is required"),
    person_code: (val) => (val ? null : "Person code is required"),
    occupancy_type: (val) => (val ? null : "Occupancy type is required"),
  },
};
