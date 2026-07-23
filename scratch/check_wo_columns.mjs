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
  const { data: wo, error } = await supabase
    .from("work_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("Last Work Order row from DB:");
  console.log(JSON.stringify(wo, null, 2));
}

run().catch(console.error);
