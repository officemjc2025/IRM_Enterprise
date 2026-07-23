import fs from "fs";
import { createServerClient } from "@supabase/ssr";

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

async function run() {
  const cookiesSet = [];

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesSet.push({ name, value, options });
          });
        }
      }
    }
  );

  console.log("Signing in using ssr client...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin.uat@irmenterprise.com",
    password: envVars["UAT_ADMIN_PASSWORD"] || "AdminUatPass123!"
  });

  if (error) {
    console.error("Sign in failed:", error);
    process.exit(1);
  }

  console.log("Sign in succeeded. Cookies set:");
  cookiesSet.forEach(c => {
    console.log(`- Name: ${c.name}`);
    console.log(`  Value length: ${c.value.length}`);
    console.log(`  Value prefix: ${c.value.slice(0, 100)}`);
  });
}

run().catch(console.error);
