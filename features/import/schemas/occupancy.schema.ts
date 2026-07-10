import { ImportSchema } from "../types/import.types";

function isValidDate(dateStr: string): boolean {
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

export const occupancySchema: ImportSchema = {
  moduleName: "occupancy",
  worksheetName: "Occupancies",
  requiredFields: ["unit_number", "full_name", "occupancy_type", "move_in_date"],
  optionalFields: ["phone", "email", "move_out_date", "remark"],
  defaultMappings: {
    unit_number: ["unit_number", "roomno", "room", "unit", "unitno", "unitnumber", "room_number"],
    full_name: ["full_name", "fullname", "name", "occupant_name", "resident_name"],
    phone: ["phone", "tel", "telephone", "mobile", "phone_number"],
    email: ["email", "mail", "email_address"],
    occupancy_type: ["occupancy_type", "type", "occupancytype", "status"],
    move_in_date: ["move_in_date", "movein", "moveindate", "move_in", "start_date", "startdate"],
    move_out_date: ["move_out_date", "moveout", "moveoutdate", "move_out", "end_date", "enddate"],
    remark: ["remark", "remarks", "note", "notes", "comment"],
  },
  validationRules: {
    unit_number: (val) => (val ? null : "Unit number is required"),
    full_name: (val) => (val ? null : "Full name is required"),
    occupancy_type: (val) => {
      if (!val) return "Occupancy type is required";
      const upper = val.toUpperCase();
      const validTypes = ["OWNER", "CO_OWNER", "FAMILY_MEMBER", "TENANT", "RESIDENT", "STAFF", "COMPANY"];
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
  },
};
