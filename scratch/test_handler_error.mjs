import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Parse .env.local
const envLocal = fs.readFileSync("d:/Projects/IRM_Enterprise/irm/.env.local", "utf8");
const envVars = {};
for (const line of envLocal.split("\n")) {
  const parts = line.trim().split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join("=").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const propertyId = "92bdb0b6-52ff-4868-9335-c251f1f41bfd";
  const unitId = "333952fd-a587-4b6b-bb1c-8a2e11380e3e"; // MJC 420/1
  const guestPersonId = "7f89c504-95df-4622-9e31-88fb3682a0b0"; // John Doe

  console.log("1. Checking if unit belongs to selected property (equivalent to route.ts lines 132-138)...");
  // The route handler calls: supabase.from("unit") -- let's test if this fails!
  const { data: unitCheck, error: unitCheckErr } = await supabase
    .from("unit")
    .select("property_id")
    .eq("id", unitId)
    .single();

  console.log("unitCheck result:", unitCheck);
  console.log("unitCheck error:", unitCheckErr);

  console.log("\n2. Simulating the database insert (equivalent to route.ts lines 184-190)...");
  const payload = {
    property_id: propertyId,
    unit_id: unitId,
    reservation_type: "GUEST",
    check_in_at: new Date().toISOString(),
    check_out_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    status: "DRAFT",
    monthly_rate: null,
    daily_rate: null,
    base_rental_amount: null,
    discount_amount: 0,
    deposit_amount: 0,
    currency: "THB",
    booking_channel: "DIRECT",
    external_reference: null,
    guest_note: null,
    internal_note: null,
    created_by: "cb727a2c-ce5f-4902-9e3e-3bf318e66407"
  };

  const { data: created, error: insertErr } = await supabase
    .from("reservations")
    .insert([payload])
    .select(`
      *,
      property:property_id (id, property_name_th, property_name_en),
      unit:unit_id (id, unit_number)
    `)
    .single();

  console.log("created result:", created);
  console.log("insertErr:", insertErr);
}

run().catch(console.error);
