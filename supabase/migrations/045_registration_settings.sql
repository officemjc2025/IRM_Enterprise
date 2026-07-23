-- =====================================================
-- IRM Enterprise Migration: 045_registration_settings.sql
-- =====================================================

-- 1. Create registration_settings table
CREATE TABLE public.registration_settings (
    property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    maintenance_message TEXT NULL,
    allow_owner BOOLEAN NOT NULL DEFAULT true,
    allow_co_owner BOOLEAN NOT NULL DEFAULT true,
    allow_resident BOOLEAN NOT NULL DEFAULT true,
    allow_tenant BOOLEAN NOT NULL DEFAULT true,
    allow_family_member BOOLEAN NOT NULL DEFAULT true,
    allow_technician BOOLEAN NOT NULL DEFAULT true,
    allow_housekeeping BOOLEAN NOT NULL DEFAULT true,
    allow_security BOOLEAN NOT NULL DEFAULT true,
    allow_committee BOOLEAN NOT NULL DEFAULT true,
    allow_staff BOOLEAN NOT NULL DEFAULT true,

    -- Transaction Standard fields
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Add updated_at trigger
DROP TRIGGER IF EXISTS tr_registration_settings_updated_at ON public.registration_settings CASCADE;
CREATE TRIGGER tr_registration_settings_updated_at
    BEFORE UPDATE ON public.registration_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Enable RLS
ALTER TABLE public.registration_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Allow select registration_settings for all" ON public.registration_settings;
CREATE POLICY "Allow select registration_settings for all" ON public.registration_settings
FOR SELECT TO anon, authenticated
USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Allow insert registration_settings for admins" ON public.registration_settings;
CREATE POLICY "Allow insert registration_settings for admins" ON public.registration_settings
FOR INSERT TO authenticated
WITH CHECK (
    public.is_admin()
    OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
        AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
        AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Allow update registration_settings for admins" ON public.registration_settings;
CREATE POLICY "Allow update registration_settings for admins" ON public.registration_settings
FOR UPDATE TO authenticated
USING (
    public.is_admin()
    OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
        AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
        AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
)
WITH CHECK (
    public.is_admin()
    OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
        AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
        AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Allow delete registration_settings for super_admin" ON public.registration_settings;
CREATE POLICY "Allow delete registration_settings for super_admin" ON public.registration_settings
FOR UPDATE TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
)
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);
