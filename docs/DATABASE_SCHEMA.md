# IRM Enterprise — Database Schema Reference

This document describes the schema structure, relationships, RLS policies, and triggers for the IRM Enterprise database.

---

## Entity Relationship Summary (Textual)

```
auth.users (System)
  └── profiles (Public Profile)

properties (Properties List)
  └── buildings (Building Blocks)
        └── floors (Building Floors)
              └── units (Housing Units)
                    ├── occupancies (Unit Occupancy Details)
                    ├── resident_assignments (Resident Details)
                    ├── owner_assignments (Owner Mapping)
                    └── visitors (Visitor Check-in Records)

persons (General People Directory)
  ├── profiles (Optional)
  ├── owner_assignments
  ├── occupancies
  ├── resident_assignments
  └── vehicles (Vehicle ownership)
```

---

## Tables and Schema Descriptions

### 1. `roles` & `permissions`
- **Purpose**: System role-based access control mapping.
- **Keys**: `id` UUID PRIMARY KEY.
- **Audit Columns**: `created_at`, `updated_at`, `is_active`, `deleted_at`.
- **Triggers**: `update_updated_at_column`.

### 2. `profiles`
- **Purpose**: Extends system users with business profile details.
- **Keys**: `id` UUID PRIMARY KEY referencing `auth.users(id)`.
- **Foreign Keys**: `property_id` references `properties(id)`.
- **Triggers**: `on_auth_user_created` (auto profile creation on auth signup).

### 3. `properties`
- **Purpose**: High-level juristic entities / property management properties.
- **Keys**: `id` UUID PRIMARY KEY.
- **Constraints**: `property_code` UNIQUE, `status` CHECK ('ACTIVE', 'INACTIVE').

### 4. `buildings`
- **Purpose**: Building infrastructure under a property.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**: `property_id` references `properties(id)`.

### 5. `floors`
- **Purpose**: Floor infrastructure inside a building.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**: `building_id` references `buildings(id)`.

### 6. `units`
- **Purpose**: Individual units under a property.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**: `property_id` references `properties(id)`.

### 7. `persons`
- **Purpose**: Centralized database for all people (residents, guests, staff).
- **Keys**: `id` UUID PRIMARY KEY.
- **Constraints**: `person_code` UNIQUE.

### 8. `owners`
- **Purpose**: Property owner details.
- **Keys**: `id` UUID PRIMARY KEY.
- **Constraints**: `owner_code` UNIQUE.

### 9. `owner_assignments`
- **Purpose**: Mapping owners to units.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**:
  - `person_id` references `persons(id)`
  - `unit_id` references `units(id)`

### 10. `occupancies`
- **Purpose**: Active occupancy details of units.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**:
  - `person_id` references `persons(id)`
  - `unit_id` references `units(id)`

### 11. `visitors`
- **Purpose**: Visitor logs and check-in records.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**:
  - `unit_id` references `units(id)`
  - `occupancy_id` references `occupancies(id)`

### 12. `vehicles`
- **Purpose**: Parking and vehicle registration logs.
- **Keys**: `id` UUID PRIMARY KEY.
- **Foreign Keys**:
  - `person_id` references `persons(id)`
  - `unit_id` references `units(id)`

---

## Row Level Security (RLS) Summary
Every table has Row Level Security enabled.
- **Roles / Permissions / Lookups**: Authenticated read allowed (`SELECT`); writing restricted to `super_admin` role.
- **Profiles**: Restricted to own profile (`auth.uid() = id`), admins allowed select all profiles.
- **Operational Data (properties, buildings, floors, units, occupancies, etc.)**: Authenticated read allowed; write commands restricted to `super_admin`, `admin`, and `property_admin` roles.
