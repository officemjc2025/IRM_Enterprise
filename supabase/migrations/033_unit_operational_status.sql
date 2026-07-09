-- =====================================================
-- IRM Enterprise Migration: 033_unit_operational_status.sql
-- =====================================================
-- PURPOSE
-- Introduces `operational_status` as the single authoritative
-- operational state for every unit.
--
-- Architecture rules enforced by this schema:
--   - Owner Assignment NEVER sets operational_status directly.
--   - Resident Assignment NEVER sets operational_status directly.
--   - Only lifecycle services (via /api/v1/units/:id/status) may
--     transition operational_status and must write an audit record.
--   - Work Orders may affect operational_status ONLY when the work
--     order has affects_operational_status = TRUE.
--
-- CANONICAL STATUS TREE (highest-priority wins)
--   OUT_OF_SERVICE  (1) Unit disabled
--   LOCKED          (2) Admin lock
--   MAINTENANCE     (3) Under maintenance / repair
--   CHECKED_IN      (4) Short-stay guest inside
--   CHECKING_IN     (5) Check-in in progress
--   CHECKING_OUT    (6) Check-out in progress
--   RESERVED        (7) Confirmed reservation upcoming
--   OWNER_OCCUPIED  (8) Owner residing
--   TENANT_OCCUPIED (9) Tenant residing
--   STAFF           (10) Staff occupying unit
--   MJC             (11) Developer / management unit
--   VACANT          (12) No active occupancy
-- =====================================================

-- -------------------------------------------------------
-- 1. ADD operational_status COLUMN TO public.units
-- -------------------------------------------------------
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS operational_status VARCHAR(30)
    NOT NULL DEFAULT 'VACANT'
    CONSTRAINT chk_unit_operational_status CHECK (operational_status IN (
      'OWNER_OCCUPIED',
      'TENANT_OCCUPIED',
      'VACANT',
      'RESERVED',
      'CHECKING_IN',
      'CHECKED_IN',
      'CHECKING_OUT',
      'MAINTENANCE',
      'OUT_OF_SERVICE',
      'STAFF',
      'MJC',
      'LOCKED'
    ));

COMMENT ON COLUMN public.units.operational_status IS
  'Single authoritative operational status. '
  'Canonical values (priority high→low): '
  'OUT_OF_SERVICE, LOCKED, MAINTENANCE, CHECKED_IN, CHECKING_IN, CHECKING_OUT, '
  'RESERVED, OWNER_OCCUPIED, TENANT_OCCUPIED, STAFF, MJC, VACANT. '
  'MUST be changed only through the unit status lifecycle API (/api/v1/units/:id/status). '
  'Never infer from Owner or Resident data after Go-Live.';

-- -------------------------------------------------------
-- 2. ADD affects_operational_status FLAG TO public.work_orders
--    Only work orders with this flag = TRUE may trigger
--    an automatic MAINTENANCE lock on their unit.
-- -------------------------------------------------------
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS affects_operational_status BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.work_orders.affects_operational_status IS
  'When TRUE, transitioning this work order to IN_PROGRESS will '
  'automatically lock the unit to MAINTENANCE operational status. '
  'Completing/closing the work order will trigger a re-derive of '
  'operational_status from authoritative occupancy data.';

-- -------------------------------------------------------
-- 3. BACKFILL — derive operational_status from authoritative data
--    Runs priority order lowest → highest so highest wins.
--    Start: all VACANT (already the column DEFAULT).
-- -------------------------------------------------------

-- Priority 11 (MJC) — developer-owned units
UPDATE public.units u
SET operational_status = 'MJC'
WHERE EXISTS (
  SELECT 1 FROM public.occupancies o
  WHERE o.unit_id = u.id
    AND o.occupancy_type = 'COMPANY'
    AND o.status = 'ACTIVE'
    AND (o.deleted_at IS NULL)
)
AND u.deleted_at IS NULL;

-- Priority 10 (STAFF) — staff-occupied units
UPDATE public.units u
SET operational_status = 'STAFF'
WHERE EXISTS (
  SELECT 1 FROM public.occupancies o
  WHERE o.unit_id = u.id
    AND o.occupancy_type = 'STAFF'
    AND o.status = 'ACTIVE'
    AND (o.deleted_at IS NULL)
)
AND u.deleted_at IS NULL;

