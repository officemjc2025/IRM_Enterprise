import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unitService } from "@/services/unit/unit.service";
import { Unit, UpdateUnitDto } from "@/features/unit/types/unit.types";
import { personService } from "@/services/person/person.service";
import { Person, UpdatePersonDto } from "@/features/person/types/person.types";
import { Status } from "@/shared/enums/status";

export async function POST(request: Request) {
  console.log("Import Started");
  const startTime = Date.now();
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { payload, moduleName } = body;

    if (!Array.isArray(payload)) {
      console.log("Import Failed");
      return NextResponse.json(
        { success: false, message: "Payload must be a JSON array" },
        { status: 400 }
      );
    }

    if (moduleName === "unit") {
      // 1. Business Validation (all-or-nothing check before any DB write)
      const uniquePropertyIds = Array.from(new Set(payload.map(item => item.property_id).filter(Boolean)));
      if (uniquePropertyIds.length === 0) {
        throw new Error("No property ID specified in import data.");
      }

      const { data: validProperties, error: propertiesError } = await supabase
        .from("properties")
        .select("id")
        .in("id", uniquePropertyIds);

      if (propertiesError) {
        throw new Error(`Failed to verify property existence: ${propertiesError.message}`);
      }

      const validPropertyIdSet = new Set(validProperties?.map(p => p.id) || []);

      for (const item of payload) {
        if (!item.unit_number || String(item.unit_number).trim() === "") {
          throw new Error("Unit number is required and cannot be blank.");
        }
        if (!item.floor || String(item.floor).trim() === "") {
          throw new Error("Floor is required and cannot be blank.");
        }
        const itemStatus = String(item.status || "ACTIVE").toUpperCase();
        if (!["ACTIVE", "INACTIVE", "MAINTENANCE"].includes(itemStatus)) {
          throw new Error(`Status '${itemStatus}' is invalid. Allowed values: ACTIVE, INACTIVE, MAINTENANCE.`);
        }
        if (!item.property_id || !validPropertyIdSet.has(item.property_id)) {
          throw new Error(`Target property ID '${item.property_id || "missing"}' does not exist in database.`);
        }
      }

      // 2. Fetch existing units to perform Upsert Strategy (identify update vs insert)
      const existingUnits = await unitService.getUnits();
      const existingUnitsMap = new Map<string, Unit>(); // "property_id:unit_number" -> Unit
      existingUnits.forEach((u) => {
        if (u.property_id && u.unit_number) {
          existingUnitsMap.set(`${u.property_id}:${u.unit_number.trim().toUpperCase()}`, u);
        }
      });

      // Track created IDs and updated original details for transaction rollback
      const createdIds: string[] = [];
      const updatedUnits: { id: string; original: UpdateUnitDto & { property_id: string } }[] = [];

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      try {
        for (const item of payload) {
          const key = `${item.property_id}:${String(item.unit_number).trim().toUpperCase()}`;
          const existing = existingUnitsMap.get(key);

          if (existing) {
            // Check if any attributes have actually changed to determine whether to update or skip
            const hasChanged =
              existing.building_code !== (item.building_code || "") ||
              existing.floor !== (item.floor || "") ||
              Number(existing.area) !== Number(item.area || 0) ||
              Number(existing.ownership_ratio) !== Number(item.ownership_ratio || 0) ||
              String(existing.status).toUpperCase() !== String(item.status || "ACTIVE").toUpperCase();

            if (hasChanged) {
              updatedUnits.push({
                id: existing.id,
                original: {
                  property_id: existing.property_id,
                  building_code: existing.building_code || "",
                  floor: existing.floor,
                  unit_number: existing.unit_number,
                  area: Number(existing.area || 0),
                  ownership_ratio: Number(existing.ownership_ratio || 0),
                  status: existing.status,
                },
              });

              const updated = await unitService.updateUnit(existing.id, {
                property_id: item.property_id,
                building_code: item.building_code || "",
                floor: item.floor,
                unit_number: item.unit_number,
                area: Number(item.area || 0),
                ownership_ratio: Number(item.ownership_ratio || 0),
                status: item.status,
              });

              if (!updated) {
                throw new Error(`Failed to update existing unit: ${item.unit_number}`);
              }
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Create new unit using the Service layer
            const created = await unitService.createUnit({
              property_id: item.property_id,
              building_code: item.building_code || "",
              floor: item.floor,
              unit_number: item.unit_number,
              area: Number(item.area || 0),
              ownership_ratio: Number(item.ownership_ratio || 0),
              status: item.status,
            });

            if (!created?.id) {
              throw new Error(`Failed to create unit: ${item.unit_number}`);
            }
            createdIds.push(created.id);
            insertedCount++;
          }
        }
      } catch (dbErr: unknown) {
        console.error("Database commit error, performing rollback:", dbErr);

        // Perform Transaction Rollback
        // 1. Delete all inserted records in this batch
        if (createdIds.length > 0) {
          const { error: delError } = await supabase
            .from("units")
            .delete()
            .in("id", createdIds);
          if (delError) {
            console.error("Rollback failed to delete created units:", delError);
          }
        }

        // 2. Restore all updated records to their original states
        for (const updateInfo of updatedUnits) {
          await unitService.updateUnit(updateInfo.id, updateInfo.original);
        }

        console.log("Import Failed");
        const elapsed = Date.now() - startTime;
        return NextResponse.json({
          success: false,
          message: "Import failed. No data has been saved.",
          summary: {
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: payload.length,
            elapsedTime: (elapsed / 1000).toFixed(2) + "s",
          },
        });
      }

      console.log("Import Finished");
      const elapsed = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "✔ Import completed successfully",
        summary: {
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: 0,
          elapsedTime: (elapsed / 1000).toFixed(2) + "s",
        },
      });
    }

    if (moduleName === "person") {
      // 1. Business Validation (all-or-nothing check before any DB write)
      for (const item of payload) {
        if (!item.person_code || String(item.person_code).trim() === "") {
          throw new Error("Person code is required and cannot be blank.");
        }
        if (!item.full_name || String(item.full_name).trim() === "") {
          throw new Error("Full name is required and cannot be blank.");
        }
        if (item.email && String(item.email).trim() !== "") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(item.email))) {
            throw new Error(`Invalid email format: '${item.email}'`);
          }
        }
        if (item.phone && String(item.phone).trim() !== "") {
          const digitsOnly = String(item.phone).replace(/\D/g, "");
          if (digitsOnly.length < 8) {
            throw new Error(`Phone number is too short (min 8 digits): '${item.phone}'`);
          }
        }
        const itemStatus = String(item.status || "ACTIVE").toUpperCase();
        if (!["ACTIVE", "INACTIVE"].includes(itemStatus)) {
          throw new Error(`Status '${itemStatus}' is invalid. Allowed values: ACTIVE, INACTIVE.`);
        }
      }

      // 2. Fetch existing persons to perform Upsert Strategy (identify update vs insert)
      const existingPersons = await personService.getPersons();
      const existingPersonsMap = new Map<string, Person>(); // person_code -> Person
      existingPersons.forEach((p) => {
        if (p.person_code) {
          existingPersonsMap.set(p.person_code.trim().toUpperCase(), p);
        }
      });

      // Track created IDs and updated original details for transaction rollback
      const createdIds: string[] = [];
      const updatedPersons: { id: string; original: UpdatePersonDto }[] = [];

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      try {
        for (const item of payload) {
          const key = String(item.person_code).trim().toUpperCase();
          const existing = existingPersonsMap.get(key);

          const parts = String(item.full_name).trim().split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "-";
          const displayName = item.display_name ? String(item.display_name).trim() : `${firstName} ${lastName}`;
          const remarkValue = item.remark || (item.person_type ? `Type: ${item.person_type}` : null);
          const emailVal = item.email ? String(item.email).trim().toLowerCase() : null;
          const phoneVal = item.phone ? String(item.phone).trim() : null;
          const statusVal = (item.status || "ACTIVE").toUpperCase() as Status;

          if (existing) {
            // Check if any attributes have actually changed to determine whether to update or skip
            const hasChanged =
              existing.first_name !== firstName ||
              existing.last_name !== lastName ||
              (existing.display_name || "") !== displayName ||
              (existing.phone || "") !== (phoneVal || "") ||
              (existing.email || "") !== (emailVal || "") ||
              (existing.remarks || "") !== (remarkValue || "") ||
              existing.status !== statusVal;

            if (hasChanged) {
              updatedPersons.push({
                id: existing.id,
                original: {
                  person_code: existing.person_code,
                  first_name: existing.first_name,
                  last_name: existing.last_name,
                  display_name: existing.display_name,
                  phone: existing.phone,
                  email: existing.email,
                  remarks: existing.remarks,
                  status: existing.status,
                },
              });

              const updated = await personService.updatePerson(existing.id, {
                first_name: firstName,
                last_name: lastName,
                display_name: displayName,
                phone: phoneVal,
                email: emailVal,
                remarks: remarkValue,
                status: statusVal,
              });

              if (!updated) {
                throw new Error(`Failed to update existing person: ${item.person_code}`);
              }
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Create new person using the Service layer
            const created = await personService.createPerson({
              person_code: String(item.person_code).trim(),
              first_name: firstName,
              last_name: lastName,
              display_name: displayName,
              phone: phoneVal,
              email: emailVal,
              remarks: remarkValue,
              status: statusVal,
            });

            if (!created?.id) {
              throw new Error(`Failed to create person: ${item.person_code}`);
            }
            createdIds.push(created.id);
            insertedCount++;
          }
        }
      } catch (dbErr: unknown) {
        console.error("Database commit error, performing rollback:", dbErr);

        // Perform Transaction Rollback
        // 1. Delete all inserted records in this batch
        if (createdIds.length > 0) {
          const { error: delError } = await supabase
            .from("persons")
            .delete()
            .in("id", createdIds);
          if (delError) {
            console.error("Rollback failed to delete created persons:", delError);
          }
        }

        // 2. Restore all updated records to their original states
        for (const updateInfo of updatedPersons) {
          await personService.updatePerson(updateInfo.id, updateInfo.original);
        }

        console.log("Import Failed");
        const elapsed = Date.now() - startTime;
        return NextResponse.json({
          success: false,
          message: "Import failed. No data has been saved.",
          summary: {
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: payload.length,
            elapsedTime: (elapsed / 1000).toFixed(2) + "s",
          },
        });
      }

      console.log("Import Finished");
      const elapsed = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "✔ Import completed successfully",
        summary: {
          inserted: insertedCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: 0,
          elapsedTime: (elapsed / 1000).toFixed(2) + "s",
        },
      });
    }

    // Default response for other modules
    console.log("Import Finished");
    const elapsed = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      message: `Import for module '${moduleName}' received successfully`,
      summary: {
        inserted: payload.length,
        updated: 0,
        skipped: 0,
        errors: 0,
        elapsedTime: (elapsed / 1000).toFixed(2) + "s",
      },
    });
  } catch (error: unknown) {
    console.log("Import Failed");
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Import failed. No data has been saved.";
    return NextResponse.json(
      {
        success: false,
        message: message.includes("does not exist") || message.includes("required") || message.includes("invalid")
          ? message
          : "Import failed. No data has been saved.",
        summary: {
          inserted: 0,
          updated: 0,
          skipped: 0,
          errors: 1,
          elapsedTime: (elapsed / 1000).toFixed(2) + "s",
        },
      },
      { status: 400 }
    );
  }
}
