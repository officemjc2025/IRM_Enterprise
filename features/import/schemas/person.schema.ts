import { ImportSchema } from "../types/import.types";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const personSchema: ImportSchema = {
  moduleName: "person",
  worksheetName: "Persons",
  requiredFields: ["full_name"],
  optionalFields: ["phone", "email", "passport_no", "national_id"],
  defaultMappings: {
    full_name: ["fullname", "name"],
    phone: ["phone", "tel", "telephone", "mobile"],
    email: ["email", "mail"],
    passport_no: ["passport", "passportno"],
    national_id: ["nationalid", "idcard", "idnumber"],
  },
  validationRules: {
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
  },
};
