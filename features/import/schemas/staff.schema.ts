import { ImportSchema } from "../types/import.types";

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const staffSchema: ImportSchema = {
  moduleName: "staff",
  worksheetName: "Staff",
  requiredFields: ["first_name", "last_name", "email", "role"],
  optionalFields: [
    "employee_code",
    "prefix",
    "nickname",
    "display_name",
    "phone",
    "role",
    "department",
    "team",
    "property_code",
    "language",
    "account_status",
    "send_invitation",
    "photo_url"
  ],
  defaultMappings: {
    employee_code: ["employee_code", "code", "employeecode", "emp_code", "empcode"],
    prefix: ["prefix", "title", "prefix_name"],
    first_name: ["first_name", "firstname", "first name"],
    last_name: ["last_name", "lastname", "last name"],
    nickname: ["nickname", "nick_name", "nick"],
    display_name: ["display_name", "displayname", "display name"],
    email: ["email", "mail", "email_address", "emailaddress"],
    phone: ["phone", "tel", "telephone", "mobile"],
    role: ["role", "user_role", "userrole"],
    department: ["department", "dept"],
    team: ["team", "team_name", "teamname"],
    property_code: ["property_code", "propertycode", "property", "project"],
    language: ["language", "lang", "locale"],
    account_status: ["account_status", "accountstatus", "status"],
    send_invitation: ["send_invitation", "sendinvitation", "invite", "send_invite"],
    photo_url: ["photo_url", "photourl", "photo", "image", "avatar"]
  },
  validationRules: {
    first_name: (val) => (val ? null : "First name is required"),
    last_name: (val) => (val ? null : "Last name is required"),
    role: (val) => {
      if (!val) return "Role is required";
      const validRoles = [
        "super_admin", "admin", "property_admin", "office", 
        "security", "technician", "housekeeping", "committee"
      ];
      if (!validRoles.includes(val.toLowerCase().trim())) {
        return `Invalid role '${val}'. Must be one of: ${validRoles.join(", ")}`;
      }
      return null;
    },
    email: (val) => {
      if (!val) return "Email is required";
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
    department: (val) => {
      if (!val) return null;
      const validDepts = ["Administration", "Office", "Engineering", "Housekeeping", "Security", "Committee"];
      const trimmed = val.trim();
      const matched = validDepts.find(d => d.toLowerCase() === trimmed.toLowerCase());
      if (!matched) {
        return `Department must be one of: ${validDepts.join(", ")}`;
      }
      return null;
    }
  },
};
