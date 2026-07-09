import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/meter-readings/resolve
 * 
 * Resolves business-key rows (room_number + utility_type) to meter reading IDs
 * within a specific cycle. Used by the frontend import preview to validate
 * and map standard workbook rows before confirmation.
 * 
 * Body: { cycle_id, rows: [{ room_number, utility_type, current_reading?, technician_note? }] }
 * Returns: { success, data: [{ ...row, reading_id, meter_number, previous_reading, validationStatus, validationMessage }] }
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

    if (!profile || !["super_admin", "admin", "property_admin"].includes(profile.role)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { cycle_id, rows } = body;

    if (!cycle_id || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid payload: cycle_id and rows required" }, { status: 400 });
    }

    if (rows.length > 1000) {
      return NextResponse.json({ success: false, message: "จำนวนแถวห้ามเกิน 1,000 แถว" }, { status: 400 });
    }

    // 1. Fetch cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from("meter_reading_cycles")
      .select("*")
      .eq("id", cycle_id)
      .single();

    if (cycleErr || !cycle) {
      return NextResponse.json({ success: false, message: "ไม่พบรอบจดมิเตอร์" }, { status: 404 });
    }

    // Property scope check
    if (profile.role === "property_admin") {
      if (!profile.property_id || cycle.property_id !== profile.property_id) {
        return NextResponse.json({ success: false, message: "Forbidden: cross-property access denied" }, { status: 403 });
      }
    }

    if (!["OPEN", "IN_PROGRESS"].includes(cycle.status)) {
      return NextResponse.json({ success: false, message: "ข้อมูลรอบจดมิเตอร์ไม่ได้อยู่ในสถานะเปิดรับข้อมูล" }, { status: 400 });
    }

    // 2. Fetch all units for this property (room_number -> unit_id mapping)
    const { data: units, error: unitsErr } = await supabase
      .from("units")
      .select("id, unit_number")
      .eq("property_id", cycle.property_id);

    if (unitsErr || !units) {
      return NextResponse.json({ success: false, message: "ไม่สามารถโหลดข้อมูลห้องชุด" }, { status: 500 });
    }

    // Build room_number -> unit mapping (check for duplicates)
    const roomToUnit = new Map<string, { id: string; unit_number: string }[]>();
    for (const unit of units) {
      const key = String(unit.unit_number).trim();
      if (!roomToUnit.has(key)) {
        roomToUnit.set(key, []);
      }
      roomToUnit.get(key)!.push(unit);
    }

    // 3. Fetch all existing readings for this cycle
    const { data: existingReadings, error: readingsErr } = await supabase
      .from("meter_readings")
      .select("id, unit_id, meter_id, utility_type, previous_reading, current_reading, status, meter:utility_meters(meter_number)")
      .eq("cycle_id", cycle_id);

    if (readingsErr || !existingReadings) {
      return NextResponse.json({ success: false, message: "ไม่สามารถโหลดข้อมูลรายการจดมิเตอร์" }, { status: 500 });
    }

    // Build lookup: unit_id + utility_type -> reading
    const readingLookup = new Map<string, typeof existingReadings[0][]>();
    for (const r of existingReadings) {
      const key = `${r.unit_id}::${r.utility_type}`;
      if (!readingLookup.has(key)) {
        readingLookup.set(key, []);
      }
      readingLookup.get(key)!.push(r);
    }

    // 4. Resolve each row
    const seenReadingIds = new Set<string>();
    const resolvedRows = rows.map((row: { 
      source_row: number; 
      room_number: string; 
      utility_type: string; 
      current_reading?: number | null;
      technician_note?: string;
    }) => {
      const roomNum = String(row.room_number || "").trim();
      const utilType = String(row.utility_type || "").trim().toUpperCase();
      const currVal = row.current_reading !== undefined && row.current_reading !== null ? Number(row.current_reading) : null;

      // Base result
      const result = {
        source_row: row.source_row,
        room_number: roomNum,
        utility_type: utilType,
        current_reading: currVal,
        technician_note: row.technician_note || "",
        reading_id: "",
        meter_number: "",
        previous_reading: 0,
        usage: null as number | null,
        validationStatus: "VALID" as "VALID" | "WARNING" | "DUPLICATE" | "ERROR",
        validationMessage: ""
      };

      // Validate room number
      if (!roomNum) {
        result.validationStatus = "ERROR";
        result.validationMessage = "ไม่พบเลขห้อง";
        return result;
      }

      // Validate utility type
      if (!["WATER", "ELECTRICITY"].includes(utilType)) {
        result.validationStatus = "ERROR";
        result.validationMessage = "ประเภทมิเตอร์ไม่ถูกต้อง";
        return result;
      }

      // Find unit by room number
      const matchedUnits = roomToUnit.get(roomNum);
      if (!matchedUnits || matchedUnits.length === 0) {
        result.validationStatus = "ERROR";
        result.validationMessage = "ไม่พบห้องในโครงการนี้";
        return result;
      }

      if (matchedUnits.length > 1) {
        result.validationStatus = "ERROR";
        result.validationMessage = "พบห้องซ้ำหลายรายการ ไม่สามารถระบุห้องที่ต้องการได้";
        return result;
      }

      const unit = matchedUnits[0];
      const lookupKey = `${unit.id}::${utilType}`;
      const matchedReadings = readingLookup.get(lookupKey);

      if (!matchedReadings || matchedReadings.length === 0) {
        const typeLabel = utilType === "WATER" ? "น้ำ" : "ไฟฟ้า";
        result.validationStatus = "ERROR";
        result.validationMessage = `ไม่พบมิเตอร์${typeLabel}ที่ใช้งานอยู่สำหรับห้องนี้`;
        return result;
      }

      if (matchedReadings.length > 1) {
        result.validationStatus = "ERROR";
        result.validationMessage = "พบมิเตอร์ซ้ำ ไม่สามารถระบุรายการได้";
        return result;
      }

      const reading = matchedReadings[0];
      result.reading_id = reading.id;
      result.previous_reading = Number(reading.previous_reading);
      
      // Extract meter_number from joined relation
      const meterData = reading.meter as unknown as { meter_number: string } | null;
      result.meter_number = meterData?.meter_number || "";

      // Check for duplicates in this import batch
      if (seenReadingIds.has(reading.id)) {
        result.validationStatus = "DUPLICATE";
        result.validationMessage = "ข้อมูลซ้ำ พบรายการนี้แล้วในไฟล์";
        return result;
      }
      seenReadingIds.add(reading.id);

      // Check if already approved
      if (reading.status === "APPROVED") {
        result.validationStatus = "ERROR";
        result.validationMessage = "รายการนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้";
        return result;
      }

      // Validate current reading
      if (currVal === null || isNaN(currVal)) {
        result.validationStatus = "ERROR";
        result.validationMessage = "ไม่พบเลขมิเตอร์ปัจจุบัน หรือระบุไม่ใช่ตัวเลข";
        return result;
      }

      if (currVal < 0) {
        result.validationStatus = "ERROR";
        result.validationMessage = "ค่ามิเตอร์ต้องไม่ติดลบ";
        return result;
      }

      // Stale previous reading protection
      if (reading.current_reading !== null && reading.status !== "PENDING") {
        const existingVal = Number(reading.current_reading);
        if (existingVal !== currVal) {
          result.validationStatus = "WARNING";
          result.validationMessage = `มีข้อมูลเดิมอยู่แล้ว (${existingVal}) จะถูกแทนที่ด้วย ${currVal}`;
        }
      }

      // Forward-only validation
      const prevVal = Number(reading.previous_reading);
      if (currVal < prevVal) {
        result.validationStatus = "ERROR";
        result.validationMessage = `ค่ามิเตอร์ใหม่ต่ำกว่าค่าครั้งก่อน (ครั้งก่อน: ${prevVal}, ที่กรอก: ${currVal})`;
        return result;
      }

      // Calculate usage
      const usage = currVal - prevVal;
      result.usage = usage;

      // Anomaly detection (only set as WARNING, don't block)
      if (result.validationStatus === "VALID") {
        if (usage > 50) {
          result.validationStatus = "WARNING";
          result.validationMessage = `ปริมาณการใช้สูงผิดปกติ (${usage} หน่วย)`;
        } else if (usage === 0) {
          result.validationStatus = "WARNING";
          result.validationMessage = "ปริมาณการใช้เป็นศูนย์";
        }
      }

      return result;
    });

    return NextResponse.json({
      success: true,
      cycle: {
        id: cycle.id,
        cycle_code: cycle.cycle_code,
        utility_type: cycle.utility_type,
        billing_month: cycle.billing_month
      },
      data: resolvedRows
    });
  } catch (error: unknown) {
    console.error("Resolve error:", error);
    const err = error as Record<string, unknown> | null;
    const code = err?.code;
    const msg = err?.message;
    if (code === "42P01" || (typeof msg === "string" && msg.includes("relation") && msg.includes("does not exist"))) {
      return NextResponse.json({
        success: false,
        code: "UTILITY_INFRASTRUCTURE_NOT_READY",
        message: "ระบบมิเตอร์และสาธารณูปโภคยังไม่พร้อมใช้งาน"
      }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
