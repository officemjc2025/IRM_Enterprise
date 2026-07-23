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
  const unitId = "333952fd-a587-4b6b-bb1c-8a2e11380e3e"; // MJC 420/1

  const { data: res } = await supabase
    .from("reservations")
    .select("id")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("Simulating full select query in PATCH route...");
  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      property:property_id (id, property_name_th, property_name_en),
      unit:unit_id (id, unit_number),
      primary_guest:primary_guest_person_id (id, first_name, last_name, display_name),
      work_orders:work_orders (*),
      stay_charge_periods:stay_charge_periods (*)
    `)
    .eq("id", res.id)
    .single();

  console.log("data success:", !!data);
  console.log("error:", error);
}

run().catch(console.error);
