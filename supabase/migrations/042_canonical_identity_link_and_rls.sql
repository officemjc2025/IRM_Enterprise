-- =====================================================
-- IRM Enterprise Migration: 042_canonical_identity_link_and_rls.sql
-- IRM-042: Canonical Identity Link and Access Security Foundation
-- =====================================================

-- =====================================================
-- 1. Add person_id Column to public.profiles
-- Nullable. FK to persons(id). ON DELETE SET NULL so
-- deleting a person never hard-deletes the auth account.
-- =====================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_person;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS person_id UUID;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_person
  FOREIGN KEY (person_id)
  REFERENCES public.persons(id)
  ON DELETE SET NULL;

-- =====================================================
-- 2. Deterministic Email Match Backfill
-- Links profiles to persons ONLY where exactly one
-- normalized email match exists in public.persons.
-- No name matching. No ownership inference.
-- No occupancy inference. Ambiguous → NULL. Zero → NULL.
-- =====================================================
UPDATE public.profiles p
SET person_id = pe.id
FROM public.persons pe
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(pe.email))
  AND pe.deleted_at IS NULL
  AND (
    SELECT COUNT(*) FROM public.persons pe2
    WHERE LOWER(TRIM(pe2.email)) = LOWER(TRIM(p.email)) AND pe2.deleted_at IS NULL
  ) = 1;

-- =====================================================
-- 3. Uniqueness Constraint on profiles.person_id
-- Enforces: one person → at most one auth profile.
-- NULL is excluded from uniqueness by SQL standard,
-- so unlinked profiles are not affected.
-- =====================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_person_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_person_id_key UNIQUE (person_id);

-- =====================================================
-- 4. Harden public.is_admin() helper
-- Re-defined here (does not modify migration 003) with
-- explicit SECURITY DEFINER and SET search_path to
-- prevent search_path injection attacks.
-- Semantics: returns TRUE only for super_admin and admin.
-- property_admin is NOT included — it receives its own
-- property-scoped policy clauses directly in each policy.
-- NULL auth.uid() → returns FALSE (fail closed).
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  );
END;
$$;

-- =====================================================
-- 5. Update handle_new_user Auth Trigger Function
-- SECURITY DEFINER with explicit search_path.
-- Auto-links new profile to person only when exactly
-- one person email match exists (deterministic).
-- Ambiguous or zero matches leave person_id NULL.
-- person_id is NOT supplied by client — derived server-side.
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_person_id UUID;
BEGIN
  -- Resolve exactly one person by normalized email.
  -- Zero or multiple matches → v_person_id stays NULL.
  SELECT id INTO v_person_id
  FROM public.persons
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    AND deleted_at IS NULL
    AND (
      SELECT COUNT(*) FROM public.persons
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email)) AND deleted_at IS NULL
    ) = 1;

  INSERT INTO public.profiles (id, email, display_name, full_name, role, status, language, theme, person_id)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    'resident',
    'active',
    'th',
    'light',
    v_person_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =====================================================
-- CANONICAL ACCESS HELPER: irm_active_assignment_ids()
-- Returns the set of resident_assignment IDs that are
-- currently active and temporally current for the
-- calling authenticated user.
-- Filters: status = ACTIVE, deleted_at IS NULL,
--          move_in_date <= CURRENT_DATE,
--          move_out_date IS NULL OR move_out_date >= CURRENT_DATE
-- Used in work_orders and visitors RLS policies to
-- prevent historical assignment traversal.
-- SECURITY DEFINER + search_path hardened.
-- Returns empty set when auth.uid() is NULL (fail closed).
-- =====================================================
CREATE OR REPLACE FUNCTION public.irm_active_assignment_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT ra.id
    FROM public.resident_assignments ra
    WHERE ra.person_id IN (
        SELECT person_id FROM public.profiles WHERE id = auth.uid()
      )
      AND ra.status = 'ACTIVE'
      AND ra.deleted_at IS NULL
      AND ra.move_in_date <= CURRENT_DATE
      AND (ra.move_out_date IS NULL OR ra.move_out_date >= CURRENT_DATE);
END;
$$;

REVOKE ALL ON FUNCTION public.irm_active_assignment_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.irm_active_assignment_ids() TO authenticated;

