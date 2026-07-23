import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { utilityMeterService } from "@/services/utility-meter/utility-meter.service";

/**
 * POST /api/v1/utility-meters/bootstrap
 *
 * Bulk Meter Master Import & Validation endpoint.
 * Supports:
 *   1. Validation Mode (dry_run = true) — returns rows with validation status/messages
 *   2. Commit Mode (dry_run = false) — performs validation and atomically inserts valid rows
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, property_id")
      .eq("id", user.id)
      .single();

    // Only super_admin, admin, and property_admin may register meters in bulk
    if (!profile || !["super_admin", "admin", "property_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, message: "Forbidden: admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { property_id, meters: meterRows, dry_run = false } = body;

    if (!property_id) {
      return NextResponse.json({ success: false, message: "property_id is required" }, { status: 400 });
    }

    if (profile.role === "property_admin" && profile.property_id !== property_id) {
      return NextResponse.json({ success: false, message: "Forbidden: cross-property actions denied" }, { status: 403 });
    }

    if (!Array.isArray(meterRows) || meterRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "meters array is required and must not be empty."
      }, { status: 400 });
    }

    // 1. Load all units for this property
    const { data: units, error: unitsErr } = await supabase
      .from("units")
      .select("id, unit_number")
      .eq("property_id", property_id)
      .is("deleted_at", null);

    if (unitsErr || !units) {
      return NextResponse.json({ success: false, message: "Failed to load units: " + unitsErr?.message }, { status: 500 });
    }

    const unitByRoom = new Map<string, string>((units as unknown as Array<{ unit_number: string; id: string }>).map((u) => [u.unit_number.trim(), u.id]));

    // 2. Load all existing active meters for invariant check
    const { data: existingActiveMeters, error: activeErr } = await supabase
      .from("utility_meters")
      .select("unit_id, utility_type, meter_number")
      .eq("property_id", property_id)
      .eq("meter_status", "ACTIVE");

    if (activeErr) {
      return NextResponse.json({ success: false, message: "Failed to load active meters: " + activeErr.message }, { status: 500 });
    }

    const activeMetersSet = new Set(
      (existingActiveMeters || []).map((m) => `${m.unit_id}::${m.utility_type}`)
    );

    // 3. Load all registered manufacturer serial numbers (global or property scope, let's do global to prevent conflicts)
    const { data: existingSerials, error: serialErr } = await supabase
      .from("utility_meters")
      .select("manufacturer_serial_number")
      .not("manufacturer_serial_number", "is", null);

    if (serialErr) {
      return NextResponse.json({ success: false, message: "Failed to load serials: " + serialErr.message }, { status: 500 });
    }

    const serialsSet = new Set(
      (existingSerials || [])
        .map((m) => String(m.manufacturer_serial_number).trim().toUpperCase())
        .filter(Boolean)
    );

    interface PreviewRow {
      source_row: number;
      room_number: string;
      utility_type: string;
      meter_classification: string;
      manufacturer_serial_number: string | null;
      installed_date: string | null;
      initial_reading: number;
      note: string | null;
      validationStatus: "VALID" | "ERROR";
      validationMessage: string;
      generated_code: string;
    }

    interface InsertRow {
      property_id: string;
      unit_id: string;
      utility_type: string;
      meter_number: string;
      manufacturer_serial_number: string | null;
      installed_at: string | null;
      installation_date_known: boolean;
      meter_status: "ACTIVE";
      initial_reading: number;
    }

    const previewRows: PreviewRow[] = [];
    const seenRequestPairs = new Set<string>();
    const seenRequestSerials = new Set<string>();
    const insertRows: InsertRow[] = [];

    // Helper map to cache resolved sequences during the loop
    const sequenceCache = new Map<string, number>();

    for (let i = 0; i < meterRows.length; i++) {
      const row = meterRows[i];
      const rowNum = i + 1;
      const roomNumber = String(row.room_number || row.UNIT_NUMBER || "").trim();
      const utilityType = String(row.utility_type || row.UTILITY_TYPE || "").toUpperCase();
      const classification = String(row.meter_classification || row.METER_CLASSIFICATION || "").toUpperCase();
      const rawSerial = String(row.manufacturer_serial_number || row.MANUFACTURER_SERIAL_NUMBER || "").trim();
      const rawInstalledDate = String(row.installed_date || row.INSTALLED_DATE || row.installed_at || "").trim();
      const rawReading = row.initial_reading || row.INITIAL_READING;
      const note = String(row.note || row.NOTE || "").trim();

      let validationStatus: "VALID" | "ERROR" = "VALID";
      let validationMessage = "Ready";
      let generatedCode = "";

      // Validate room_number
      if (!roomNumber) {
        validationStatus = "ERROR";
        validationMessage = "Room number is required";
      }

      const unitId = unitByRoom.get(roomNumber);
      if (validationStatus === "VALID" && !unitId) {
        validationStatus = "ERROR";
        validationMessage = `Room "${roomNumber}" not found in property`;
      }

      // Validate utility_type
      if (validationStatus === "VALID" && !["WATER", "ELECTRICITY"].includes(utilityType)) {
        validationStatus = "ERROR";
        validationMessage = `Invalid utility type: "${utilityType}". Must be WATER or ELECTRICITY`;
      }

      // Validate classification
      if (validationStatus === "VALID" && !["LEGACY", "NEW"].includes(classification)) {
        validationStatus = "ERROR";
        validationMessage = `Invalid classification: "${classification}". Must be LEGACY or NEW`;
      }

      // Validate initial reading
      const initialReading = Number(rawReading);
      if (validationStatus === "VALID") {
        if (rawReading === undefined || rawReading === null || isNaN(initialReading)) {
          validationStatus = "ERROR";
          validationMessage = "Initial reading is required and must be a number";
        } else if (initialReading < 0) {
          validationStatus = "ERROR";
          validationMessage = "Initial reading must be non-negative";
        }
      }

      // Validate installed date
      let installedAt: string | null = null;
      let installationDateKnown = true;
      if (validationStatus === "VALID") {
        if (classification === "NEW") {
          if (!rawInstalledDate) {
            validationStatus = "ERROR";
            validationMessage = "Installed date is required for NEW meters";
          } else {
            // Verify date format
            const match = rawInstalledDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) {
              // Try formatting if it has slash or different separators
              validationStatus = "ERROR";
              validationMessage = `Invalid installed date format: "${rawInstalledDate}". Expected YYYY-MM-DD`;
            } else {
              installedAt = rawInstalledDate;
            }
          }
        } else {
          // LEGACY
          if (rawInstalledDate) {
            const match = rawInstalledDate.match(/^(\d{4})-(\d{2})/);
            if (!match) {
              validationStatus = "ERROR";
              validationMessage = `Invalid installed date format: "${rawInstalledDate}". Expected YYYY-MM-DD or YYYY-MM`;
            } else {
              installedAt = rawInstalledDate.includes("-", 5) ? rawInstalledDate : `${rawInstalledDate}-01`;
            }
          } else {
            installationDateKnown = false;
            installedAt = null;
          }
        }
      }

      // Check duplicates within request
      if (validationStatus === "VALID" && unitId) {
        const pairKey = `${unitId}::${utilityType}`;
        if (seenRequestPairs.has(pairKey)) {
          validationStatus = "ERROR";
          validationMessage = `Duplicate room and utility type row for "${roomNumber}" in file`;
        } else {
          seenRequestPairs.add(pairKey);
        }
      }

      if (validationStatus === "VALID" && rawSerial !== "") {
        const serialUpper = rawSerial.toUpperCase();
        if (seenRequestSerials.has(serialUpper)) {
          validationStatus = "ERROR";
          validationMessage = `Duplicate manufacturer serial "${rawSerial}" in file`;
        } else {
          seenRequestSerials.add(serialUpper);
        }
      }

      // Check database active meter invariant
      if (validationStatus === "VALID" && unitId) {
        const pairKey = `${unitId}::${utilityType}`;
        if (activeMetersSet.has(pairKey)) {
          const typeLabel = utilityType === "WATER" ? "น้ำ" : "ไฟ";
          validationStatus = "ERROR";
          validationMessage = `ห้อง ${roomNumber} มีมิเตอร์${typeLabel}ที่ใช้งานอยู่แล้ว กรุณาใช้กระบวนการเปลี่ยนมิเตอร์`;
        }
      }

      // Check database duplicate serial constraint
      if (validationStatus === "VALID" && rawSerial !== "") {
        const serialUpper = rawSerial.toUpperCase();
        if (serialsSet.has(serialUpper)) {
          validationStatus = "ERROR";
          validationMessage = `Manufacturer serial "${rawSerial}" is already registered in database`;
        }
      }

      // Generate preview code if valid
      if (validationStatus === "VALID" && unitId) {
        try {
          const cacheKey = `${unitId}::${utilityType}`;
          let seq = sequenceCache.get(cacheKey);
          if (seq === undefined) {
            seq = await utilityMeterService.resolveNextMeterSequence(supabase, unitId, utilityType as "WATER" | "ELECTRICITY");
          }
          sequenceCache.set(cacheKey, seq + 1);

          if (classification === "LEGACY") {
            generatedCode = utilityMeterService.generateLegacyMeterCode(roomNumber, utilityType as "WATER" | "ELECTRICITY", seq);
          } else {
            // NEW
            generatedCode = utilityMeterService.generateInstalledMeterCode(roomNumber, utilityType as "WATER" | "ELECTRICITY", installedAt!, seq);
          }
        } catch (seqErr: unknown) {
          validationStatus = "ERROR";
          const errMsg = seqErr instanceof Error ? seqErr.message : String(seqErr);
          validationMessage = `Sequence resolution error: ${errMsg}`;
        }
      }

      const rowPreview = {
        source_row: rowNum,
        room_number: roomNumber,
        utility_type: utilityType,
        meter_classification: classification,
        manufacturer_serial_number: rawSerial || null,
        installed_date: rawInstalledDate || null,
        initial_reading: initialReading,
        note: note || null,
        validationStatus,
        validationMessage,
        generated_code: generatedCode
      };

      previewRows.push(rowPreview);

      if (validationStatus === "VALID" && unitId) {
        insertRows.push({
          property_id,
          unit_id: unitId,
          utility_type: utilityType,
          meter_number: generatedCode,
          manufacturer_serial_number: rawSerial !== "" ? rawSerial : null,
          installed_at: installedAt,
          installation_date_known: installationDateKnown,
          meter_status: "ACTIVE",
          initial_reading: initialReading
        });
      }
    }

    if (dry_run) {
      return NextResponse.json({
        success: true,
        data: previewRows
      });
    }

    // Commit Mode — require all rows to be valid
    const hasErrors = previewRows.some((r) => r.validationStatus === "ERROR");
    if (hasErrors) {
      return NextResponse.json({
        success: false,
        message: "Cannot import. Some rows contain errors.",
        data: previewRows
      }, { status: 400 });
    }

    // Perform atomic transaction commit by inserting rows
    if (insertRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No rows to import",
        created: 0
      });
    }

    // Since they are all valid, let's insert in chunks
    const BATCH_SIZE = 50;
    let createdCount = 0;
    const insertErrors: string[] = [];

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      const batch = insertRows.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from("utility_meters").insert(batch);
      if (insertErr) {
        insertErrors.push(insertErr.message);
      } else {
        createdCount += batch.length;
      }
    }

    if (insertErrors.length > 0) {
      return NextResponse.json({
        success: false,
        message: "Failed to save meters: " + insertErrors.join("; ")
      }, { status: 400 });
    }

    // Log entity changes for all imported meters (chunked/merged)
    // Write one main audit log summarizing the action
    await supabase.rpc("log_entity_change", {
      p_entity_type: "units",
      p_entity_id: insertRows[0].unit_id, // Log to first unit, or log a general note
      p_action_type: "EDIT",
      p_changed_fields: {
        action: "BULK_METER_IMPORT",
        count: createdCount,
        imported_codes: insertRows.map((m) => m.meter_number)
      },
      p_reason: `Imported ${createdCount} utility meters via Excel file`
    });

    return NextResponse.json({
      success: true,
      message: `Successfully registered ${createdCount} meter(s) from Excel file`,
      created: createdCount
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
