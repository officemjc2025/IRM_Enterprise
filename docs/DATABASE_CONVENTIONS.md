# IRM Enterprise — Database Conventions

This document describes the conventions and standards enforced across the database layer of IRM Enterprise.

---

## 1. Naming Conventions

### Physical Tables
All physical tables must use **lowercase, plural names**:
- Correct: `profiles`, `properties`, `buildings`, `floors`, `units`, `persons`, `owners`, `occupancies`, `visitors`, `vehicles`
- Incorrect: `profile`, `property`, `building`, `floor`, `unit`, `person`, `owner`, `occupancy`, `visitor`, `vehicle`

### Backward Compatibility Views
To support existing queries in repositories that query singular table names, an **updatable SQL view** matching the singular name must be created for every primary business table:
```sql
CREATE OR REPLACE VIEW public.property AS SELECT * FROM public.properties;
```

---

## 2. Primary Keys

Every table must use a single UUID primary key:
- Name: `id`
- Data type: `UUID`
- Default generator: `gen_random_uuid()` (PostgreSQL `pgcrypto` extension)

---

## 3. Foreign Keys

Foreign keys must follow the pattern of `<singular_table_name>_id`:
- Correct: `property_id`, `building_id`, `floor_id`, `unit_id`, `person_id`, `owner_id`, `occupancy_id`, `role_id`, `permission_id`
- Incorrect: `prop_id`, `buildingId`, `owner_fk`

---

## 4. Soft Delete & Audit Columns

All primary business tables must include the following audit and soft-delete columns:
- `id` UUID PRIMARY KEY
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `created_by` UUID (referencing `auth.users(id)` or NULL)
- `updated_by` UUID (referencing `auth.users(id)` or NULL)
- `deleted_at` TIMESTAMPTZ (holds deletion timestamp if deleted, NULL if active)
- `is_active` BOOLEAN DEFAULT TRUE

**Hard deletions of business records are strictly forbidden.** Soft deletes must be executed by setting `deleted_at` to `NOW()` and `is_active` to `FALSE`.

---

## 5. Row Level Security (RLS)

- Every physical table must have Row Level Security enabled:
  ```sql
  ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
  ```
- RLS policies must govern data visibility and mutation capabilities based on authenticated role states.

---

## 6. Triggers

- Every table with `updated_at` must feature an updated_at trigger:
  ```sql
  CREATE TRIGGER tr_table_updated_at BEFORE UPDATE ON public.table FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  ```
- Trigger functions must run as `SECURITY DEFINER` where they touch auth/user namespaces to avoid privilege escalation errors.
