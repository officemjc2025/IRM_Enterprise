-- =====================================================
-- IRM Enterprise Migration: 032_staff_occupancy_type.sql
-- Adds STAFF as a recognized occupancy_type comment value
-- (The column is VARCHAR, so no enum alter needed)
-- This migration only adds a note for documentation purposes
-- and updates any legacy 'STAFF' comment references.
-- =====================================================

-- IRM Canonical Operational Status Tree (reference):
-- OWNER / OWNER_OCCUPIED  → units.status=ACTIVE,  ownership_type=OWNER,     occupancy_type=OWNER
-- TENANT / TENANT_OCCUPIED → units.status=ACTIVE,  ownership_type=OWNER,     occupancy_type=TENANT
-- VACANT                   → units.status=ACTIVE,  ownership_type=OWNER,     occupancy_type=(none)
-- MAINTENANCE              → units.status=MAINTENANCE, no assignments
-- OUT_OF_SERVICE           → units.status=INACTIVE, no assignments
-- LOCKED                   → units.status=INACTIVE, no assignments
-- STAFF                    → units.status=ACTIVE,  no ownership,            occupancy_type=STAFF
-- MJC / DEVELOPER          → units.status=ACTIVE,  ownership_type=DEVELOPER, occupancy_type=COMPANY

-- Add comment documenting valid occupancy_type values
COMMENT ON COLUMN public.occupancies.occupancy_type IS
  'Valid values: OWNER, CO_OWNER, TENANT, RESIDENT, STAFF, COMPANY, VACANT. '
  'STAFF is used for units occupied by building staff or management with no ownership record.';

-- Add comment documenting valid units.status values
COMMENT ON COLUMN public.units.status IS
  'Operational status: ACTIVE (normal), MAINTENANCE, INACTIVE (OUT_OF_SERVICE / LOCKED).';
