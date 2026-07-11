-- =====================================================
-- IRM Enterprise Migration: 043_registration_requests.sql
-- =====================================================

-- 1. Create registration_requests table
CREATE TABLE public.registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    person_id UUID NULL REFERENCES public.persons(id) ON DELETE SET NULL,
    registration_type TEXT NOT NULL,
    relationship TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    nationality TEXT NULL,
    id_card TEXT NULL,
    passport TEXT NULL,
    invitation_source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    remarks TEXT NULL,
    
    -- Transaction Table Standard fields
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,

    -- Review fields
    reviewed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,

    -- Snapshot fields
    requested_unit_number TEXT NOT NULL,
    requested_property_name TEXT NULL,

    -- Client Audit fields
    source_ip INET NULL,
    user_agent TEXT NULL,

    -- Constraints
    CONSTRAINT chk_registration_requests_type CHECK (
        registration_type IN ('RESIDENT', 'TECHNICIAN', 'HOUSEKEEPING', 'SECURITY', 'COMMITTEE', 'STAFF')
    ),
    CONSTRAINT chk_registration_requests_relationship CHECK (
        relationship IN ('OWNER', 'CO_OWNER', 'RESIDENT', 'TENANT', 'FAMILY_MEMBER')
    ),
    CONSTRAINT chk_registration_requests_status CHECK (
        status IN ('PENDING', 'UNDER_REVIEW', 'MORE_INFO', 'APPROVED', 'REJECTED')
    ),
    CONSTRAINT chk_registration_requests_source CHECK (
        invitation_source IN ('QR', 'WEBSITE', 'OFFICE', 'SECURITY', 'ADMIN')
    )
);

-- 2. Indexes (no duplicates)
CREATE INDEX idx_registration_requests_property_id ON public.registration_requests(property_id);
CREATE INDEX idx_registration_requests_status ON public.registration_requests(status);
CREATE INDEX idx_registration_requests_unit_id ON public.registration_requests(unit_id);
CREATE INDEX idx_registration_requests_created_at ON public.registration_requests(created_at);
CREATE INDEX idx_registration_requests_person_id ON public.registration_requests(person_id);

-- 3. Add updated_at trigger
DROP TRIGGER IF EXISTS tr_registration_requests_updated_at ON public.registration_requests CASCADE;
CREATE TRIGGER tr_registration_requests_updated_at
    BEFORE UPDATE ON public.registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Enable RLS
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Allow select registration_requests for admins" ON public.registration_requests;
CREATE POLICY "Allow select registration_requests for admins" ON public.registration_requests
FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
        AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
        AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Allow insert registration_requests for public" ON public.registration_requests;
CREATE POLICY "Allow insert registration_requests for public" ON public.registration_requests
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update registration_requests for admins" ON public.registration_requests;
CREATE POLICY "Allow update registration_requests for admins" ON public.registration_requests
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
