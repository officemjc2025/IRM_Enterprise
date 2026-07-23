-- =====================================================
-- IRM Enterprise Migration: 047_registration_settings_extensions.sql
-- =====================================================

ALTER TABLE public.registration_settings
ADD COLUMN IF NOT EXISTS activation_method TEXT NOT NULL DEFAULT 'SUPABASE_EMAIL',
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true;
