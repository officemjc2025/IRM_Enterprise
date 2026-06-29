-- =====================================================
-- IRM Enterprise Migration: 012_constraints.sql
-- =====================================================

-- Foreign Key Constraints that resolve cross-table references
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_property;
ALTER TABLE public.profiles 
  ADD CONSTRAINT fk_profiles_property 
  FOREIGN KEY (property_id) 
  REFERENCES public.properties(id) 
  ON DELETE SET NULL;

-- Check Constraints
-- Ownership percentage validation
ALTER TABLE public.owner_assignments DROP CONSTRAINT IF EXISTS chk_owner_assignments_percent;
ALTER TABLE public.owner_assignments 
  ADD CONSTRAINT chk_owner_assignments_percent 
  CHECK (ownership_percent >= 0 AND ownership_percent <= 100);

-- Property status check
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS chk_properties_status;
ALTER TABLE public.properties 
  ADD CONSTRAINT chk_properties_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Building status check
ALTER TABLE public.buildings DROP CONSTRAINT IF EXISTS chk_buildings_status;
ALTER TABLE public.buildings 
  ADD CONSTRAINT chk_buildings_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Floor status check
ALTER TABLE public.floors DROP CONSTRAINT IF EXISTS chk_floors_status;
ALTER TABLE public.floors 
  ADD CONSTRAINT chk_floors_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Unit status check
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS chk_units_status;
ALTER TABLE public.units 
  ADD CONSTRAINT chk_units_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE'));

-- Person status check
ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS chk_persons_status;
ALTER TABLE public.persons 
  ADD CONSTRAINT chk_persons_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Owner status check
ALTER TABLE public.owners DROP CONSTRAINT IF EXISTS chk_owners_status;
ALTER TABLE public.owners 
  ADD CONSTRAINT chk_owners_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Owner Assignment status check
ALTER TABLE public.owner_assignments DROP CONSTRAINT IF EXISTS chk_owner_assignments_status;
ALTER TABLE public.owner_assignments 
  ADD CONSTRAINT chk_owner_assignments_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Occupancy status check
ALTER TABLE public.occupancies DROP CONSTRAINT IF EXISTS chk_occupancies_status;
ALTER TABLE public.occupancies 
  ADD CONSTRAINT chk_occupancies_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Resident Assignment status check
ALTER TABLE public.resident_assignments DROP CONSTRAINT IF EXISTS chk_resident_assignments_status;
ALTER TABLE public.resident_assignments 
  ADD CONSTRAINT chk_resident_assignments_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Vehicle status check
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS chk_vehicles_status;
ALTER TABLE public.vehicles 
  ADD CONSTRAINT chk_vehicles_status 
  CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Visitor status check
ALTER TABLE public.visitors DROP CONSTRAINT IF EXISTS chk_visitors_status;
ALTER TABLE public.visitors 
  ADD CONSTRAINT chk_visitors_status 
  CHECK (status IN ('CHECKED_IN', 'CHECKED_OUT', 'OVERSTAYED'));
