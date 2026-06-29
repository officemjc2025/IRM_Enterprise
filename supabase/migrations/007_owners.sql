-- =====================================================
-- IRM Enterprise Migration: 007_owners.sql
-- =====================================================

-- Owners Table (Plural)
CREATE TABLE public.owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_code VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    email VARCHAR(255),
    nationality VARCHAR(100),
    tax_id VARCHAR(30),
    status VARCHAR(30) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Owner Assignments Table (Plural)
CREATE TABLE public.owner_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    ownership_type VARCHAR(30) DEFAULT 'OWNER',
    ownership_percent NUMERIC(5,2) DEFAULT 100,
    start_date DATE NOT NULL,
    end_date DATE,
    is_primary BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    remarks TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.owner CASCADE;
DROP VIEW IF EXISTS public.owner_assignment CASCADE;

-- Backward Compatibility Views
CREATE OR REPLACE VIEW public.owner AS SELECT * FROM public.owners;
CREATE OR REPLACE VIEW public.owner_assignment AS SELECT * FROM public.owner_assignments;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_owners_updated_at ON public.owners CASCADE;
DROP TRIGGER IF EXISTS tr_owner_assignments_updated_at ON public.owner_assignments CASCADE;

-- Triggers for updated_at
CREATE TRIGGER tr_owners_updated_at BEFORE UPDATE ON public.owners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_owner_assignments_updated_at BEFORE UPDATE ON public.owner_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select owners for authenticated" ON public.owners;
DROP POLICY IF EXISTS "Allow write owners for admins" ON public.owners;
DROP POLICY IF EXISTS "Allow select owner_assignments for authenticated" ON public.owner_assignments;
DROP POLICY IF EXISTS "Allow write owner_assignments for admins" ON public.owner_assignments;

-- RLS Policies
-- Owners policies
CREATE POLICY "Allow select owners for authenticated" ON public.owners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write owners for admins" ON public.owners FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);

-- Owner Assignments policies
CREATE POLICY "Allow select owner_assignments for authenticated" ON public.owner_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write owner_assignments for admins" ON public.owner_assignments FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);
