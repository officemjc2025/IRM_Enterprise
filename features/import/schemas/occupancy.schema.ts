import { ImportSchema } from "../types/import.types";

function isValidDate(dateStr: string): boolean {
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

export const occupancySchema: ImportSchema = {
  moduleName: "occupancy",
  worksheetName: "Occupancies",
  requiredFields: ["unit_number", "person_code", "occupancy_type", "move_in_date"],
  optionalFields: ["move_out_date", "primary_resident", "status", "remark"],
  defaultMappings: {
    unit_number: ["unit_number", "roomno", "room", "unit", "unitno", "unitnumber"],
    person_code: ["person_code", "person", "personcode", "occupantcode", "occupant_code"],
    occupancy_type: ["occupancy_type", "type", "occupancytype"],
    move_in_date: ["move_in_date", "movein", "moveindate", "move_in", "start_date", "startdate"],
    move_out_date: ["move_out_date", "moveout", "moveoutdate", "move_out", "end_date", "enddate"],
    primary_resident: ["primary_resident", "primary", "primaryresident", "is_primary", "isprimary"],
    status: ["status"],
    remark: ["remark", "remarks", "note", "notes", "comment"],
  },
  validationRules: {
    unit_number: (val) => (val ? null : "Unit number is required"),
    person_code: (val) => (val ? null : "Person code is required"),
    occupancy_type: (val) => {
      if (!val) return "Occupancy type is required";
      const upper = val.toUpperCase();
      const validTypes = ["OWNER", "CO_OWNER", "TENANT", "RESIDENT", "COMPANY", "VACANT"];
      if (!validTypes.includes(upper)) {
        return `Occupancy type must be one of: ${validTypes.join(", ")}`;
      }
      return null;
    },
    move_in_date: (val) => {
      if (!val) return "Move-in date is required";
      if (!isValidDate(val)) return "Invalid move-in date format";
      return null;
    },
    move_out_date: (val) => {
      if (!val) return null;
      if (!isValidDate(val)) return "Invalid move-out date format";
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
