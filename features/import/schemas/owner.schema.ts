import { ImportSchema } from "../types/import.types";

export const ownerSchema: ImportSchema = {
  moduleName: "owner",
  worksheetName: "Owners",
  requiredFields: ["owner_code", "owner_name"],
  optionalFields: [],
  defaultMappings: {
    owner_code: ["code", "ownercode"],
    owner_name: ["name", "ownername"],
  },
  validationRules: {
    owner_code: (val) => (val ? null : "Owner code is required"),
    owner_name: (val) => (val ? null : "Owner name is required"),
  },
};
