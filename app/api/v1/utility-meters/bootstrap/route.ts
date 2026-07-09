import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/utility-meters/bootstrap
 *
 * Meter Master IMPORT endpoint — registers meters from real meter serial numbers
 * supplied by the caller. This endpoint does NOT generate synthetic meter numbers.
 *
 * Each entry in the `meters` array must supply:
 *   - room_number   : string  — must match an existing unit.unit_number exactly
 *   - utility_type  : "WATER" | "ELECTRICITY"
 *   - meter_number  : string  — actual physical meter serial (required, non-empty)
 *   - initial_reading : number — baseline reading (default 0)
 *   - installed_at  : string (YYYY-MM-DD) — optional, defaults to today
 *
 * Validation rules (all enforced server-side):
 *   - Missing meter_number → row error (skipped, reported)
 *   - Unknown room_number → row error
 *   - Duplicate meter_number within request → row error
 *   - Unit+utility_type already has ACTIVE meter → skipped (not error; idempotent)
 *   - Meter number already used by another unit → row error
 *
 * This endpoint accepts application/json only.
 * For XLSX import UI use the preview-and-confirm workflow in meter-management.
 *
 * Rows with errors are skipped. Clean rows are inserted. Response lists all errors.
 *
 * Body:
 *   {
 *     property_id: string,
 *     meters: Array<{
 *       room_number: string,
 *       utility_type: "WATER" | "ELECTRICITY",
 *       meter_number: string,
 *       initial_reading?: number,
 *       installed_at?: string
 *     }>
 *   }
 *
 * Returns:
 *   {
 *     success: boolean,
 *     created: number,
 *     skipped: number,
 *     errors: Array<{ row: number, room_number: string, meter_number: string, reason: string }>
 *   }
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

    // Only super_admin and admin may register meters in bulk
    if (!profile || !["super_admin", "admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, message: "Forbidden: super_admin or admin required" }, { status: 403 });
    }

    const body = await request.json();
    const { property_id, meters: meterRows } = body;

    if (!property_id) {
      return NextResponse.json({ success: false, message: "property_id is required" }, { status: 400 });
    }

    if (!Array.isArray(meterRows) || meterRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "meters array is required and must not be empty. " +
          "Each entry must supply room_number, utility_type, and a real meter_number. " +
          "This endpoint does not generate synthetic meter serial numbers."
      }, { status: 400 });
    }

    // Load all active units for this property
    const { data: units, error: unitsErr } = await supabase
      .from("units")
      .select("id, unit_number")
      .eq("property_id", property_id)
      .is("deleted_at", null);

    if (unitsErr || !units) {
      return NextResponse.json({ success: false, message: "Failed to load units: " + unitsErr?.message }, { status: 500 });
    }

    const unitByRoom = new Map(units.map((u) => [u.unit_number.trim(), u.id]));

    // Load existing active meters to detect unit+type duplicates and serial conflicts
    const { data: existingMeters, error: metersErr } = await supabase
      .from("utility_meters")
      .select("unit_id, utility_type, meter_number")
      .eq("property_id", property_id)
      .eq("meter_status", "ACTIVE");

    if (metersErr) {
      return NextResponse.json({ success: false, message: "Failed to load existing meters: " + metersErr.message }, { status: 500 });
    }

    const existingPairs = new Set((existingMeters || []).map((m) => `${m.unit_id}::${m.utility_type}`));
    const existingSerials = new Set((existingMeters || []).map((m) => m.meter_number.trim().toUpperCase()));

    const today = new Date().toISOString().split("T")[0];
    const rowErrors: Array<{ row: number; room_number: string; meter_number: string; reason: string }> = [];
    const insertRows: Array<Record<string, unknown>> = [];
    const seenSerialsInRequest = new Set<string>();
    let skipped = 0;

    for (let i = 0; i < meterRows.length; i++) {
      const row = meterRows[i];
      const rowNum = i + 1;
      const roomNumber = String(row.room_number || "").trim();
      const utilityType = String(row.utility_type || "").toUpperCase();
      const meterNumber = String(row.meter_number || "").trim();
      const initialReading = Math.max(0, Number(row.initial_reading) || 0);
      const installedAt = row.installed_at || today;

      // Validate utility_type
      if (!["WATER", "ELECTRICITY"].includes(utilityType)) {
        rowErrors.push({ row: rowNum, room_number: roomNumber, meter_number: meterNumber, reason: `Invalid utility_type: "${utilityType}"` });
        continue;
      }

      // Require a real meter_number — refuse to invent one
      if (!meterNumber) {
        rowErrors.push({ row: rowNum, room_number: roomNumber, meter_number: "(empty)", reason: "meter_number is required — this endpoint does not generate synthetic serial numbers" });
        continue;
      }

      // Validate room_number
      if (!roomNumber) {
        rowErrors.push({ row: rowNum, room_number: "(empty)", meter_number: meterNumber, reason: "room_number is required" });
        continue;
      }

      const unitId = unitByRoom.get(roomNumber);
      if (!unitId) {
        rowErrors.push({ row: rowNum, room_number: roomNumber, meter_number: meterNumber, reason: `Room "${roomNumber}" not found in this property` });
        continue;
      }

      // Unit + utility_type already has active meter → skip (idempotent, not an error)
      const pairKey = `${unitId}::${utilityType}`;
      if (existingPairs.has(pairKey)) {
        skipped++;
        continue;
      }

      // Duplicate serial within existing production meters
      const serialUpper = meterNumber.toUpperCase();
      if (existingSerials.has(serialUpper)) {
        rowErrors.push({ row: rowNum, room_number: roomNumber, meter_number: meterNumber, reason: `Meter serial "${meterNumber}" is already registered to another unit` });
        continue;
      }

      // Duplicate serial within this request
      if (seenSerialsInRequest.has(serialUpper)) {
        rowErrors.push({ row: rowNum, room_number: roomNumber, meter_number: meterNumber, reason: `Duplicate meter_number "${meterNumber}" in this import request` });
        continue;
      }
      seenSerialsInRequest.add(serialUpper);

      insertRows.push({
        property_id,
        unit_id: unitId,
        utility_type: utilityType,
        meter_number: meterNumber,
        meter_status: "ACTIVE",
        initial_reading: initialReading,
        installed_at: installedAt,
      });
    }

    // Insert valid rows in batches
    const BATCH_SIZE = 100;
    let created = 0;
    const insertErrors: string[] = [];

    for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
      const batch = insertRows.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from("utility_meters").insert(batch);
      if (insertErr) {
        insertErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertErr.message}`);
      } else {
        created += batch.length;
      }
    }

    // Merge insert-level errors into row errors for reporting
    if (insertErrors.length > 0) {
      rowErrors.push(...insertErrors.map((msg) => ({ row: -1, room_number: "N/A", meter_number: "N/A", reason: msg })));
    }

    return NextResponse.json({
      success: rowErrors.length === 0 && insertErrors.length === 0,
      message: created > 0
        ? `Import complete: ${created} meter(s) registered, ${skipped} skipped (already metered), ${rowErrors.length} error(s).`
        : rowErrors.length > 0
          ? `Import failed: all ${meterRows.length} rows had errors.`
          : "No new meters to register.",
      created,
      skipped,
      total_input: meterRows.length,
      errors: rowErrors,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
