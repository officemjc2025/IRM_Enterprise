import { ImportSchema } from "../types/import.types";

export const propertySchema: ImportSchema = {
  moduleName: "property",
  worksheetName: "Properties",
  requiredFields: ["property_code", "property_name"],
  optionalFields: [],
  defaultMappings: {
    property_code: ["code", "propcode", "propertycode"],
    property_name: ["name", "propname", "propertyname"],
  },
  validationRules: {
    property_code: (val) => (val ? null : "Property code is required"),
    property_name: (val) => (val ? null : "Property name is required"),
  },
};
