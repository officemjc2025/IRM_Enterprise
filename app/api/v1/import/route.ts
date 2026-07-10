import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unitService } from "@/services/unit/unit.service";
import { Unit, UpdateUnitDto } from "@/features/unit/types/unit.types";
import { personService } from "@/services/person/person.service";

import { Person, UpdatePersonDto } from "@/features/person/types/person.types";
import { Status } from "@/shared/enums/status";
import {
  UnitOperationalStatus as CanonicalOpStatus,
} from "@/shared/enums/unit-operational-status";
import { ownerService } from "@/services/owner/owner.service";
import { Owner, UpdateOwnerDto as UpdateOwnerTypeDto } from "@/features/owner/types/owner.types";
import { ownershipService } from "@/services/ownership/ownership.service";
import { UpdateOwnershipDto } from "@/features/ownership/types/ownership.types";
import { occupancyService } from "@/services/occupancy/occupancy.service";
import { Occupancy, UpdateOccupancyDto, OccupancyType } from "@/features/occupancy/types/occupancy.types";

interface DbOwnerAssignment {
  id: string;
  person_id: string;
  unit_id: string;
  ownership_percent: number;
  ownership_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

export async function POST(request: Request) {
  console.log("Import Started");
  const startTime = Date.now();
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { payload, moduleName, importStrategy } = body;

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

    if (moduleName === "owner") {
      // 1. Business Validation (all-or-nothing check before any DB write)
      for (const item of payload) {
        if (!item.owner_code || String(item.owner_code).trim() === "") {
          throw new Error("Owner code is required and cannot be blank.");
        }
        if (!item.owner_name || String(item.owner_name).trim() === "") {
          throw new Error("Owner name is required and cannot be blank.");
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

      // 2. Fetch existing owners to perform Upsert Strategy (identify update vs insert)
      const existingOwners = await ownerService.getOwners();
      const existingOwnersMap = new Map<string, Owner>(); // owner_code -> Owner
      existingOwners.forEach((o) => {
        if (o.owner_code) {
          existingOwnersMap.set(o.owner_code.trim().toUpperCase(), o);
        }
      });

      // Track created IDs and updated original details for transaction rollback
      const createdIds: string[] = [];
      const updatedOwners: { id: string; original: UpdateOwnerTypeDto }[] = [];

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      try {
        for (const item of payload) {
          const key = String(item.owner_code).trim().toUpperCase();
          const existing = existingOwnersMap.get(key);

          const ownerNameVal = String(item.owner_name).trim();
          const emailVal = item.email ? String(item.email).trim().toLowerCase() : null;
          const phoneVal = item.phone ? String(item.phone).trim() : null;
          const statusVal = (item.status || "ACTIVE").toUpperCase() as Status;

          if (existing) {
            // Check if any attributes have actually changed to determine whether to update or skip
            const hasChanged =
              existing.full_name !== ownerNameVal ||
              (existing.phone || "") !== (phoneVal || "") ||
              (existing.email || "") !== (emailVal || "") ||
              existing.status !== statusVal;

            if (hasChanged) {
              updatedOwners.push({
                id: existing.id,
                original: {
                  owner_code: existing.owner_code,
                  full_name: existing.full_name,
                  phone: existing.phone,
                  email: existing.email,
                  status: existing.status,
                },
              });

              const updated = await ownerService.updateOwner(existing.id, {
                full_name: ownerNameVal,
                phone: phoneVal,
                email: emailVal,
                status: statusVal,
              });

              if (!updated) {
                throw new Error(`Failed to update existing owner: ${item.owner_code}`);
              }
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Create new owner using the Service layer
            const created = await ownerService.createOwner({
              owner_code: String(item.owner_code).trim(),
              full_name: ownerNameVal,
              phone: phoneVal,
              email: emailVal,
              status: statusVal,
            });

            if (!created?.id) {
              throw new Error(`Failed to create owner: ${item.owner_code}`);
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
            .from("owners")
            .delete()
            .in("id", createdIds);
          if (delError) {
            console.error("Rollback failed to delete created owners:", delError);
          }
        }

        // 2. Restore all updated records to their original states
        for (const updateInfo of updatedOwners) {
          await ownerService.updateOwner(updateInfo.id, updateInfo.original);
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

    if (moduleName === "occupancy") {
      const isWorkbookImport = payload.length > 0 && (payload[0].unit_number !== undefined || importStrategy === "dry_run" || importStrategy === "commit");

      if (isWorkbookImport) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        const strategy = importStrategy || "dry_run";
        const dryRun = strategy === "dry_run";

        const { data: importResult, error: importError } = await supabase.rpc(
          "import_occupancies",
          {
            p_rows: payload,
            p_actor_id: user.id,
            p_dry_run: dryRun
          }
        );

        if (importError) {
          console.error("Occupancy spreadsheet import failed:", importError);
          return NextResponse.json({
            success: false,
            message: `Occupancy import failed: ${importError.message}`,
            summary: {
              inserted: 0,
              updated: 0,
              skipped: 0,
              errors: payload.length,
              elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + "s",
            }
          }, { status: 400 });
        }

        const elapsed = Date.now() - startTime;
        return NextResponse.json({
          success: importResult.success,
          isDryRun: dryRun,
          message: dryRun
            ? "✔ Dry run simulation completed successfully. Zero database writes performed."
            : "✔ Occupancy import completed successfully",
          summary: {
            inserted: importResult.summary?.occupancies_created || 0,
            updated: importResult.summary?.occupancies_updated || 0,
            skipped: (importResult.summary?.totalRows || payload.length) - ((importResult.summary?.occupancies_created || 0) + (importResult.summary?.occupancies_updated || 0)),
            errors: importResult.summary?.errorRows || 0,
            elapsedTime: (elapsed / 1000).toFixed(2) + "s",
          },
          results: importResult.results || [],
          previewStats: importResult.previewStats || {}
        });
      }

      // 1. Business Validation (all-or-nothing check before any DB write)
      for (const item of payload) {
        if (!item.unit_id || String(item.unit_id).trim() === "") {
          throw new Error("Unit ID is required and cannot be blank.");
        }
        if (!item.person_id || String(item.person_id).trim() === "") {
          throw new Error("Person ID is required and cannot be blank.");
        }
        if (!item.occupancy_type || String(item.occupancy_type).trim() === "") {
          throw new Error("Occupancy type is required and cannot be blank.");
        }
        if (!item.move_in_date || String(item.move_in_date).trim() === "") {
          throw new Error("Move-in date is required and cannot be blank.");
        }
        const itemStatus = String(item.status || "ACTIVE").toUpperCase();
        if (!["ACTIVE", "INACTIVE"].includes(itemStatus)) {
          throw new Error(`Status '${itemStatus}' is invalid. Allowed values: ACTIVE, INACTIVE.`);
        }
      }

      // 2. Fetch existing occupancies to perform Upsert Strategy (identify update vs insert)
      const existingOccupancies = await occupancyService.getOccupancies();
      const existingOccupancyMap = new Map<string, Occupancy>(); // "unit_id:person_id" -> Occupancy (active only)
      existingOccupancies.forEach((occ) => {
        if (occ.unit_id && occ.person_id && occ.status === "ACTIVE") {
          existingOccupancyMap.set(`${occ.unit_id}:${occ.person_id}`, occ);
        }
      });

      // Track created IDs and updated original details for transaction rollback
      const createdIds: string[] = [];
      const updatedOccupancies: { id: string; original: UpdateOccupancyDto }[] = [];

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      try {
        for (const item of payload) {
          const key = `${item.unit_id}:${item.person_id}`;
          const existing = existingOccupancyMap.get(key);

          const typeVal = String(item.occupancy_type).toUpperCase() as OccupancyType;
          const startDateVal = String(item.move_in_date).trim();
          const endDateVal = item.move_out_date ? String(item.move_out_date).trim() : null;
          const remarkVal = item.remark ? String(item.remark).trim() : null;
          const statusVal = (item.status || "ACTIVE").toUpperCase() as Status;

          if (existing) {
            // Check if any attributes have actually changed to determine whether to update or skip
            const hasChanged =
              existing.occupancy_type !== typeVal ||
              existing.start_date !== startDateVal ||
              (existing.end_date || "") !== (endDateVal || "") ||
              (existing.remarks || "") !== (remarkVal || "") ||
              existing.status !== statusVal;

            if (hasChanged) {
              updatedOccupancies.push({
                id: existing.id,
                original: {
                  unit_id: existing.unit_id,
                  person_id: existing.person_id,
                  occupancy_type: existing.occupancy_type,
                  start_date: existing.start_date,
                  end_date: existing.end_date,
                  remarks: existing.remarks,
                  status: existing.status,
                },
              });

              const updated = await occupancyService.updateOccupancy(existing.id, {
                unit_id: String(item.unit_id),
                person_id: String(item.person_id),
                occupancy_type: typeVal,
                start_date: startDateVal,
                end_date: endDateVal,
                remarks: remarkVal,
                status: statusVal,
              });

              if (!updated) {
                throw new Error(`Failed to update existing occupancy: ${item.unit_number}`);
              }
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Create new occupancy using the Service layer
            const created = await occupancyService.createOccupancy({
              unit_id: String(item.unit_id),
              person_id: String(item.person_id),
              occupancy_type: typeVal,
              start_date: startDateVal,
              end_date: endDateVal,
              remarks: remarkVal,
              status: statusVal,
            });

            if (!created?.id) {
              throw new Error(`Failed to create occupancy: ${item.unit_number}`);
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
            .from("occupancies")
            .delete()
            .in("id", createdIds);
          if (delError) {
            console.error("Rollback failed to delete created occupancies:", delError);
          }
        }

        // 2. Restore all updated records to their original states
        for (const updateInfo of updatedOccupancies) {
          await occupancyService.updateOccupancy(updateInfo.id, updateInfo.original);
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

    if (moduleName === "owner_relationship") {
      // 1. Business Validation
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
        if (!item.unit_id) {
          throw new Error("Unit ID is required for owner assignment.");
        }
        if (!item.person_id) {
          throw new Error("Person ID is required for owner assignment.");
        }
        if (!item.property_id || !validPropertyIdSet.has(item.property_id)) {
          throw new Error(`Target property ID '${item.property_id || "missing"}' does not exist.`);
        }
      }

      // Load existing active owner assignments
      const { data: existingOwns } = await supabase
        .from("owner_assignments")
        .select("*")
        .eq("status", "ACTIVE")
        .is("deleted_at", null);



      const existingOwnsMap = new Map<string, DbOwnerAssignment>(); // "unit_id:person_id" -> row
      if (existingOwns) {
        existingOwns.forEach(o => {
          existingOwnsMap.set(`${o.unit_id}:${o.person_id}`, o as unknown as DbOwnerAssignment);
        });
      }

      // Track creations and updates for rollback
      const createdIds: string[] = [];
      const updatedOwns: { id: string; original: UpdateOwnershipDto }[] = [];

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      try {
        for (const item of payload) {
          const key = `${item.unit_id}:${item.person_id}`;
          const existing = existingOwnsMap.get(key);

          const percent = Number(
            item.ownership_percent !== undefined && item.ownership_percent !== null
              ? item.ownership_percent
              : (item.ownership_percentage !== undefined && item.ownership_percentage !== null
                  ? item.ownership_percentage
                  : 100)
          );
          const typeVal = String(item.owner_type || "OWNER").trim();
          const startDate = item.move_in_date ? String(item.move_in_date).trim() : new Date().toISOString().split("T")[0];
          const endDate = item.move_out_date ? String(item.move_out_date).trim() : null;
          const statusVal = (item.status || "ACTIVE").toUpperCase() as Status;

          if (existing) {
            const hasChanged =
              Number(existing.ownership_percent) !== percent ||
              existing.ownership_type !== typeVal ||
              existing.start_date !== startDate ||
              (existing.end_date || "") !== (endDate || "") ||
              existing.status !== statusVal;

            if (hasChanged) {
              updatedOwns.push({
                id: existing.id,
                original: {
                  person_id: existing.person_id,
                  unit_id: existing.unit_id,
                  ownership_percentage: Number(existing.ownership_percent),
                  ownership_type: existing.ownership_type,
                  start_date: existing.start_date,
                  end_date: existing.end_date,
                  status: existing.status as Status,
                }
              });

              const updated = await ownershipService.updateOwnership(existing.id, {
                person_id: item.person_id,
                unit_id: item.unit_id,
                ownership_percentage: percent,
                ownership_type: typeVal,
                start_date: startDate,
                end_date: endDate,
                status: statusVal,
              });

              if (!updated) {
                throw new Error(`Failed to update ownership for unit: ${item.unit_number}`);
              }
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            const created = await ownershipService.createOwnership({
              person_id: item.person_id,
              unit_id: item.unit_id,
              ownership_percentage: percent,
              ownership_type: typeVal,
              start_date: startDate,
              end_date: endDate,
              status: statusVal,
            });

            if (!created?.id) {
              throw new Error(`Failed to assign owner to unit: ${item.unit_number}`);
            }
            createdIds.push(created.id);
            insertedCount++;
          }
        }
      } catch (dbErr: unknown) {
        console.error("Database commit error, performing rollback:", dbErr);

        if (createdIds.length > 0) {
          await supabase.from("owner_assignments").delete().in("id", createdIds);
        }
        for (const updateInfo of updatedOwns) {
          await ownershipService.updateOwnership(updateInfo.id, updateInfo.original);
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
          }
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


// ============================================================
// Canonical Operational Status Resolver (Bootstrap-only)
// Maps workbook STATUS column values to three domain decisions:
//   1. unitStatus        → public.units.status (generic soft-delete flag)
//   2. ownerType         → owner_assignments.ownership_type  (null = no owner)
//   3. occupancyType     → occupancies.occupancy_type        (null = no occupancy)
//   4. operationalStatus → public.units.operational_status   (canonical state)
//
// ⚠️  BOOTSTRAP ONLY — After Go-Live, operational_status is lifecycle-driven.
//     This resolver is ONLY called during import to set the initial state.
// ============================================================
type UnitOperationalStatus = {
  unitStatus: string;                      // DB value for units.status
  ownerType: string | null;                // null = suppress owner assignment
  occupancyType: OccupancyType | null;     // null = no occupancy record
  operationalStatus: CanonicalOpStatus | null; // canonical operational_status value (null = preserve or skip)
  warning?: string;                        // optional warning message
};

function resolveOperationalStatus(_rawStatus: string | null | undefined): UnitOperationalStatus {
  // LEGACY CLASSIFICATION ONLY: Legacy status column is ignored for operational/occupancy mappings.
  // All units initialize as ACTIVE with OWNER ownerType, null occupancyType, and VACANT operationalStatus.
  return {
    unitStatus: "ACTIVE",
    ownerType: "OWNER",
    occupancyType: null,
    operationalStatus: "VACANT",
  };
}

if (moduleName === "combined_metro") {
      // 1. Business Validation
      const uniquePropertyIds = Array.from(new Set(payload.map(item => item.property_id).filter(Boolean)));
      if (uniquePropertyIds.length === 0) {
        throw new Error("No property ID specified in import data.");
      }
      const propertyId = uniquePropertyIds[0];

      const { data: propertyExists } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .single();

      if (!propertyExists) {
        throw new Error("Target property not found.");
      }

      // Local strategy settings
      const strategy = importStrategy || "dry_run";
      const isBootstrap = !!(
        body.isBootstrap ||
        body.importMode === "bootstrap" ||
        body.importStrategy === "bootstrap" ||
        body.importMode === "BOOTSTRAP"
      );

      const warnings: string[] = [];

      // CANONICAL PLANNER DATA STRUCTURES
      const units_to_upsert: Array<{
        unit_number: string;
        floor: string;
        area: number;
        ownership_ratio: number;
        status: string;
        operational_status: string | null;
      }> = [];

      const persons_to_create: Array<{
        display_name: string;
        first_name: string;
        last_name: string;
        unit_number: string;
      }> = [];

      const ownerships_to_create: Array<{
        unit_number: string;
        owner_name: string;
        ownership_type: string;
        ownership_percent: number;
      }> = [];

      const meters_to_create: Array<{
        unit_number: string;
        utility_type: "WATER" | "ELECTRICITY";
        meter_number: string;
      }> = [];

      // Pre-calculate owner counts per unit for Multi-Owner safety checks
      const ownerCountsByUnit = new Map<string, number>();
      for (const item of payload) {
        const unitNum = String(item.unit_number || "").trim().toUpperCase();
        const ownerName = String(item.owner_name || "").trim();
        if (unitNum && ownerName) {
          ownerCountsByUnit.set(unitNum, (ownerCountsByUnit.get(unitNum) || 0) + 1);
        }
      }

      const processedUnits = new Set<string>();
      const processedPersons = new Set<string>();
      const processedMeters = new Set<string>();

      for (const item of payload) {
        const unitNum = String(item.unit_number || "").trim().toUpperCase();
        if (!unitNum) continue;

        // A. Operational Status mapping & validation
        const opStatus = resolveOperationalStatus(item.occupancy_type || item.status);
        if (opStatus.warning) {
          warnings.push(`Unit ${unitNum}: ${opStatus.warning}`);
        }

        // B. Plan Unit upsert
        if (!processedUnits.has(unitNum)) {
          processedUnits.add(unitNum);
          units_to_upsert.push({
            unit_number: unitNum,
            floor: String(item.floor || "1"),
            area: Number(item.area || 0),
            ownership_ratio: Number(item.ownership_ratio || 0),
            status: opStatus.unitStatus,
            operational_status: isBootstrap ? opStatus.operationalStatus : null,
          });
        }

        // C. Plan Person creation
        const ownerName = String(item.owner_name || "").trim();
        let personKey = "";
        if (ownerName) {
          const parts = ownerName.split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "-";
          personKey = `${firstName.toUpperCase()}::${lastName.toUpperCase()}`;

          if (!processedPersons.has(personKey)) {
            processedPersons.add(personKey);
            persons_to_create.push({
              display_name: ownerName,
              first_name: firstName,
              last_name: lastName,
              unit_number: unitNum,
            });
          }
        }

        // D. Plan Owner Assignment (with single-owner policy and multi-owner safety check)
        if (ownerName && opStatus.ownerType) {
          const count = ownerCountsByUnit.get(unitNum) || 0;
          if (count === 1) {
            // SINGLE_KNOWN_OWNER_DEFAULT_POLICY
            ownerships_to_create.push({
              unit_number: unitNum,
              owner_name: ownerName,
              ownership_type: opStatus.ownerType,
              ownership_percent: 100.00,
            });
          } else {
            // MULTI-OWNER SAFETY: Skip Owner Assignment domain and emit warning (INTENTIONAL_DOMAIN_SKIP)
            warnings.push(`Unit ${unitNum}: Skip Owner Assignment — Multiple owners detected (${count}) and independent shares are not provided.`);
          }
        }

        // E. Plan Utility Meters (only if independently evidenced)
        if (item.water_meter) {
          const wmNumber = String(item.water_meter).trim();
          const meterKey = `${unitNum}:WATER`;
          if (!processedMeters.has(meterKey)) {
            processedMeters.add(meterKey);
            meters_to_create.push({
              unit_number: unitNum,
              utility_type: "WATER",
              meter_number: wmNumber,
            });
          }
        }

        if (item.electricity_meter) {
          const emNumber = String(item.electricity_meter).trim();
          const meterKey = `${unitNum}:ELECTRICITY`;
          if (!processedMeters.has(meterKey)) {
            processedMeters.add(meterKey);
            meters_to_create.push({
              unit_number: unitNum,
              utility_type: "ELECTRICITY",
              meter_number: emNumber,
            });
          }
        }
      }

      // Load existing counts for Dry Run summary simulation
      const { data: dbUnits } = await supabase
        .from("units")
        .select("unit_number")
        .eq("property_id", propertyId)
        .is("deleted_at", null);
      const existingUnitsSet = new Set((dbUnits || []).map(u => u.unit_number.trim().toUpperCase()));

      let dryRunInserted = 0;
      let dryRunUpdated = 0;
      for (const u of units_to_upsert) {
        if (existingUnitsSet.has(u.unit_number)) {
          dryRunUpdated++;
        } else {
          dryRunInserted++;
        }
      }

      // EXECUTE BATCH OR RETURN DRY RUN PREVIEW
      if (strategy === "dry_run") {
        const elapsed = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          isDryRun: true,
          message: "✔ Dry run simulation completed successfully. Zero database writes performed.",
          summary: {
            inserted: dryRunInserted,
            updated: dryRunUpdated,
            skipped: payload.length - (dryRunInserted + dryRunUpdated),
            errors: 0,
            elapsedTime: (elapsed / 1000).toFixed(2) + "s",
          },
          warnings: Array.from(new Set(warnings)),
          plan: {
            units_to_upsert,
            persons_to_create,
            ownerships_to_create,
            meters_to_create,
          }
        });
      }

      // REAL COMMIT PATH — SINGLE ATOMIC TRANSACTION VIA RPC
      const { data: importResult, error: importError } = await supabase.rpc(
        "import_validated_metro_plan",
        {
          p_property_id: propertyId,
          p_plan: {
            units_to_upsert,
            persons_to_create,
            ownerships_to_create,
            meters_to_create,
          }
        }
      );

      if (importError) {
        console.error("Validated plan batch import failed in database transaction:", importError);
        return NextResponse.json({
          success: false,
          message: `Batch import failed: ${importError.message}`,
          summary: {
            inserted: 0,
            updated: 0,
            skipped: 0,
            errors: payload.length,
            elapsedTime: ((Date.now() - startTime) / 1000).toFixed(2) + "s",
          }
        }, { status: 400 });
      }

      const elapsed = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        message: "✔ Import completed atomically in a single database transaction",
        summary: importResult.summary,
        warnings: Array.from(new Set(warnings)),
        elapsedTime: (elapsed / 1000).toFixed(2) + "s",
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
