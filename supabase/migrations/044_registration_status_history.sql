-- =====================================================
-- IRM Enterprise Migration: 044_registration_status_history.sql
-- =====================================================

ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;
