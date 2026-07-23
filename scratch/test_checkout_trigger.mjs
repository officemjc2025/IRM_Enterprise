import fs from "fs";
import { createClient } from "@supabase/supabase-js";
// Wait, we can't import TS files in a Node script directly unless we use ts-node or similar.
// But we can connect via supabase client and simulate the workflow Service calls or run it directly!

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

  // Get the last reservation
  const { data: res } = await supabase
    .from("reservations")
    .select("*")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("Checking out reservation:", res.id);

  // Call the check_out RPC directly
  const { error: rpcErr } = await supabase.rpc("check_out_reservation", {
    p_reservation_id: res.id
  });

  console.log("check_out_reservation RPC error:", rpcErr);

  if (rpcErr) return;

  // Now, let's look at what we do in the route handler:
  // We trigger the CHECK_OUT workflow event, which creates a CLEANING work order.
  // Let's create the work order manually using supabase client to see if there is any database constraint error!
  const payload = {
    work_order_code: "WO-" + Math.floor(10000000 + Math.random() * 90000000),
    property_id: res.property_id,
    unit_id: res.unit_id,
    stay_id: res.id,
    category: "CLEANING",
    title: `Housekeeping - Unit 420/1`,
    description: `Automated cleaning dispatch after checkout event.`,
    priority: "NORMAL",
    status: "NEW",
    service_team: "HOUSEKEEPING",
    affects_operational_status: true,
    created_by: "cb727a2c-ce5f-4902-9e3e-3bf318e66407"
  };

  console.log("Inserting cleaning work order...");
  const { data: wo, error: woErr } = await supabase
    .from("work_orders")
    .insert([payload])
    .select("*")
    .single();

  console.log("wo result:", wo);
  console.log("woErr:", woErr);
}

run().catch(console.error);
