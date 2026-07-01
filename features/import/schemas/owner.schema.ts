import { ImportSchema } from "../types/import.types";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const ownerSchema: ImportSchema = {
  moduleName: "owner",
  worksheetName: "Owners",
  requiredFields: ["owner_code", "owner_name"],
  optionalFields: ["phone", "email", "owner_type", "status"],
  defaultMappings: {
    owner_code: ["owner_code", "code", "ownercode", "id"],
    owner_name: ["owner_name", "ownername", "name", "full_name", "fullname"],
    phone: ["phone", "tel", "telephone", "mobile"],
    email: ["email", "mail"],
    owner_type: ["owner_type", "type", "ownertype"],
    status: ["status"],
  },
  validationRules: {
    owner_code: (val) => (val ? null : "Owner code is required"),
    owner_name: (val) => (val ? null : "Owner name is required"),
    email: (val) => {
      if (!val) return null;
      if (!isValidEmail(val)) {
        return `Invalid email format: '${val}'`;
      }
      return null;
    },
    phone: (val) => {
      if (!val) return null;
      const digitsOnly = val.replace(/\D/g, "");
      if (digitsOnly.length < 8) {
        return `Phone number is too short (min 8 digits): '${val}'`;
      }
      return null;
    },
    status: (val) => {
      if (!val) return null;
      const upper = val.toUpperCase();
      if (upper !== "ACTIVE" && upper !== "INACTIVE") {
        return `Status must be either 'ACTIVE' or 'INACTIVE': '${val}'`;
      }
      return null;
    }
  },
};
