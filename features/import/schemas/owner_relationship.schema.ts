import { ImportSchema } from "../types/import.types";

function isValidDate(dateStr: string): boolean {
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

export const ownerRelationshipSchema: ImportSchema = {
  moduleName: "owner_relationship",
  worksheetName: "Owners",
  requiredFields: ["unit_number", "person_code"],
  optionalFields: ["ownership_ratio", "owner_type", "move_in_date", "move_out_date", "status", "remark"],
  defaultMappings: {
    unit_number: ["unit_number", "roomno", "room", "unit", "unitno", "unitnumber", "room_no"],
    person_code: ["person_code", "person", "personcode", "owner_code", "ownercode", "id"],
    ownership_ratio: ["ratio", "ownership_ratio", "percent", "ownership_percent", "percentage", "ownership_percentage"],
    owner_type: ["owner_type", "type", "ownership_type", "ownershiptype"],
    move_in_date: ["move_in_date", "start_date", "startdate", "movein"],
    move_out_date: ["move_out_date", "end_date", "enddate", "moveout"],
    status: ["status"],
    remark: ["remark", "remarks", "note", "notes", "comment"],
  },
  validationRules: {
    unit_number: (val) => (val ? null : "Unit number is required"),
    person_code: (val) => (val ? null : "Person/Owner code is required"),
    ownership_ratio: (val) => {
      if (!val) return null;
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 100) {
        return `Ownership percentage must be between 0 and 100: '${val}'`;
      }
      return null;
    },
    move_in_date: (val) => {
      if (!val) return null;
      if (!isValidDate(val)) return "Invalid start date format";
      return null;
    },
    move_out_date: (val) => {
      if (!val) return null;
      if (!isValidDate(val)) return "Invalid end date format";
      return null;
    },
    status: (val) => {
      if (!val) return null;
      const upper = val.toUpperCase();
      if (upper !== "ACTIVE" && upper !== "INACTIVE") {
        return "Status must be either 'ACTIVE' or 'INACTIVE'";
      }
      return null;
    }
  },
};
