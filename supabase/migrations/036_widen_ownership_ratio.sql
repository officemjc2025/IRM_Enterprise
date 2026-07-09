-- =====================================================
-- IRM Enterprise Migration: 036_widen_ownership_ratio.sql
-- =====================================================

-- 1. Drop dependent view
DROP VIEW IF EXISTS public.unit;

-- 2. Alter column type
ALTER TABLE public.units ALTER COLUMN ownership_ratio TYPE NUMERIC(12,6);

-- 3. Re-create view
CREATE OR REPLACE VIEW public.unit AS SELECT * FROM public.units;
