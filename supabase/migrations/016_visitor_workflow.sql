-- =====================================================
-- IRM Enterprise Migration: 016_visitor_workflow.sql
-- =====================================================

-- Drop old check constraint on status if exists
ALTER TABLE public.visitors DROP CONSTRAINT IF EXISTS chk_visitors_status;

-- Rename visitor_number to visitor_code if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visitors' AND column_name = 'visitor_number'
  ) THEN
    ALTER TABLE public.visitors RENAME COLUMN visitor_number TO visitor_code;
  END IF;
END $$;

-- Add resident_assignment_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visitors' AND column_name = 'resident_assignment_id'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN resident_assignment_id UUID REFERENCES public.resident_assignments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add visit_date column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visitors' AND column_name = 'visit_date'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN visit_date DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Add expected_arrival column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visitors' AND column_name = 'expected_arrival'
  ) THEN
    ALTER TABLE public.visitors ADD COLUMN expected_arrival TIMESTAMPTZ;
  END IF;
END $$;

-- Make unit_id nullable
ALTER TABLE public.visitors ALTER COLUMN unit_id DROP NOT NULL;

-- Make check_in_time nullable (and drop default NOW())
ALTER TABLE public.visitors ALTER COLUMN check_in_time DROP NOT NULL;
ALTER TABLE public.visitors ALTER COLUMN check_in_time DROP DEFAULT;

-- Make purpose nullable
ALTER TABLE public.visitors ALTER COLUMN purpose DROP NOT NULL;

-- Alter status default to 'CREATED'
ALTER TABLE public.visitors ALTER COLUMN status SET DEFAULT 'CREATED';

-- Add new check constraint on status
ALTER TABLE public.visitors ADD CONSTRAINT chk_visitors_status 
  CHECK (status IN ('CREATED', 'APPROVED', 'CHECKED_IN', 'INSIDE', 'CHECKED_OUT', 'CLOSED', 'CANCELLED'));

-- Re-create Singular View for backward compatibility
DROP VIEW IF EXISTS public.visitor CASCADE;
CREATE OR REPLACE VIEW public.visitor AS SELECT * FROM public.visitors;
