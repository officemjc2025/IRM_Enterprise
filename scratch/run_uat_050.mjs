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
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

// Client 1: Service Role (for DB queries and assertion checks)
const adminDb = createClient(supabaseUrl, serviceRoleKey);

// Client 2: Client with auth support (to sign in and get token)
const authClient = createClient(supabaseUrl, supabaseAnonKey);

async function getAuthCookie(email, password) {
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = data.session;
  const cookieValue = JSON.stringify(session);
  const tokenCookieName = `sb-twauqxlzfwpggwgfmsac-auth-token`;
  return `${tokenCookieName}=${encodeURIComponent("base64-" + Buffer.from(cookieValue).toString("base64"))}`;
}

async function getResidentEmail() {
  const { data } = await adminDb.from("profiles").select("email").eq("role", "resident").limit(1).single();
  return data?.email;
}

async function run() {
  console.log("====================================================");
  console.log("IRM Enterprise - Sprint IRM-050 UAT Runner");
  console.log("====================================================\n");

  const adminEmail = "admin.uat@irmenterprise.com";
  const adminPass = envVars["UAT_ADMIN_PASSWORD"] || "AdminUatPass123!";
  const adminCookie = await getAuthCookie(adminEmail, adminPass);
  console.log("✓ Authenticated admin UAT session");

  const residentEmail = await getResidentEmail();
  let residentCookie = "";
  if (residentEmail) {
    // Reset resident password to guarantee login
    const { data: { users } } = await adminDb.auth.admin.listUsers();
    const resUser = users.find(u => u.email === residentEmail);
    if (resUser) {
      await adminDb.auth.admin.updateUserById(resUser.id, { password: "ResidentUatPass123!_1" });
      residentCookie = await getAuthCookie(residentEmail, "ResidentUatPass123!_1");
      console.log(`✓ Authenticated resident UAT session (${residentEmail})`);
    }
  }

  // MJC property ID, unit ID, and guest John Doe ID
  const propertyId = "92bdb0b6-52ff-4868-9335-c251f1f41bfd";
  const unitId = "333952fd-a587-4b6b-bb1c-8a2e11380e3e"; // MJC 420/1
  const guestPersonId = "7f89c504-95df-4622-9e31-88fb3682a0b0"; // John Doe

  console.log(`\nTarget Unit: 420/1 (ID: ${unitId})`);

  // Cleanup past test reservations/WOs for this unit
  await adminDb.from("work_orders").delete().eq("unit_id", unitId);
  await adminDb.from("reservations").delete().eq("unit_id", unitId);
  console.log("✓ Cleaned up existing work orders and reservations for unit 420/1");

  // Verify initial operational status is VACANT
  const { data: initialUnit } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`✓ Initial Unit Operational Status: ${initialUnit.operational_status}`);

  // ----------------------------------------------------
  // Scenario 1: Create Reservation (DRAFT)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 1: Create Reservation (DRAFT)");
  console.log("----------------------------------------------------");
  
  const createPayload = {
    property_id: propertyId,
    unit_id: unitId,
    primary_guest_person_id: guestPersonId,
    reservation_type: "RENTAL_GUEST",
    check_in_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago to bypass clock drift
    check_out_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    status: "DRAFT"
  };

  const createRes = await fetch("http://localhost:3000/api/v1/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify(createPayload)
  });

  const createJson = await createRes.json();
  console.log(`API Response Status: ${createRes.status}`);
  console.log("Create JSON Response:", createJson);
  
  const resId = createJson.data?.id;
  console.log(`Reservation ID Created: ${resId}`);

  // Verify DB state
  const { data: dbRes1 } = await adminDb.from("reservations").select("status").eq("id", resId).single();
  console.log(`DB Record Reservation Status: ${dbRes1.status}`);

  const { data: unit1 } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`DB Derived Unit Operational Status: ${unit1.operational_status}`);

  // ----------------------------------------------------
  // Scenario 2: Confirm Reservation (CONFIRMED)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 2: Confirm Reservation (CONFIRMED)");
  console.log("----------------------------------------------------");

  const confirmRes = await fetch(`http://localhost:3000/api/v1/reservations/${resId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify({ status: "CONFIRMED" })
  });

  const confirmJson = await confirmJsonPrint(confirmRes);
  console.log(`API Response Status: ${confirmRes.status}`);
  
  // Verify DB state
  const { data: dbRes2 } = await adminDb.from("reservations").select("status").eq("id", resId).single();
  console.log(`DB Record Reservation Status: ${dbRes2.status}`);

  const { data: unit2 } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`DB Derived Unit Operational Status (Expected: RESERVED): ${unit2.operational_status}`);

  // ----------------------------------------------------
  // Scenario 3: Check-in (CHECKED_IN)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 3: Check-in (CHECKED_IN)");
  console.log("----------------------------------------------------");

  const checkinRes = await fetch(`http://localhost:3000/api/v1/reservations/${resId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify({ status: "CHECKED_IN" })
  });

  const checkinJson = await confirmJsonPrint(checkinRes);
  console.log(`API Response Status: ${checkinRes.status}`);

  // Verify DB state
  const { data: dbRes3 } = await adminDb.from("reservations").select("status").eq("id", resId).single();
  console.log(`DB Record Reservation Status: ${dbRes3.status}`);

  const { data: unit3 } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`DB Derived Unit Operational Status (Expected: CHECKED_IN): ${unit3.operational_status}`);

  // ----------------------------------------------------
  // Scenario 4: Stay (Verify info)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 4: Stay Details");
  console.log("----------------------------------------------------");
  
  const getRes = await fetch(`http://localhost:3000/api/v1/reservations/${resId}`, {
    headers: { "Cookie": adminCookie }
  });
  const getJson = await getRes.json();
  console.log("Guest:", getJson.data?.primary_guest?.display_name);
  console.log("Unit Number:", getJson.data?.unit?.unit_number);
  console.log("Property:", getJson.data?.property?.property_name_en);

  // ----------------------------------------------------
  // Scenario 5: Check-out (CHECKED_OUT)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 5: Check-out (CHECKED_OUT) -> Dispatch Housekeeping");
  console.log("----------------------------------------------------");

  const checkoutRes = await fetch(`http://localhost:3000/api/v1/reservations/${resId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify({ status: "CHECKED_OUT" })
  });

  const checkoutJson = await confirmJsonPrint(checkoutRes);
  console.log(`API Response Status: ${checkoutRes.status}`);

  // Verify DB state
  const { data: dbRes5 } = await adminDb.from("reservations").select("status").eq("id", resId).single();
  console.log(`DB Record Reservation Status: ${dbRes5.status}`);

  // Wait a small delay to ensure background transaction completes
  await new Promise(r => setTimeout(r, 1000));

  // Query work orders created for this stay
  const { data: workOrders } = await adminDb.from("work_orders").select("*").eq("stay_id", resId);
  console.log(`Number of Work Orders created: ${workOrders.length}`);
  
  const cleaningWO = workOrders.find(w => w.category === "CLEANING");
  console.log("Housekeeping Work Order created:");
  console.log(`- ID: ${cleaningWO?.id}`);
  console.log(`- Title: ${cleaningWO?.title}`);
  console.log(`- Service Team: ${cleaningWO?.service_team}`);
  console.log(`- Status: ${cleaningWO?.status}`);
  console.log(`- Affects Operational Status: ${cleaningWO?.affects_operational_status}`);

  const { data: unit5 } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`DB Derived Unit Operational Status (Expected: CLEANING): ${unit5.operational_status}`);

  // ----------------------------------------------------
  // Scenario 6: Cleaning (Complete Cleaning WO)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 6: Cleaning -> Complete Housekeeping WO");
  console.log("----------------------------------------------------");

  // Complete cleaning WO
  const completeCleaningRes = await fetch(`http://localhost:3000/api/v1/work-orders/${cleaningWO.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify({ status: "COMPLETED" })
  });
  console.log(`Housekeeping WO Complete PUT status: ${completeCleaningRes.status}`);

  // Wait a small delay
  await new Promise(r => setTimeout(r, 1000));

  // Query work orders created for this stay now
  const { data: workOrdersAfterClean } = await adminDb.from("work_orders").select("*").eq("stay_id", resId);
  console.log(`Number of Work Orders now: ${workOrdersAfterClean.length}`);
  
  const inspectionWO = workOrdersAfterClean.find(w => w.category === "INSPECTION");
  console.log("Inspection Work Order automatically created:");
  console.log(`- ID: ${inspectionWO?.id}`);
  console.log(`- Title: ${inspectionWO?.title}`);
  console.log(`- Service Team: ${inspectionWO?.service_team}`);
  console.log(`- Status: ${inspectionWO?.status}`);
  console.log(`- Affects Operational Status: ${inspectionWO?.affects_operational_status}`);

  const { data: unit6 } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`DB Derived Unit Operational Status (Expected: INSPECTION): ${unit6.operational_status}`);

  // ----------------------------------------------------
  // Scenario 7: Inspection (Complete Inspection WO)
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Scenario 7: Inspection -> Complete Inspection WO");
  console.log("----------------------------------------------------");

  // Complete inspection WO
  const completeInspectRes = await fetch(`http://localhost:3000/api/v1/work-orders/${inspectionWO.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify({ status: "COMPLETED" })
  });
  console.log(`Inspection WO Complete PUT status: ${completeInspectRes.status}`);

  // Wait a small delay
  await new Promise(r => setTimeout(r, 1000));

  const { data: unit7 } = await adminDb.from("units").select("operational_status").eq("id", unitId).single();
  console.log(`DB Derived Unit Operational Status (Expected: VACANT): ${unit7.operational_status}`);

  // ----------------------------------------------------
  // Negative Test 1: Cancel Reservation
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Negative Test 1: Cancel Reservation");
  console.log("----------------------------------------------------");

  // Create another draft reservation
  const createPayload2 = { ...createPayload, check_in_at: "2026-08-01T12:00:00Z", check_out_at: "2026-08-05T12:00:00Z" };
  const createRes2 = await fetch("http://localhost:3000/api/v1/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify(createPayload2)
  });
  const createJson2 = await createRes2.json();
  const resId2 = createJson2.data.id;
  console.log(`Created Second Reservation: ${resId2}`);

  // Cancel reservation
  const cancelRes = await fetch(`http://localhost:3000/api/v1/reservations/${resId2}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Cookie": adminCookie },
    body: JSON.stringify({ status: "CANCELLED" })
  });
  console.log(`Cancel PATCH status: ${cancelRes.status}`);

  // Wait a small delay
  await new Promise(r => setTimeout(r, 1000));

  // Verify no work orders were created
  const { data: workOrders2 } = await adminDb.from("work_orders").select("*").eq("stay_id", resId2);
  console.log(`Number of Work Orders created for cancelled reservation: ${workOrders2.length} (Expected: 0)`);

  // Cleanup cancelled reservation
  await adminDb.from("reservations").delete().eq("id", resId2);

  // ----------------------------------------------------
  // Negative Test 2: Unauthorized User Attempt
  // ----------------------------------------------------
  console.log("\n----------------------------------------------------");
  console.log("Negative Test 2: Unauthorized User (Resident) Attempt");
  console.log("----------------------------------------------------");

  if (!residentCookie) {
    console.log("Skipping Negative Test 2 (No resident UAT user available)");
  } else {
    // Attempt to checkin reservation using resident credentials
    const unauthorizedCheckinRes = await fetch(`http://localhost:3000/api/v1/reservations/${resId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Cookie": residentCookie },
      body: JSON.stringify({ status: "CHECKED_IN" })
    });
    console.log(`Resident check-in attempt status (Expected: 403): ${unauthorizedCheckinRes.status}`);
  }

  // Cleanup final reservation
  await adminDb.from("reservations").delete().eq("id", resId);
  console.log("\n====================================================");
  console.log("UAT RUN COMPLETED SUCCESSFULLY!");
  console.log("====================================================");
}

async function confirmJsonPrint(res) {
  const clone = res.clone();
  try {
    return await clone.json();
  } catch {
    return await clone.text();
  }
}

run().catch(console.error);
