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

  const payload = {
    work_order_code: "WO-TEST-" + Math.floor(10000000 + Math.random() * 90000000),
    property_id: propertyId,
    unit_id: unitId,
    category: "CLEANING",
    title: `Test Cleaning Trigger`,
    priority: "NORMAL",
    status: "NEW",
    service_team: "HOUSEKEEPING",
    affects_operational_status: true,
    created_by: "cb727a2c-ce5f-4902-9e3e-3bf318e66407"
  };

  console.log("Inserting test work order to trigger the sync...");
  const { data, error } = await supabase
    .from("work_orders")
    .insert([payload])
    .select("*");

  console.log("Result data:", data);
  console.log("Result error:", error);

  if (data && data.length > 0) {
    // Clean up
    await supabase.from("work_orders").delete().eq("id", data[0].id);
  }
}

run().catch(console.error);
