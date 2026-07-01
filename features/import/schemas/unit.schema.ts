import { ImportSchema } from "../types/import.types";

export const unitSchema: ImportSchema = {
  moduleName: "unit",
  worksheetName: "Units",
  requiredFields: ["unit_number", "floor", "status"],
  optionalFields: ["property_code", "building_code", "area", "ownership_ratio", "remark"],
  defaultMappings: {
    property_code: ["code", "propcode", "propertycode"],
    building_code: ["building", "bldg", "buildingcode"],
    floor: ["floor", "level"],
    unit_number: ["roomno", "room", "unit", "unitno", "unitnumber"],
    area: ["area", "size", "sqm", "sq_m"],
    ownership_ratio: ["ratio", "ownershipratio", "ownership", "share"],
    status: ["status", "active"],
    remark: ["remark", "note", "comment"],
  },
  validationRules: {
    unit_number: (val) => (val ? null : "Unit number is required"),
    floor: (val) => (val ? null : "Floor is required"),
    status: (val) => {
      if (!val) return "Status is required";
      const allowed = ["ACTIVE", "INACTIVE", "MAINTENANCE"];
      const upper = val.toUpperCase().replace(/\s+/g, "_");
      if (!allowed.includes(upper)) {
        return `Status must be one of: ${allowed.join(", ")}. Received: '${val}'`;
      }
      return null;
    },
    area: (val) => {
      if (!val) return null;
      const num = Number(val);
      if (isNaN(num) || num <= 0) {
        return `Area must be a positive number: '${val}'`;
      }
      return null;
    },
    ownership_ratio: (val) => {
      if (!val) return null;
      const num = Number(val);
      if (isNaN(num) || num < 0) {
        return `Ownership ratio must be a non-negative number: '${val}'`;
      }
      return null;
    },
  },
};
