/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ValidationError } from "@/features/import/types/import.types";

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

    // 1. Fetch properties
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

      results.push({
        rowNumber,
        normalizedData,
        errors
      });

      allErrors.push(...errors);
    });

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
      if (data.resident_name || data.owner_name) {
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
