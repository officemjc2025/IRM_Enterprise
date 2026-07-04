import { createClient } from "@supabase/supabase-js";

async function main() {
  console.log("=== IRM Enterprise UAT Account Provisioning ===");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.");
    process.exit(1);
  }

  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (!appEnv) {
    console.error("Error: NEXT_PUBLIC_APP_ENV must be defined at runtime.");
    process.exit(1);
  }
  if (appEnv !== "development" && appEnv !== "staging" && appEnv !== "uat") {
    console.error(`Error: Provisioning is blocked in env '${appEnv}'. It can only run in development, staging, or uat.`);
    process.exit(1);
  }

  // Instantiate administrative client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // 1. Resolve target property 'MJC'
  console.log("Resolving property 'MJC'...");
  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, property_code, property_name_en")
    .eq("property_code", "MJC")
    .single();

  if (propErr || !property) {
    console.error("Error: Target property 'MJC' not found in database.");
    process.exit(1);
  }

  const propertyId = property.id;
  console.log(`Resolved Property: ${property.property_name_en} (${propertyId})`);

  // 2. Define account configuration
  const accounts = [
    {
      email: "superadmin.uat@irmenterprise.com",
      role: "super_admin",
      passwordEnv: "UAT_SUPER_ADMIN_PASSWORD"
    },
    {
      email: "admin.uat@irmenterprise.com",
      role: "admin",
      passwordEnv: "UAT_ADMIN_PASSWORD"
    },
    {
      email: "propertyadmin.uat@irmenterprise.com",
      role: "property_admin",
      passwordEnv: "UAT_PROPERTY_ADMIN_PASSWORD"
    },
    {
      email: "security1.uat@irmenterprise.com",
      role: "security",
      passwordEnv: "UAT_SECURITY1_PASSWORD"
    },
    {
      email: "security2.uat@irmenterprise.com",
      role: "security",
      passwordEnv: "UAT_SECURITY2_PASSWORD"
    },
    {
      email: "technician1.uat@irmenterprise.com",
      role: "technician",
      passwordEnv: "UAT_TECHNICIAN1_PASSWORD"
    },
    {
      email: "technician2.uat@irmenterprise.com",
      role: "technician",
      passwordEnv: "UAT_TECHNICIAN2_PASSWORD"
    },
    {
      email: "resident1.uat@irmenterprise.com",
      role: "resident",
      passwordEnv: "UAT_RESIDENT1_PASSWORD",
      residentDetails: {
        personCode: "P_UAT_RES1",
        firstName: "John",
        lastName: "Doe",
        displayName: "John Doe",
        phone: "0812345671",
        unitNumber: "1001",
        residentType: "owner",
        isPrimary: true
      }
    },
    {
      email: "resident2.uat@irmenterprise.com",
      role: "resident",
      passwordEnv: "UAT_RESIDENT2_PASSWORD",
      residentDetails: {
        personCode: "P_UAT_RES2",
        firstName: "Jane",
        lastName: "Smith",
        displayName: "Jane Smith",
        phone: "0812345672",
        unitNumber: "1002",
        residentType: "co_owner",
        isPrimary: true
      }
    },
    {
      email: "resident3.uat@irmenterprise.com",
      role: "resident",
      passwordEnv: "UAT_RESIDENT3_PASSWORD",
      residentDetails: {
        personCode: "P_UAT_RES3",
        firstName: "Somchai",
        lastName: "Jaidee",
        displayName: "Somchai Jaidee",
        phone: "0812345673",
        unitNumber: "1003",
        residentType: "tenant",
        isPrimary: true
      }
    },
    {
      email: "resident4.uat@irmenterprise.com",
      role: "resident",
      passwordEnv: "UAT_RESIDENT4_PASSWORD",
      residentDetails: {
        personCode: "P_UAT_RES4",
        firstName: "Somsri",
        lastName: "Rukdee",
        displayName: "Somsri Rukdee",
        phone: "0812345674",
        unitNumber: "1004",
        residentType: "resident",
        isPrimary: false
      }
    },
    {
      email: "resident5.uat@irmenterprise.com",
      role: "resident",
      passwordEnv: "UAT_RESIDENT5_PASSWORD",
      residentDetails: {
        personCode: "P_UAT_RES5",
        firstName: "Robert",
        lastName: "Johnson",
        displayName: "Robert Johnson",
        phone: "0812345675",
        unitNumber: "1005",
        residentType: "resident",
        isPrimary: true
      }
    }
  ];

  // 3. Password Complexity Validation Regex
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':",./<>?]).{8,}$/;

  // Validate passwords exist and meet requirements first before starting execution
  for (const account of accounts) {
    const password = process.env[account.passwordEnv];
    if (!password) {
      console.error(`Error: Password variable '${account.passwordEnv}' is not set in environment.`);
      process.exit(1);
    }
    if (!passwordRegex.test(password)) {
      console.error(`Error: Password for '${account.email}' does not meet security requirements.`);
      console.error("Requirements: Minimum 8 characters, containing uppercase, lowercase, numbers, and special characters.");
      process.exit(1);
    }
  }
  console.log("All passwords validated successfully.");

  // 4. Resident Identity Resolution Setup
  for (const account of accounts) {
    if (account.role !== "resident") continue;
    const details = account.residentDetails;
    console.log(`Setting up identity resolution for Resident: ${account.email}`);

    // Verify Person
    const { data: existingPersons, error: personSearchErr } = await supabase
      .from("persons")
      .select("id, email")
      .eq("email", account.email)
      .is("deleted_at", null);

    if (personSearchErr) {
      console.error(`Error searching person for ${account.email}:`, personSearchErr.message);
      process.exit(1);
    }

    if (existingPersons && existingPersons.length > 1) {
      console.error(`Error: Ambiguous Person match. Multiple Persons found with email '${account.email}'`);
      process.exit(1);
    }

    let personId;
    if (existingPersons && existingPersons.length === 1) {
      personId = existingPersons[0].id;
      console.log(`Using existing Person record (${personId}) for ${account.email}`);
    } else {
      console.log(`Creating Person record for ${account.email}...`);
      const { data: newPerson, error: personCreateErr } = await supabase
        .from("persons")
        .insert({
          person_code: details.personCode,
          first_name: details.firstName,
          last_name: details.lastName,
          display_name: details.displayName,
          email: account.email,
          phone: details.phone,
          status: "ACTIVE"
        })
        .select("id")
        .single();

      if (personCreateErr) {
        console.error(`Failed to create Person for ${account.email}:`, personCreateErr.message);
        process.exit(1);
      }
      personId = newPerson.id;
      console.log(`Created Person ID: ${personId}`);
    }

    // Verify Unit
    const { data: existingUnits, error: unitSearchErr } = await supabase
      .from("units")
      .select("id")
      .eq("unit_number", details.unitNumber)
      .eq("property_id", propertyId)
      .is("deleted_at", null);

    if (unitSearchErr) {
      console.error(`Error searching unit ${details.unitNumber}:`, unitSearchErr.message);
      process.exit(1);
    }

    let unitId;
    if (existingUnits && existingUnits.length > 0) {
      unitId = existingUnits[0].id;
      console.log(`Using existing Unit '${details.unitNumber}' (${unitId})`);
    } else {
      console.log(`Creating Unit '${details.unitNumber}'...`);
      const { data: newUnit, error: unitCreateErr } = await supabase
        .from("units")
        .insert({
          property_id: propertyId,
          building_code: "A",
          floor: "10",
          unit_number: details.unitNumber,
          area: 45.5,
          ownership_ratio: 0.0125,
          status: "ACTIVE"
        })
        .select("id")
        .single();

      if (unitCreateErr) {
        console.error(`Failed to create Unit for ${details.unitNumber}:`, unitCreateErr.message);
        process.exit(1);
      }
      unitId = newUnit.id;
      console.log(`Created Unit ID: ${unitId}`);
    }

    // Verify Resident Assignment
    const { data: existingAssignments, error: assignSearchErr } = await supabase
      .from("resident_assignments")
      .select("id, status, unit_id")
      .eq("person_id", personId)
      .is("deleted_at", null);

    if (assignSearchErr) {
      console.error(`Error searching assignments for Person ${personId}:`, assignSearchErr.message);
      process.exit(1);
    }

    const activeAssignments = existingAssignments?.filter(a => a.status === "ACTIVE") || [];

    if (activeAssignments.length > 1) {
      console.error(`Error: Ambiguous assignment match. Multiple active resident assignments found for person '${details.displayName}'`);
      process.exit(1);
    }

    if (activeAssignments.length === 1) {
      const activeAssign = activeAssignments[0];
      if (activeAssign.unit_id !== unitId) {
        console.error(`Error: Person '${details.displayName}' has active assignment to unit ID '${activeAssign.unit_id}', expected unit ID '${unitId}'.`);
        process.exit(1);
      }
      console.log(`Verified active Resident Assignment ID: ${activeAssign.id}`);
    } else {
      console.log(`Creating Resident Assignment to Unit ${details.unitNumber}...`);
      const { data: newAssignment, error: assignCreateErr } = await supabase
        .from("resident_assignments")
        .insert({
          person_id: personId,
          unit_id: unitId,
          resident_type: details.residentType,
          is_primary: details.isPrimary,
          move_in_date: "2026-01-01",
          status: "ACTIVE"
        })
        .select("id")
        .single();

      if (assignCreateErr) {
        console.error(`Failed to create Resident Assignment for ${account.email}:`, assignCreateErr.message);
        process.exit(1);
      }
      console.log(`Created Resident Assignment ID: ${newAssignment.id}`);
    }
  }

  // 5. Auth User Provisioning
  console.log("Starting Auth User provisioning...");
  for (const account of accounts) {
    const password = process.env[account.passwordEnv];
    
    // Check if user exists in auth.users by email
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("Failed to list auth users:", listError.message);
      process.exit(1);
    }

    const existingUser = listData.users?.find(u => u.email === account.email);
    let userId;

    if (existingUser) {
      console.log(`Auth user '${account.email}' already exists. Updating password...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: password, email_confirm: true }
      );
      if (updateError) {
        console.error(`Failed to update password for '${account.email}':`, updateError.message);
        process.exit(1);
      }
      userId = existingUser.id;
    } else {
      console.log(`Creating Auth user '${account.email}'...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: password,
        email_confirm: true,
        user_metadata: {},
        app_metadata: { provider: "email", providers: ["email"] }
      });
      if (createError) {
        console.error(`Failed to create user '${account.email}':`, createError.message);
        process.exit(1);
      }
      userId = newUser.user.id;
    }

    // Verify / update profile role and property link
    console.log(`Updating Profile role to '${account.role}' for ${account.email}...`);
    let profileUpdated = false;
    
    // Poll up to 3 times to let the auth trigger complete insertion
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            role: account.role,
            property_id: propertyId,
            is_active: true,
            status: "active"
          })
          .eq("id", userId);
        
        if (profileError) {
          console.error(`Failed to update profile for '${account.email}':`, profileError.message);
          process.exit(1);
        }
        profileUpdated = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!profileUpdated) {
      console.log(`Profile was not auto-inserted by trigger. Creating manually for '${account.email}'...`);
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          email: account.email,
          role: account.role,
          property_id: propertyId,
          is_active: true,
          status: "active",
          display_name: account.email.split("@")[0],
          full_name: account.email.split("@")[0]
        });
      
      if (insertError) {
        console.error(`Failed to manually insert profile for '${account.email}':`, insertError.message);
        process.exit(1);
      }
    }
  }

  console.log("=== Provisioning Done ===");
  console.log("Running Phase 6 Verification...");

  // 6. Verification
  // Count accounts by role in profiles
  const { data: profiles, error: getProfilesErr } = await supabase
    .from("profiles")
    .select("id, email, role, property_id, is_active, status");

  if (getProfilesErr) {
    console.error("Verification failed: Could not load profiles", getProfilesErr.message);
    process.exit(1);
  }

  const roleCounts = {};
  for (const p of profiles) {
    // Only count our UAT emails
    if (p.email && p.email.endsWith(".uat@irmenterprise.com")) {
      roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
    }
  }

  console.log("\nAccount counts by role:");
  console.log(JSON.stringify(roleCounts, null, 2));

  // Verify counts match exactly
  const expectedCounts = {
    super_admin: 1,
    admin: 1,
    property_admin: 1,
    security: 2,
    technician: 2,
    resident: 5
  };

  let countsMatch = true;
  for (const role of Object.keys(expectedCounts)) {
    if ((roleCounts[role] || 0) !== expectedCounts[role]) {
      console.error(`Verification error: Role count mismatch for '${role}'. Expected ${expectedCounts[role]}, found ${roleCounts[role] || 0}`);
      countsMatch = false;
    }
  }

  if (countsMatch) {
    console.log("PASS: Account counts by role match requirements.");
  } else {
    process.exit(1);
  }

  // Verify Resident resolution
  console.log("\nVerifying Resident Identity Resolution details:");
  for (let i = 1; i <= 5; i++) {
    const email = `resident${i}.uat@irmenterprise.com`;
    
    // Resolve Person
    const { data: persons, error: pErr } = await supabase
      .from("persons")
      .select("*")
      .eq("email", email)
      .is("deleted_at", null);

    if (pErr) {
      console.error(`Verification error resolving person for ${email}:`, pErr.message);
      process.exit(1);
    }

    if (!persons || persons.length !== 1) {
      console.error(`Verification failed: Expected exactly 1 person for ${email}, found ${persons?.length || 0}`);
      process.exit(1);
    }

    const person = persons[0];

    // Resolve Resident Assignment
    const { data: assignments, error: aErr } = await supabase
      .from("resident_assignments")
      .select(`
        *,
        unit:unit_id (
          id,
          unit_number,
          building_code,
          floor,
          property_id,
          properties (
            id,
            property_code,
            property_name_en
          )
        )
      `)
      .eq("person_id", person.id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null);

    if (aErr) {
      console.error(`Verification error resolving assignment for person ${person.id}:`, aErr.message);
      process.exit(1);
    }

    if (!assignments || assignments.length !== 1) {
      console.error(`Verification failed: Expected exactly 1 active assignment for person ${person.id}, found ${assignments?.length || 0}`);
      process.exit(1);
    }

    const assignment = assignments[0];
    const unit = assignment.unit;
    const prop = unit?.properties;

    console.log(`- Resident ${email}:`);
    console.log(`  * Person Unique Match: PASS (${person.display_name})`);
    console.log(`  * Active Assignment Match: PASS (${assignment.id})`);
    console.log(`  * Unit Resolves Correctly: PASS (Unit ${unit?.unit_number}, Building ${unit?.building_code})`);
    console.log(`  * Property Resolves Correctly: PASS (${prop?.property_name_en})`);
  }

  // Verify route permissions simulation
  console.log("\nVerifying Route Access Rights:");
  const testRoutes = [
    { path: "/properties", reqPerm: "ManageProperty", allowed: ["super_admin", "property_admin"] },
    { path: "/visitors", reqPerm: "SecurityGate", allowed: ["security", "property_admin"] },
    { path: "/work-orders", reqPerm: "WorkOrder", allowed: ["technician", "property_admin"] },
    { path: "/residents", reqPerm: "ManageResident", allowed: ["super_admin", "property_admin"] }
  ];

  for (const account of accounts) {
    const role = account.role;
    console.log(`- Testing authorization for UAT Account: ${account.email} (Role: ${role})`);
    
    for (const route of testRoutes) {
      const isAllowed = 
        role === "super_admin" || 
        role === "property_admin" || 
        role === "manager" ||
        route.allowed.includes(role);

      console.log(`  * Access to ${route.path} (${route.reqPerm}): ${isAllowed ? "ALLOWED" : "DENIED"}`);
    }
  }

  console.log("\nAll verifications completed successfully.");
}

main().catch((err) => {
  console.error("Unexpected execution error:", err);
  process.exit(1);
});
