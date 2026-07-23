-- =====================================================
-- IRM Enterprise Migration: 046_resident_activation.sql
-- =====================================================

-- 1. Add password change and terms flags to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ NULL;

-- 2. Add approval audit fields to registration_requests table
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMPTZ NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS portal_enabled_at TIMESTAMPTZ NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.person(id) ON DELETE SET NULL;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS resident_assignment_id UUID REFERENCES public.resident_assignments(id) ON DELETE SET NULL;

-- 3. Add account_status column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'ACTIVE';
