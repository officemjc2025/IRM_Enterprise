-- =====================================================
-- IRM Enterprise Migration: 055_widen_unit_operational_status_constraint.sql
-- =====================================================

-- Widen units.operational_status constraint to include CLEANING and INSPECTION
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS chk_unit_operational_status;
ALTER TABLE public.units ADD CONSTRAINT chk_unit_operational_status CHECK (
  operational_status IN (
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
    'LOCKED',
    'CLEANING',
    'INSPECTION'
  )
);
