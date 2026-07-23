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
const supabaseAnonKey = envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Sign in as admin
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin.uat@irmenterprise.com",
    password: envVars["UAT_ADMIN_PASSWORD"] || "AdminUatPass123!"
  });

  if (error) {
    console.error("Auth sign in failed:", error);
    process.exit(1);
  }

  const session = data.session;
  console.log("Logged in successfully. User email:", session.user.email);

  // Encode as base64 JSON session
  const rawSessionStr = JSON.stringify(session);
  const base64SessionStr = "base64-" + Buffer.from(rawSessionStr).toString("base64");
  const tokenCookieName = `sb-twauqxlzfwpggwgfmsac-auth-token`;
  const cookieHeader = `${tokenCookieName}=${encodeURIComponent(base64SessionStr)}`;

  console.log("Testing API fetch with Base64 Cookie...");
  const res = await fetch("http://localhost:3000/api/v1/units", {
    headers: {
      "Cookie": cookieHeader
    }
  });

  console.log("HTTP status:", res.status);
  const body = await res.json();
  console.log("Response success:", body.success);
  if (body.success) {
    console.log("Successfully authenticated using base64 cookie!");
    if (body.data && body.data.length > 0) {
      console.log("First unit number:", body.data[0].unit_number);
    }
  } else {
    console.log("Failed:", body);
  }
}

run().catch(console.error);
