-- =====================================================
-- IRM Enterprise Migration: 010_indexes.sql
-- =====================================================

-- RBAC
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_property ON public.profiles(property_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Properties, Buildings, Floors
CREATE INDEX IF NOT EXISTS idx_properties_code ON public.properties(property_code);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON public.buildings(property_id);
CREATE INDEX IF NOT EXISTS idx_buildings_code ON public.buildings(building_code);
CREATE INDEX IF NOT EXISTS idx_floors_building ON public.floors(building_id);
CREATE INDEX IF NOT EXISTS idx_floors_number ON public.floors(floor_number);

-- Units
CREATE INDEX IF NOT EXISTS idx_units_property ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_building ON public.units(building_code);
CREATE INDEX IF NOT EXISTS idx_units_number ON public.units(unit_number);
CREATE INDEX IF NOT EXISTS idx_units_status ON public.units(status);

-- Persons
CREATE INDEX IF NOT EXISTS idx_persons_code ON public.persons(person_code);
CREATE INDEX IF NOT EXISTS idx_persons_name ON public.persons(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_persons_status ON public.persons(status);

-- Owners & Owner Assignments
CREATE INDEX IF NOT EXISTS idx_owners_code ON public.owners(owner_code);
CREATE INDEX IF NOT EXISTS idx_owners_status ON public.owners(status);
CREATE INDEX IF NOT EXISTS idx_owner_assignments_person ON public.owner_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_owner_assignments_unit ON public.owner_assignments(unit_id);
CREATE INDEX IF NOT EXISTS idx_owner_assignments_status ON public.owner_assignments(status);

-- Occupancies, Resident Assignments
CREATE INDEX IF NOT EXISTS idx_occupancies_unit ON public.occupancies(unit_id);
CREATE INDEX IF NOT EXISTS idx_occupancies_person ON public.occupancies(person_id);
CREATE INDEX IF NOT EXISTS idx_occupancies_type ON public.occupancies(occupancy_type);
CREATE INDEX IF NOT EXISTS idx_occupancies_status ON public.occupancies(status);
CREATE INDEX IF NOT EXISTS idx_resident_assignments_person ON public.resident_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_resident_assignments_unit ON public.resident_assignments(unit_id);
CREATE INDEX IF NOT EXISTS idx_resident_assignments_status ON public.resident_assignments(status);

-- Vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(registration_no);
CREATE INDEX IF NOT EXISTS idx_vehicles_person ON public.vehicles(person_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_unit ON public.vehicles(unit_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_rfid ON public.vehicles(rfid_code);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);

-- Visitors
CREATE INDEX IF NOT EXISTS idx_visitors_number ON public.visitors(visitor_number);
CREATE INDEX IF NOT EXISTS idx_visitors_unit ON public.visitors(unit_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON public.visitors(status);