-- =====================================================
-- 6. Harden public.persons RLS Policies
--
-- super_admin / admin:     READ ALL (cross-property)
-- property_admin:          READ persons linked to own property
--                          via current resident_assignments or
--                          owner_assignments → units. NULL
--                          property_id → no access (fail closed).
-- security / technician /
--   housekeeping:          READ ALL (operational need)
-- resident:                READ ONLY their own linked person record
-- =====================================================
DROP POLICY IF EXISTS "Allow select persons for authenticated" ON public.persons;
CREATE POLICY "Allow select persons for authenticated" ON public.persons
FOR SELECT TO authenticated
USING (
  -- Global staff roles
  public.is_admin()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('security', 'technician', 'housekeeping')
  -- Property admin: scoped to persons linked to their property
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND id IN (
      SELECT DISTINCT ra.person_id FROM public.resident_assignments ra
      JOIN public.units u ON u.id = ra.unit_id
      WHERE u.property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
      UNION
      SELECT DISTINCT oa.person_id FROM public.owner_assignments oa
      JOIN public.units u ON u.id = oa.unit_id
      WHERE u.property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  -- Resident: own linked person record only
  OR id IN (SELECT person_id FROM public.profiles WHERE id = auth.uid())
);

-- =====================================================
-- 7. Harden public.occupancies RLS Policies
--
-- super_admin / admin:     READ ALL
-- property_admin:          READ occupancies in own property (via unit_id)
-- security / technician /
--   housekeeping:          READ ALL (operational need)
-- resident:                READ ONLY their own occupancy records
-- =====================================================
DROP POLICY IF EXISTS "Allow select occupancies for authenticated" ON public.occupancies;
CREATE POLICY "Allow select occupancies for authenticated" ON public.occupancies
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('security', 'technician', 'housekeeping')
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND unit_id IN (
      SELECT id FROM public.units
      WHERE property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR person_id IN (SELECT person_id FROM public.profiles WHERE id = auth.uid())
);

-- =====================================================
-- 8. Harden public.resident_assignments RLS Policies
--
-- super_admin / admin:     READ ALL
-- property_admin:          READ assignments in own property
-- security / technician /
--   housekeeping:          READ ALL (operational need)
-- resident:                READ ONLY their own assignment records
--                          (all statuses — historical records are
--                           visible to the resident themselves;
--                           authorization is gated in the resolver)
-- =====================================================
DROP POLICY IF EXISTS "Allow select resident_assignments for authenticated" ON public.resident_assignments;
CREATE POLICY "Allow select resident_assignments for authenticated" ON public.resident_assignments
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('security', 'technician', 'housekeeping')
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND unit_id IN (
      SELECT id FROM public.units
      WHERE property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR person_id IN (SELECT person_id FROM public.profiles WHERE id = auth.uid())
);

-- =====================================================
-- 9. Harden public.owner_assignments RLS Policies
--
-- super_admin / admin:     READ ALL
-- property_admin:          READ ownership in own property
-- security / technician /
--   housekeeping:          NO access (ownership is not
--                           required for operational workflows)
-- resident:                READ ONLY their own ownership records
-- =====================================================
DROP POLICY IF EXISTS "Allow select owner_assignments for authenticated" ON public.owner_assignments;
CREATE POLICY "Allow select owner_assignments for authenticated" ON public.owner_assignments
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND unit_id IN (
      SELECT id FROM public.units
      WHERE property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR person_id IN (SELECT person_id FROM public.profiles WHERE id = auth.uid())
);

-- =====================================================
-- 10. Harden public.work_orders RLS Policies
--
-- super_admin / admin:     READ ALL, WRITE ALL
-- property_admin:          READ/WRITE work orders in own property
-- technician:              READ/WRITE assigned work orders only
-- housekeeping:            READ/WRITE assigned work orders only
-- security:                NO direct work order access
-- resident:
--   created_by path:       Permanent — auth.uid() is a stable
--                          identity. A new auth account gets a
--                          new UUID so historical created_by
--                          records will never match (CASE_N safe).
--   resident_assignment    Scoped to CURRENTLY ACTIVE assignments
--     path:                only via irm_active_assignment_ids().
--                          Historical, ended, inactive, future,
--                          or soft-deleted assignments are excluded.
-- =====================================================
DROP POLICY IF EXISTS "Allow select work_orders for authenticated" ON public.work_orders;
CREATE POLICY "Allow select work_orders for authenticated" ON public.work_orders
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
  )
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  -- Resident assignment path: ONLY currently active assignments
  OR resident_assignment_id IN (SELECT public.irm_active_assignment_ids())
);

DROP POLICY IF EXISTS "Allow write work_orders for authenticated" ON public.work_orders;
CREATE POLICY "Allow write work_orders for authenticated" ON public.work_orders
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
  )
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
  )
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
);

-- =====================================================
-- 11. Harden public.documents RLS Policies
--
-- documents table has no property_id column.
-- All authenticated: READ (shared resource)
-- Only admins + property_admin: WRITE
-- property_admin write is allowed at table level since
-- there is no property_id to scope it further.
-- =====================================================
DROP POLICY IF EXISTS "Allow select documents for authenticated" ON public.documents;
CREATE POLICY "Allow select documents for authenticated" ON public.documents
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow write documents for authenticated" ON public.documents;
DROP POLICY IF EXISTS "Allow write documents for admins" ON public.documents;
CREATE POLICY "Allow write documents for admins" ON public.documents
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
)
WITH CHECK (
  public.is_admin()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
);

-- =====================================================
-- 12. Harden public.visitors RLS Policies
--
-- super_admin / admin:     READ ALL
-- security:                READ ALL (operational gatehouse need)
-- property_admin:          READ visitors in own property (via unit_id)
-- technician / housekeeping: NO visitor access
-- resident:                READ ONLY visitors linked to their
--                          CURRENTLY ACTIVE resident_assignments.
--                          Historical assignments do not grant
--                          access to historical visitor logs.
-- =====================================================
DROP POLICY IF EXISTS "Allow select visitors for authenticated" ON public.visitors;
CREATE POLICY "Allow select visitors for authenticated" ON public.visitors
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'security'
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND unit_id IN (
      SELECT id FROM public.units
      WHERE property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  -- Resident: ONLY visitors linked to currently active assignments
  OR resident_assignment_id IN (SELECT public.irm_active_assignment_ids())
);
