import { ImportSchema } from "../types/import.types";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const personSchema: ImportSchema = {
  moduleName: "person",
  worksheetName: "Persons",
  requiredFields: ["person_code", "full_name"],
  optionalFields: ["display_name", "phone", "email", "person_type", "status"],
  defaultMappings: {
    person_code: ["person_code", "code", "personcode", "id"],
    full_name: ["full_name", "fullname", "name", "full name"],
    display_name: ["display_name", "displayname", "nickname", "display name"],
    phone: ["phone", "tel", "telephone", "mobile"],
    email: ["email", "mail"],
    person_type: ["person_type", "type", "persontype", "person type"],
    status: ["status"],
  },
  validationRules: {
    person_code: (val) => (val ? null : "Person code is required"),
    full_name: (val) => (val ? null : "Full name is required"),
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
