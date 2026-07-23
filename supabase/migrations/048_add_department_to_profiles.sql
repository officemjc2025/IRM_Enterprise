-- =====================================================
-- IRM Enterprise Migration: 048_add_department_to_profiles.sql
-- Add department column to profiles table and refresh backward-compatibility view.
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department TEXT;

-- Refresh the singular view for backward compatibility
CREATE OR REPLACE VIEW public.profile AS
SELECT * FROM public.profiles;