-- Priority 8 (OWNER_OCCUPIED) — units with active OWNER or CO_OWNER occupancy
UPDATE public.units u
SET operational_status = 'OWNER_OCCUPIED'
WHERE EXISTS (
  SELECT 1 FROM public.occupancies o
  WHERE o.unit_id = u.id
    AND o.occupancy_type IN ('OWNER', 'CO_OWNER')
    AND o.status = 'ACTIVE'
    AND (o.deleted_at IS NULL)
)
AND u.deleted_at IS NULL;

-- Priority 9 (TENANT_OCCUPIED) — units with active TENANT occupancy
-- (overrides OWNER_OCCUPIED if a tenant is also present)
UPDATE public.units u
SET operational_status = 'TENANT_OCCUPIED'
WHERE EXISTS (
  SELECT 1 FROM public.occupancies o
  WHERE o.unit_id = u.id
    AND o.occupancy_type = 'TENANT'
    AND o.status = 'ACTIVE'
    AND (o.deleted_at IS NULL)
)
AND u.deleted_at IS NULL;

-- Priority 7 (RESERVED) — units with confirmed upcoming reservations
-- Uses a DO block to be resilient if the reservations table has different structure.
DO $$
BEGIN
  UPDATE public.units u
  SET operational_status = 'RESERVED'
  WHERE EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.unit_id = u.id
      AND r.status = 'CONFIRMED'
      AND r.check_in_date >= CURRENT_DATE
      AND (r.deleted_at IS NULL)
  )
  AND u.deleted_at IS NULL;
EXCEPTION WHEN OTHERS THEN
  -- reservations table structure differs; skip gracefully
  RAISE NOTICE 'RESERVED backfill skipped: %', SQLERRM;
END;
$$;

-- Priority 4-6 (CHECKED_IN / CHECKING_IN / CHECKING_OUT) — from active stays
DO $$
BEGIN
  -- CHECKING_OUT (priority 6, overridden by higher)
  UPDATE public.units u
  SET operational_status = 'CHECKING_OUT'
  WHERE EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.unit_id = u.id
      AND r.status IN ('CHECKING_OUT', 'DEPARTING')
      AND (r.deleted_at IS NULL)
  )
  AND u.deleted_at IS NULL;

  -- CHECKING_IN (priority 5)
  UPDATE public.units u
  SET operational_status = 'CHECKING_IN'
  WHERE EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.unit_id = u.id
      AND r.status IN ('CHECKING_IN', 'ARRIVING')
      AND (r.deleted_at IS NULL)
  )
  AND u.deleted_at IS NULL;

  -- CHECKED_IN (priority 4)
  UPDATE public.units u
  SET operational_status = 'CHECKED_IN'
  WHERE EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.unit_id = u.id
      AND r.status IN ('CHECKED_IN', 'STAYING', 'ACTIVE')
      AND (r.deleted_at IS NULL)
  )
  AND u.deleted_at IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Stay/reservation status backfill skipped: %', SQLERRM;
END;
$$;

-- Priority 3 (MAINTENANCE) — units whose generic status is MAINTENANCE
UPDATE public.units u
SET operational_status = 'MAINTENANCE'
WHERE u.status = 'MAINTENANCE'
  AND u.deleted_at IS NULL;

-- Priority 1-2 (OUT_OF_SERVICE / LOCKED) — archived/inactive units
UPDATE public.units u
SET operational_status = 'OUT_OF_SERVICE'
WHERE u.status = 'INACTIVE'
  AND u.deleted_at IS NULL;

-- -------------------------------------------------------
-- 4. UPDATE the backward-compat view to expose the new column
-- -------------------------------------------------------
CREATE OR REPLACE VIEW public.unit AS SELECT * FROM public.units;

-- -------------------------------------------------------
-- 5. PERFORMANCE INDEX
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_units_operational_status
  ON public.units (operational_status)
  WHERE deleted_at IS NULL;

-- -------------------------------------------------------
-- 6. RLS NOTE
-- -------------------------------------------------------
-- No new RLS policies needed — operational_status is part
-- of the existing units table which already has RLS.
-- The status-change lifecycle API enforces access control
-- at the application layer (property_admin+ roles only).
