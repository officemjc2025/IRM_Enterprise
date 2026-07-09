import { ImportSchema } from "../types/import.types";

export const combinedMetroSchema: ImportSchema = {
  moduleName: "combined_metro",
  worksheetName: "Rooms",
  requiredFields: ["unit_number"],
  optionalFields: [
    "floor",
    "owner_name",
    "area",
    "ownership_ratio",
    "occupancy_type",
    "status",
    "remark",
    "water_meter",
    "electricity_meter",
    "phone",
    "email",
    "resident_name",
  ],
  defaultMappings: {
    unit_number: ["room_no", "roomno", "room", "unit", "unitno", "unitnumber"],
    floor: ["floor", "level"],
    owner_name: ["owner_name", "ownername", "name", "fullname", "full_name"],
    area: ["area", "size", "sqm", "sq_m"],
    ownership_ratio: ["ratio", "ownershipratio", "ownership", "share", "shares"],
    occupancy_type: ["status", "occupancy_type", "type"],
    status: ["active"],
    remark: ["roomid", "remark", "note", "comment"],
    water_meter: ["water_meter", "watermeter", "water_meter_no", "water_meter_number", "water_no", "water_code"],
    electricity_meter: ["electricity_meter", "electricitymeter", "electricity_meter_no", "electricity_meter_number", "electricity_no", "electric_meter", "electric_no"],
    phone: ["phone", "tel", "telephone", "mobile", "phone_number"],
    email: ["email", "mail", "email_address"],
    resident_name: ["resident", "resident_name", "residentname", "occupant", "occupant_name"],
  },
  validationRules: {
    unit_number: (val) => (val ? null : "Room No (unit_number) is required"),
    area: (val) => {
      if (!val) return null;
      const num = Number(val);
      if (isNaN(num)) {
        return `Area must be a number: '${val}'`;
      }
      if (num < 0) {
        return `Area cannot be negative: '${val}'`;
      }
      return null;
    },
    ownership_ratio: (val) => {
      if (!val) return null;
      const num = Number(val);
      if (isNaN(num)) {
        return `Ratio must be a number: '${val}'`;
      }
      if (num < 0) {
        return `Ratio cannot be negative: '${val}'`;
      }
      return null;
    },
    occupancy_type: (val) => {
      if (!val) return null;
      const upper = val.toUpperCase();
      const allowed = ["OWNER", "MJC", "TENANT", "RESIDENT"];
      if (!allowed.includes(upper)) {
        return `Occupancy status/type must be one of: ${allowed.join(", ")}. Received: '${val}'`;
      }
      return null;
    }
  },
};
