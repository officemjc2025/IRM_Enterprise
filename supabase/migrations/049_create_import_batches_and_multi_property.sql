-- Create import_batches table
CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name TEXT NOT NULL,
    module_name TEXT NOT NULL,
    status TEXT NOT NULL,
    summary JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

-- Add batch ID and photo URL to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add batch ID to persons
ALTER TABLE public.persons ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- Create profile_property_assignments junction table
CREATE TABLE IF NOT EXISTS public.profile_property_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    role TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_property_assignments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write batches (or restrict to admin roles)
CREATE POLICY "Allow admins full control on import_batches" ON public.import_batches
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow admins full control on profile_property_assignments" ON public.profile_property_assignments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Recreate profile view in exact order to expose new fields at the end
CREATE OR REPLACE VIEW public.profile AS
SELECT
    p.id,
    p.email,
    p.display_name,
    p.full_name,
    p.phone,
    p.avatar_url,
    p.role,
    p.property_id,
    p.language,
    p.theme,
    p.status,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    p.deleted_at,
    p.person_id,
    p.force_password_change,
    p.accepted_terms_at,
    p.accepted_privacy_at,
    p.account_status,
    p.department,
    p.import_batch_id,
    p.photo_url
FROM public.profiles p;
