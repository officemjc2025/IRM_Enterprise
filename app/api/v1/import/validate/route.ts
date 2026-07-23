/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ValidationError } from "@/features/import/types/import.types";

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("66") && digits.length === 11) {
    return "0" + digits.substring(2);
  }
  if (digits.startsWith("66") && digits.length === 10) {
    return "0" + digits.substring(2);
  }
  if (digits.length === 9 && (digits.startsWith("8") || digits.startsWith("9") || digits.startsWith("6"))) {
    return "0" + digits;
  }
  return digits;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rows, mapping, moduleName, propertyId } = body as {
      rows: Record<string, unknown>[];
      mapping: Record<string, string>;
      moduleName: string;
      propertyId?: string;
    };

    if (!Array.isArray(rows) || !mapping || !moduleName) {
      return NextResponse.json({ success: false, message: "Missing required parameters" }, { status: 400 });
    }

    const reverseMapping: Record<string, string> = {};
    Object.entries(mapping).forEach(([header, field]) => {
      if (field) {
        reverseMapping[field] = header;
      }
    });

    const supabase = await createClient();

    if (moduleName === "staff") {
      const { data: dbProperties } = await supabase
        .from("properties")
        .select("id, property_code, property_name_th, property_name_en")
        .is("deleted_at", null);
      
      const propertyMap = new Map<string, any>();
      dbProperties?.forEach(p => {
        if (p.property_code) {
          propertyMap.set(p.property_code.trim().toUpperCase(), p);
        }
      });

      const { data: dbProfiles } = await supabase
        .from("profiles")
        .select("id, email, phone, role, person_id, department, status, account_status, photo_url")
        .is("deleted_at", null);

      const { data: dbPersons } = await supabase
        .from("persons")
        .select("id, person_code, first_name, last_name")
        .is("deleted_at", null);


      
      const personIdToCodeMap = new Map<string, string>();
      dbPersons?.forEach(p => {
        if (p.person_code) {
          personIdToCodeMap.set(p.id, p.person_code);
        }
      });

      const batchEmails = new Set<string>();
      const batchPhones = new Set<string>();
      const batchCodes = new Set<string>();

      const results: any[] = [];
      const allErrors: ValidationError[] = [];

      let staffCreateCount = 0;
      let staffUpdateCount = 0;
      let staffErrorCount = 0;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const errors: ValidationError[] = [];
        const conflicts: string[] = [];
        const normalizedData: Record<string, any> = {};

        Object.entries(mapping).forEach(([header, field]) => {
          if (!field) return;
          const rawValue = row[header];
          let val = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : "";
          val = val.replace(/\s+/g, " ");

          if (field === "email") {
            val = val.toLowerCase();
          } else if (field === "employee_code") {
            val = val.toUpperCase();
          } else if (field === "property_code") {
            val = val.toUpperCase();
          }
          normalizedData[field] = val || null;
        });

        // 1. Required Field Validations
        if (!normalizedData.first_name) {
          errors.push({
            rowNumber,
            column: reverseMapping.first_name || "first_name",
            message: "First Name is required",
            severity: "error"
          });
        }
        if (!normalizedData.last_name) {
          errors.push({
            rowNumber,
            column: reverseMapping.last_name || "last_name",
            message: "Last Name is required",
            severity: "error"
          });
        }
        if (!normalizedData.role) {
          errors.push({
            rowNumber,
            column: reverseMapping.role || "role",
            message: "Role is required",
            severity: "error"
          });
        } else {
          const validRoles = [
            "super_admin", "admin", "property_admin", "office", 
            "security", "technician", "housekeeping", "committee"
          ];
          if (!validRoles.includes(normalizedData.role.toLowerCase())) {
            errors.push({
              rowNumber,
              column: reverseMapping.role || "role",
              message: `Invalid role '${normalizedData.role}'. Must be one of: ${validRoles.join(", ")}`,
              severity: "error"
            });
          }
        }

        // Email validation
        const emailVal = normalizedData.email;
        if (!emailVal) {
          errors.push({
            rowNumber,
            column: reverseMapping.email || "email",
            message: "Email is required",
            severity: "error"
          });
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(emailVal)) {
            errors.push({
              rowNumber,
              column: reverseMapping.email || "email",
              message: `Invalid email format: '${emailVal}'`,
              severity: "error"
            });
          } else {
            // Batch duplicate check
            if (batchEmails.has(emailVal)) {
              errors.push({
                rowNumber,
                column: reverseMapping.email || "email",
                message: `Duplicate email '${emailVal}' in batch`,
                severity: "error"
              });
            } else {
              batchEmails.add(emailVal);
            }
          }
        }

        // Phone validation
        const phoneVal = normalizedData.phone;
        if (phoneVal) {
          const normPhone = normalizePhone(phoneVal);
          if (normPhone) {
            if (batchPhones.has(normPhone)) {
              errors.push({
                rowNumber,
                column: reverseMapping.phone || "phone",
                message: `Duplicate phone number '${phoneVal}' in batch`,
                severity: "error"
              });
            } else {
              batchPhones.add(normPhone);
            }
          }
        }

        // Department validation
        const deptVal = normalizedData.department;
        if (deptVal) {
          const validDepts = ["Administration", "Office", "Engineering", "Housekeeping", "Security", "Committee"];
          const trimmed = deptVal.trim();
          const matched = validDepts.find(d => d.toLowerCase() === trimmed.toLowerCase());
          if (!matched) {
            errors.push({
              rowNumber,
              column: reverseMapping.department || "department",
              message: `Department must be one of: ${validDepts.join(", ")}`,
              severity: "error"
            });
          } else {
            normalizedData.department = matched;
          }
        }

        // Property Code validation
        const propCode = normalizedData.property_code;
        if (propCode) {
          const resolvedProperty = propertyMap.get(propCode.toUpperCase());
          if (!resolvedProperty) {
            errors.push({
              rowNumber,
              column: reverseMapping.property_code || "property_code",
              message: `Property Code '${propCode}' not found in database`,
              severity: "error"
            });
          } else {
            normalizedData.property_id = resolvedProperty.id;
            normalizedData.property_name_th = resolvedProperty.property_name_th;
            normalizedData.property_name_en = resolvedProperty.property_name_en;
          }
        }

        // Employee Code Validation
        const empCode = normalizedData.employee_code;
        if (empCode) {
          if (batchCodes.has(empCode)) {
            errors.push({
              rowNumber,
              column: reverseMapping.employee_code || "employee_code",
              message: `Duplicate Employee Code '${empCode}' in batch`,
              severity: "error"
            });
          } else {
            batchCodes.add(empCode);
          }
        }

        // 2. Hardened Duplicate Resolution Priority & Conflict detection
        // Priority: 1 Employee Code, 2 Email, 3 Phone, 4 Name match
        let matchedProfile: any = null;

        // Priority 1: Code match
        if (empCode) {
          const matchedPerson = dbPersons?.find(p => p.person_code?.toUpperCase() === empCode);
          if (matchedPerson) {
            matchedProfile = dbProfiles?.find(p => p.person_id === matchedPerson.id);
          }
        }

        // Priority 2: Email match
        if (!matchedProfile && emailVal) {
          matchedProfile = dbProfiles?.find(p => p.email.toLowerCase() === emailVal.toLowerCase());
        }

        // Priority 3: Phone match
        if (!matchedProfile && phoneVal) {
          const normPhone = normalizePhone(phoneVal);
          if (normPhone) {
            matchedProfile = dbProfiles?.find(p => p.phone && normalizePhone(p.phone) === normPhone);
          }
        }

        // Priority 4: Existing Person (First + Last Name)
        if (!matchedProfile && normalizedData.first_name && normalizedData.last_name) {
          const fName = String(normalizedData.first_name).trim().toLowerCase();
          const lName = String(normalizedData.last_name).trim().toLowerCase();
          const matchedPerson = dbPersons?.find(p => 
            p.first_name?.trim().toLowerCase() === fName && 
            p.last_name?.trim().toLowerCase() === lName
          );
          if (matchedPerson) {
            matchedProfile = dbProfiles?.find(p => p.person_id === matchedPerson.id);
          }
        }

        // Detect conflicts separately from validation errors
        if (matchedProfile) {
          // Email mismatch (matched by code/phone/name but emails differ)
          if (emailVal && matchedProfile.email.toLowerCase() !== emailVal.toLowerCase()) {
            conflicts.push(`Conflict: Excel row email '${emailVal}' does not match existing user email '${matchedProfile.email}' for the matched staff record.`);
          }
          // Immutable code check
          const currentCode = personIdToCodeMap.get(matchedProfile.person_id || "");
          if (currentCode && empCode && empCode !== currentCode.toUpperCase()) {
            errors.push({
              rowNumber,
              column: reverseMapping.employee_code || "employee_code",
              message: `Employee Code is immutable after creation. Cannot change from '${currentCode}' to '${empCode}'`,
              severity: "error"
            });
          }
        }

        // Determine Action
        const hasErrors = errors.some(e => e.severity === "error") || conflicts.length > 0;
        let action = "CREATE";
        if (hasErrors) {
          action = "ERROR";
          staffErrorCount++;
        } else {
          if (matchedProfile) {
            action = "UPDATE";
            staffUpdateCount++;
          } else {
            action = "CREATE";
            staffCreateCount++;
          }
        }

        normalizedData.action = action;

        results.push({
          rowNumber,
          normalizedData,
          errors,
          conflicts
        });
        allErrors.push(...errors);
      });

      const summary = {
        totalRows: rows.length,
        validRows: staffCreateCount + staffUpdateCount,
        warningRows: allErrors.filter(e => e.severity === "warning").length,
        errorRows: staffErrorCount,
        importReady: staffErrorCount === 0 && rows.length > 0
      };

      const previewStats = {
        units: { create: 0, update: 0, match: 0 },
        persons: { create: 0, match: 0 },
        ownerships: { create: 0, update: 0 },
        occupancies: { create: 0, update: 0 },
        meters: { create: 0, update: 0 },
        staff: { create: staffCreateCount, update: staffUpdateCount, error: staffErrorCount }
      };

      return NextResponse.json({
        success: true,
        summary,
        results,
        allErrors,
        completeness: { unit: 0, owner: 0, resident: 0, meter: 0 },
        previewStats
      });
    }

    const { data: propertiesData } = await supabase
      .from("properties")
      .select("id, property_code")
      .is("deleted_at", null);
    const propertyCodeMap = new Map<string, string>();
    propertiesData?.forEach(p => {
      if (p.property_code) {
        propertyCodeMap.set(p.property_code.trim().toUpperCase(), p.id);
      }
    });

    // 2. Fetch existing units to identify database duplicates
    const { data: dbUnits } = await supabase
      .from("units")
      .select("id, property_id, unit_number, floor, area, ownership_ratio")
      .is("deleted_at", null);
    const dbUnitsMap = new Map<string, any>(); // "property_id:unit_number" -> unit
    dbUnits?.forEach(u => {
      if (u.property_id && u.unit_number) {
        dbUnitsMap.set(`${u.property_id}:${u.unit_number.trim().toUpperCase()}`, u);
      }
    });

    // 3. Fetch existing persons
    const { data: dbPersons } = await supabase
      .from("persons")
      .select("id, person_code, first_name, last_name, display_name, phone, email")
      .is("deleted_at", null);
    const dbPersonsByName = new Map<string, any>(); // "first_name::last_name" -> person
    dbPersons?.forEach(p => {
      const key = `${p.first_name.trim().toUpperCase()}::${(p.last_name || "-").trim().toUpperCase()}`;
      dbPersonsByName.set(key, p);
    });

    // 4. Fetch active owner assignments
    const { data: dbOwns } = await supabase
      .from("owner_assignments")
      .select("id, unit_id, person_id, ownership_percent, ownership_type, start_date, end_date, status")
      .eq("status", "ACTIVE")
      .is("deleted_at", null);
    const dbActiveOwnerships = new Set<string>(); // "unit_id:person_id"
    const dbActiveOwnershipsMap = new Map<string, any>(); // "unit_id:person_id" -> own
    dbOwns?.forEach(o => {
      dbActiveOwnerships.add(`${o.unit_id}:${o.person_id}`);
      dbActiveOwnershipsMap.set(`${o.unit_id}:${o.person_id}`, o);
    });

    // 5. Fetch active occupancies (resident assignments)
    const { data: dbOccs } = await supabase
      .from("occupancies")
      .select("id, unit_id, person_id, occupancy_type, start_date, end_date, remarks, status")
      .eq("status", "ACTIVE")
      .is("deleted_at", null);
    const dbActiveOccupanciesMap = new Map<string, any>(); // "unit_id:person_id" -> occ
    dbOccs?.forEach(o => {
      dbActiveOccupanciesMap.set(`${o.unit_id}:${o.person_id}`, o);
    });

    // 6. Fetch active utility meters
    const { data: dbMeters } = await supabase
      .from("utility_meters")
      .select("id, unit_id, utility_type, meter_number")
      .eq("meter_status", "ACTIVE");
    const dbActiveMetersMap = new Map<string, string>(); // "unit_id:utility_type" -> meter_number
    dbMeters?.forEach(m => {
      dbActiveMetersMap.set(`${m.unit_id}:${m.utility_type}`, m.meter_number);
    });

    const results: any[] = [];
    const allErrors: ValidationError[] = [];

    const unitNumberTracker: Record<string, number[]> = {};
    const roomIdTracker: Record<string, number[]> = {};

    // Map of headers mapping detection for phone/email existence
    const mappedFields = Object.values(mapping);

    // Row Loop
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors: ValidationError[] = [];
      const normalizedData: Record<string, any> = {};

      Object.entries(mapping).forEach(([header, field]) => {
        if (!field) return;
        const rawValue = row[header];
        let val = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : "";
        val = val.replace(/\s+/g, " ");

        if (field === "unit_number") {
          val = val.toUpperCase();
          if (val) {
            if (!unitNumberTracker[val]) unitNumberTracker[val] = [];
            unitNumberTracker[val].push(rowNumber);
          }
        } else if (field === "email") {
          val = val.toLowerCase();
        } else if (field === "status") {
          val = val.toUpperCase();
        }

        normalizedData[field] = val || null;
      });

      if (propertyId) {
        normalizedData.property_id = propertyId;
      }

      // Track RoomID (remark) duplicates
      const ridVal = String(normalizedData.remark || "").trim();
      if (ridVal) {
        if (!roomIdTracker[ridVal]) roomIdTracker[ridVal] = [];
        roomIdTracker[ridVal].push(rowNumber);
      }

      // CRITICAL: Property check
      if (!normalizedData.property_id) {
        errors.push({
          rowNumber,
          column: reverseMapping.property_code || "property_code",
          message: "Target property is missing or not resolved",
          severity: "error"
        });
      }

      // CRITICAL: Room Number missing check
      if (!normalizedData.unit_number) {
        errors.push({
          rowNumber,
          column: reverseMapping.unit_number || "unit_number",
          message: "Room No (unit_number) is required",
          severity: "error"
        });
      }

      // AREA and RATIO checks
      if (normalizedData.area !== undefined && normalizedData.area !== null) {
        const numArea = Number(normalizedData.area);
        if (isNaN(numArea)) {
          errors.push({
            rowNumber,
            column: reverseMapping.area || "area",
            message: `Area must be a number: '${normalizedData.area}'`,
            severity: "error"
          });
        } else if (numArea < 0) {
          errors.push({
            rowNumber,
            column: reverseMapping.area || "area",
            message: `Area cannot be negative: '${normalizedData.area}'`,
            severity: "error"
          });
        }
      }

      if (normalizedData.ownership_ratio !== undefined && normalizedData.ownership_ratio !== null) {
        const numRatio = Number(normalizedData.ownership_ratio);
        if (isNaN(numRatio)) {
          errors.push({
            rowNumber,
            column: reverseMapping.ownership_ratio || "ownership_ratio",
            message: `Ratio must be a number: '${normalizedData.ownership_ratio}'`,
            severity: "error"
          });
        } else if (numRatio < 0) {
          errors.push({
            rowNumber,
            column: reverseMapping.ownership_ratio || "ownership_ratio",
            message: `Ratio cannot be negative: '${normalizedData.ownership_ratio}'`,
            severity: "error"
          });
        }
      }

      // WARNINGS (non-critical checks)
      if (moduleName === "combined_metro") {
        if (!normalizedData.floor) {
          errors.push({
            rowNumber,
            column: reverseMapping.floor || "floor",
            message: "Floor level is missing (warning only)",
            severity: "warning"
          });
        }

        if (!normalizedData.area) {
          errors.push({
            rowNumber,
            column: reverseMapping.area || "area",
            message: "Area is missing (warning only)",
            severity: "warning"
          });
        }

        const ownerName = String(normalizedData.owner_name || "").trim();
        if (!ownerName) {
          errors.push({
            rowNumber,
            column: reverseMapping.owner_name || "owner_name",
            message: "Owner name is missing (warning only)",
            severity: "warning"
          });
        } else {
          // Check matching person
          const parts = ownerName.split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "-";
          const personKey = `${firstName.trim().toUpperCase()}::${lastName.trim().toUpperCase()}`;
          const foundPerson = dbPersonsByName.get(personKey);
          if (foundPerson) {
            normalizedData.person_id = foundPerson.id;
            errors.push({
              rowNumber,
              column: reverseMapping.owner_name || "owner_name",
              message: `Matches existing person '${ownerName}' in database`,
              severity: "warning"
            });
          } else {
            errors.push({
              rowNumber,
              column: reverseMapping.owner_name || "owner_name",
              message: `New person will be created: '${ownerName}'`,
              severity: "warning"
            });
          }
        }

        if (!normalizedData.water_meter && !normalizedData.electricity_meter) {
          errors.push({
            rowNumber,
            column: reverseMapping.water_meter || "water_meter",
            message: "Water and electricity meters are both missing (warning only)",
            severity: "warning"
          });
        }

        if (mappedFields.includes("phone") && !normalizedData.phone) {
          errors.push({
            rowNumber,
            column: reverseMapping.phone || "phone",
            message: "Phone number is missing (warning only)",
            severity: "warning"
          });
        }

        if (mappedFields.includes("email") && !normalizedData.email) {
          errors.push({
            rowNumber,
            column: reverseMapping.email || "email",
            message: "Email address is missing (warning only)",
            severity: "warning"
          });
        }

        if (mappedFields.includes("resident_name") && !normalizedData.resident_name) {
          errors.push({
            rowNumber,
            column: reverseMapping.resident_name || "resident_name",
            message: "Resident name is missing (warning only)",
            severity: "warning"
          });
        }

        // Status domain validation
        const rawStatusVal = String(normalizedData.occupancy_type || normalizedData.status || "").trim().toUpperCase();
        const knownStatuses = [
          "OWNER", "OWNER_OCCUPIED",
          "TENANT", "TENANT_OCCUPIED",
          "VACANT",
          "MAINTENANCE",
          "OUT_OF_SERVICE",
          "LOCKED",
          "STAFF",
          "MJC", "DEVELOPER"
        ];
        if (rawStatusVal && !knownStatuses.includes(rawStatusVal.replace(/[\s\-]+/g, "_"))) {
          errors.push({
            rowNumber,
            column: reverseMapping.occupancy_type || "occupancy_type",
            message: `Unknown STATUS value '${rawStatusVal}' — will be treated as OWNER_OCCUPIED. Check canonical status list.`,
            severity: "warning"
          });
        } else if (rawStatusVal) {
          const s = rawStatusVal.replace(/[\s\-]+/g, "_");
          let statusNote = "";
          if (s === "OWNER" || s === "OWNER_OCCUPIED") statusNote = "unit=ACTIVE, ownership=OWNER, occupancy=OWNER";
          else if (s === "TENANT" || s === "TENANT_OCCUPIED") statusNote = "unit=ACTIVE, ownership=OWNER (preserved), occupancy=TENANT";
          else if (s === "VACANT") statusNote = "unit=ACTIVE, ownership=OWNER (if present), no occupancy created";
          else if (s === "MAINTENANCE") statusNote = "unit=MAINTENANCE, no occupancy created";
          else if (s === "OUT_OF_SERVICE") statusNote = "unit=INACTIVE, no assignments";
          else if (s === "LOCKED") statusNote = "unit=INACTIVE, no assignments";
          else if (s === "STAFF") statusNote = "unit=ACTIVE, no ownership, occupancy=STAFF";
          else if (s === "MJC" || s === "DEVELOPER") statusNote = "unit=ACTIVE, ownership=DEVELOPER, occupancy=COMPANY";
          if (statusNote) {
            errors.push({
              rowNumber,
              column: reverseMapping.occupancy_type || "occupancy_type",
              message: `STATUS=${s} → ${statusNote}`,
              severity: "warning"
            });
          }
        }

        // Database duplicate unit checks
        if (normalizedData.unit_number && normalizedData.property_id) {
          const uKey = `${normalizedData.property_id}:${normalizedData.unit_number.toUpperCase()}`;
          if (dbUnitsMap.has(uKey)) {
            errors.push({
              rowNumber,
              column: reverseMapping.unit_number || "unit_number",
              message: `Unit number '${normalizedData.unit_number}' already exists in database (will be updated)`,
              severity: "warning"
            });
          }
        }
      }

      if (moduleName === "occupancy") {
        const uNum = String(normalizedData.unit_number || "").trim().toUpperCase();
        const fullName = String(normalizedData.full_name || "").trim();
        const occType = String(normalizedData.occupancy_type || "").trim().toUpperCase();
        const moveInStr = String(normalizedData.move_in_date || "").trim();
        const moveOutStr = String(normalizedData.move_out_date || "").trim();
        const phone = String(normalizedData.phone || "").trim();
        const email = String(normalizedData.email || "").trim().toLowerCase();

        // Required field validations
        if (!fullName) {
          errors.push({
            rowNumber,
            column: reverseMapping.full_name || "full_name",
            message: "Full Name is required",
            severity: "error"
          });
        }

        if (!occType) {
          errors.push({
            rowNumber,
            column: reverseMapping.occupancy_type || "occupancy_type",
            message: "Occupancy Type is required",
            severity: "error"
          });
        } else {
          const validTypes = ["OWNER", "CO_OWNER", "FAMILY_MEMBER", "TENANT", "RESIDENT", "STAFF", "COMPANY"];
          if (!validTypes.includes(occType)) {
            errors.push({
              rowNumber,
              column: reverseMapping.occupancy_type || "occupancy_type",
              message: `Occupancy type must be one of: ${validTypes.join(", ")}`,
              severity: "error"
            });
          }
        }

        if (!moveInStr) {
          errors.push({
            rowNumber,
            column: reverseMapping.move_in_date || "move_in_date",
            message: "Move-in date is required",
            severity: "error"
          });
        } else if (isNaN(Date.parse(moveInStr))) {
          errors.push({
            rowNumber,
            column: reverseMapping.move_in_date || "move_in_date",
            message: "Invalid move-in date format",
            severity: "error"
          });
        }

        if (moveOutStr && isNaN(Date.parse(moveOutStr))) {
          errors.push({
            rowNumber,
            column: reverseMapping.move_out_date || "move_out_date",
            message: "Invalid move-out date format",
            severity: "error"
          });
        }

        if (moveInStr && moveOutStr && !isNaN(Date.parse(moveInStr)) && !isNaN(Date.parse(moveOutStr))) {
          if (new Date(moveOutStr) < new Date(moveInStr)) {
            errors.push({
              rowNumber,
              column: reverseMapping.move_out_date || "move_out_date",
              message: "Move-out date cannot be earlier than move-in date",
              severity: "error"
            });
          }
        }

        // Unit existence check
        let resolvedUnitId = "";
        if (uNum && normalizedData.property_id) {
          const uKey = `${normalizedData.property_id}:${uNum}`;
          const existingUnit = dbUnitsMap.get(uKey);
          if (!existingUnit) {
            errors.push({
              rowNumber,
              column: reverseMapping.unit_number || "unit_number",
              message: `Unit number '${uNum}' not found in database`,
              severity: "error"
            });
          } else {
            resolvedUnitId = existingUnit.id;
          }
        }

        // Person Resolution
        let resolvedPersonId = "";

        // Try matching by email
        if (email) {
          const found = dbPersons?.find(p => p.email && p.email.trim().toLowerCase() === email);
          if (found) {
            resolvedPersonId = found.id;
          }
        }

        // Try matching by phone
        if (phone && !resolvedPersonId) {
          const normPhone = normalizePhone(phone);
          const found = dbPersons?.find(p => p.phone && normalizePhone(p.phone) === normPhone);
          if (found) {
            resolvedPersonId = found.id;
          }
        }

        // Check cross match ambiguity
        if (email && phone) {
          const emailMatch = dbPersons?.find(p => p.email && p.email.trim().toLowerCase() === email);
          const normPhone = normalizePhone(phone);
          const phoneMatch = dbPersons?.find(p => p.phone && normalizePhone(p.phone) === normPhone);
          if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
            errors.push({
              rowNumber,
              column: reverseMapping.full_name || "full_name",
              message: `Ambiguous occupant profile: email matches Person '${emailMatch.first_name}' but phone matches Person '${phoneMatch.first_name}'`,
              severity: "error"
            });
          }
        }

        if (resolvedPersonId) {
          const personRow = dbPersons?.find(p => p.id === resolvedPersonId);
          errors.push({
            rowNumber,
            column: reverseMapping.full_name || "full_name",
            message: `Matches existing person '${personRow?.first_name} ${personRow?.last_name || ""}' in database`,
            severity: "warning"
          });
        } else if (fullName) {
          errors.push({
            rowNumber,
            column: reverseMapping.full_name || "full_name",
            message: `New occupant profile will be created: '${fullName}'`,
            severity: "warning"
          });
        }

        // Check existing equivalent active assignment
        if (resolvedUnitId && resolvedPersonId && occType) {
          const occKey = `${resolvedUnitId}:${resolvedPersonId}`;
          const existingOcc = dbActiveOccupanciesMap.get(occKey);
          if (existingOcc && existingOcc.occupancy_type === occType) {
            errors.push({
              rowNumber,
              column: reverseMapping.unit_number || "unit_number",
              message: "Active equivalent assignment already exists in database (skipped)",
              severity: "warning"
            });
          }
        }

        // Excel duplicate identical assignment row check
        const dupRows = rows.map((r, idx) => ({ idx: idx + 2, r })).filter(x => {
          const rowUnit = String(x.r[reverseMapping.unit_number || "UNIT_NUMBER"] || "").trim().toUpperCase();
          const rowName = String(x.r[reverseMapping.full_name || "FULL_NAME"] || "").trim();
          const rowType = String(x.r[reverseMapping.occupancy_type || "OCCUPANCY_TYPE"] || "").trim().toUpperCase();
          return rowUnit === uNum && rowName === fullName && rowType === occType;
        });

        if (dupRows.length > 1) {
          errors.push({
            rowNumber,
            column: reverseMapping.unit_number || "unit_number",
            message: `Duplicate identical assignment row detected in workbook (rows: ${dupRows.map(x => x.idx).join(", ")})`,
            severity: "error"
          });
        }
      }

      results.push({
        rowNumber,
        normalizedData,
        errors
      });

      allErrors.push(...errors);
    });

    if (moduleName !== "occupancy") {
      // Excel duplicate unit numbers checks
      Object.entries(unitNumberTracker).forEach(([unitNum, rowsWithUnit]) => {
        if (rowsWithUnit.length > 1) {
          rowsWithUnit.forEach(rowNum => {
            const dupError: ValidationError = {
              rowNumber: rowNum,
              column: reverseMapping.unit_number || "unit_number",
              message: `Duplicate unit number '${unitNum}' detected in rows: ${rowsWithUnit.join(", ")}`,
              severity: "error"
            };
            const rowRes = results.find(r => r.rowNumber === rowNum);
            rowRes?.errors.push(dupError);
            allErrors.push(dupError);
          });
        }
      });

      // Excel duplicate RoomID checks
      Object.entries(roomIdTracker).forEach(([rid, rowsWithRid]) => {
        if (rowsWithRid.length > 1) {
          rowsWithRid.forEach(rowNum => {
            const dupError: ValidationError = {
              rowNumber: rowNum,
              column: reverseMapping.remark || "remark",
              message: `Duplicate RoomID '${rid}' detected in rows: ${rowsWithRid.join(", ")}`,
              severity: "error"
            };
            const rowRes = results.find(r => r.rowNumber === rowNum);
            rowRes?.errors.push(dupError);
            allErrors.push(dupError);
          });
        }
      });
    }

    // Sort all errors
    allErrors.sort((a, b) => a.rowNumber - b.rowNumber);

    // Compute completeness
    let unitSum = 0;
    let ownerSum = 0;
    let residentSum = 0;
    let meterSum = 0;
    const totalRows = rows.length || 1;

    results.forEach(res => {
      const data = res.normalizedData;

      // 1. Unit (unit_number, floor, area, ownership_ratio)
      let uScore = 0;
      if (data.unit_number) uScore += 25;
      if (data.floor) uScore += 25;
      if (data.area && Number(data.area) >= 0) uScore += 25;
      if (data.ownership_ratio && Number(data.ownership_ratio) >= 0) uScore += 25;
      unitSum += uScore;

      // 2. Owner (owner_name, phone, email)
      let oScore = 0;
      if (data.owner_name) oScore += 60;
      if (data.phone) oScore += 20;
      if (data.email) oScore += 20;
      ownerSum += oScore;

      // 3. Resident
      let rScore = 0;
      if (data.resident_name || data.owner_name || data.full_name) {
        rScore = 100;
      }
      residentSum += rScore;

      // 4. Meters (water_meter, electricity_meter)
      let mScore = 0;
      if (data.water_meter) mScore += 50;
      if (data.electricity_meter) mScore += 50;
      meterSum += mScore;
    });

    const completeness = {
      unit: Math.round(unitSum / totalRows),
      owner: Math.round(ownerSum / totalRows),
      resident: Math.round(residentSum / totalRows),
      meter: Math.round(meterSum / totalRows)
    };

    // Calculate transformation preview statistics
    let unitsCreate = 0;
    let unitsUpdate = 0;
    let personsCreate = 0;
    let personsMatch = 0;
    let ownershipsCreate = 0;
    let ownershipsUpdate = 0;
    let occupanciesCreate = 0;
    let occupanciesUpdate = 0;
    let metersCreate = 0;
    let metersUpdate = 0;

    if (moduleName === "occupancy") {
      results.forEach(res => {
        const data = res.normalizedData;
        const propIdVal = data.property_id;
        const unitNumVal = data.unit_number;
        if (!unitNumVal || !propIdVal) return;

        const unitKey = `${propIdVal}:${unitNumVal.toUpperCase()}`;
        const existingUnit = dbUnitsMap.get(unitKey);
        if (!existingUnit) return;

        const uId = existingUnit.id;

        // Resolve person
        const email = String(data.email || "").trim().toLowerCase();
        const phone = String(data.phone || "").trim();
        let personId = "";
        if (email) {
          const found = dbPersons?.find(p => p.email && p.email.trim().toLowerCase() === email);
          if (found) personId = found.id;
        }
        if (phone && !personId) {
          const normPhone = normalizePhone(phone);
          const found = dbPersons?.find(p => p.phone && normalizePhone(p.phone) === normPhone);
          if (found) personId = found.id;
        }

        if (personId) {
          personsMatch++;
          const occKey = `${uId}:${personId}`;
          const existingOcc = dbActiveOccupanciesMap.get(occKey);
          if (existingOcc) {
            if (existingOcc.occupancy_type !== data.occupancy_type) {
              occupanciesUpdate++;
            }
          } else {
            occupanciesCreate++;
          }
        } else {
          personsCreate++;
          occupanciesCreate++;
        }
      });
    } else {
      results.forEach(res => {
        const data = res.normalizedData;

        const propIdVal = data.property_id;
        const unitNumVal = data.unit_number;
        if (!unitNumVal || !propIdVal) return;

        const unitKey = `${propIdVal}:${unitNumVal.toUpperCase()}`;
        const existingUnit = dbUnitsMap.get(unitKey);

        // Unit preview
        if (existingUnit) {
          const hasChanged =
            existingUnit.floor !== (data.floor || "") ||
            Number(existingUnit.area) !== Number(data.area || 0) ||
            Number(existingUnit.ownership_ratio) !== Number(data.ownership_ratio || 0);
          if (hasChanged) {
            unitsUpdate++;
          }
        } else {
          unitsCreate++;
        }

        // Person preview
        const ownerName = String(data.owner_name || "").trim();
        let personId = "";
        if (ownerName) {
          const parts = ownerName.split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "-";
          const personKey = `${firstName.toUpperCase()}::${lastName.toUpperCase()}`;
          const foundPerson = dbPersonsByName.get(personKey);
          if (foundPerson) {
            personId = foundPerson.id;
            personsMatch++;
          } else {
            personsCreate++;
          }
        }

        // Owner assignments preview
        if (unitNumVal) {
          const uId = existingUnit?.id || "";
          // Resolve preview status for ownership/occupancy domain decisions
          const previewRawStatus = String(data.occupancy_type || data.status || "").trim().toUpperCase().replace(/[\s\-]+/g, "_");
          const isNoOwnership = ["MAINTENANCE", "OUT_OF_SERVICE", "LOCKED", "STAFF"].includes(previewRawStatus);
          const isNoOccupancy = ["VACANT", "MAINTENANCE", "OUT_OF_SERVICE", "LOCKED"].includes(previewRawStatus);
          const previewOwnerType = previewRawStatus === "MJC" || previewRawStatus === "DEVELOPER" ? "DEVELOPER" : "OWNER";
          const previewOccupancyType = previewRawStatus === "MJC" || previewRawStatus === "DEVELOPER" ? "COMPANY" :
            previewRawStatus === "TENANT" || previewRawStatus === "TENANT_OCCUPIED" ? "TENANT" :
            previewRawStatus === "STAFF" ? "STAFF" : "OWNER";

          // If this status suppresses ownership, skip ownership preview
          if (!isNoOwnership) {
            const ownKey = `${uId}:${personId}`;
            const existingOwn = personId && uId ? dbActiveOwnershipsMap.get(ownKey) : null;
            if (existingOwn) {
              const ratioPercent = Number(data.ownership_ratio || 100);
              if (Number(existingOwn.ownership_percent) !== ratioPercent || existingOwn.ownership_type !== previewOwnerType) {
                ownershipsUpdate++;
              }
            } else if (ownerName) {
              ownershipsCreate++;
            }

            // Occupancies preview (within ownership block)
            if (!isNoOccupancy) {
              const existingOcc = personId && uId ? dbActiveOccupanciesMap.get(ownKey) : null;
              if (existingOcc) {
                if (existingOcc.occupancy_type !== previewOccupancyType) {
                  occupanciesUpdate++;
                }
              } else if (ownerName) {
                occupanciesCreate++;
              }
            }
          } else if (previewRawStatus === "STAFF" && ownerName) {
            // STAFF: occupancy only (no ownership)
            const staffOccKey = `${uId}:${personId}`;
            const existingStaffOcc = personId && uId ? dbActiveOccupanciesMap.get(staffOccKey) : null;
            if (existingStaffOcc) {
              if (existingStaffOcc.occupancy_type !== "STAFF") occupanciesUpdate++;
            } else {
              occupanciesCreate++;
            }
          }

          // Meters preview
          if (data.water_meter) {
            const meterKey = `${uId}:WATER`;
            const existingMeterVal = dbActiveMetersMap.get(meterKey);
            if (existingMeterVal) {
              if (existingMeterVal !== String(data.water_meter)) {
                metersUpdate++;
              }
            } else {
              metersCreate++;
            }
          }
          if (data.electricity_meter) {
            const meterKey = `${uId}:ELECTRICITY`;
            const existingMeterVal = dbActiveMetersMap.get(meterKey);
            if (existingMeterVal) {
              if (existingMeterVal !== String(data.electricity_meter)) {
                metersUpdate++;
              }
            } else {
              metersCreate++;
            }
          }
        }
      });
    }

    const previewStats = {
      units: { create: unitsCreate, update: unitsUpdate, match: 0 },
      persons: { create: personsCreate, match: personsMatch },
      ownerships: { create: ownershipsCreate, update: ownershipsUpdate },
      occupancies: { create: occupanciesCreate, update: occupanciesUpdate },
      meters: { create: metersCreate, update: metersUpdate }
    };

    let validRows = 0;
    let warningRows = 0;
    let errorRows = 0;

    results.forEach(r => {
      const hasErrors = r.errors.some((e: any) => e.severity === "error");
      const hasWarnings = r.errors.some((e: any) => e.severity === "warning");

      if (hasErrors) errorRows++;
      else if (hasWarnings) warningRows++;
      else validRows++;
    });

    const summary = {
      totalRows: rows.length,
      validRows,
      warningRows,
      errorRows,
      importReady: errorRows === 0 && rows.length > 0
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
      allErrors,
      completeness,
      previewStats
    });

  } catch (error: unknown) {
    console.error("Backend validation failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
