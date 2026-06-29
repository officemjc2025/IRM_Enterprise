-- =====================================================
-- IRM Enterprise Migration: 006_persons.sql
-- =====================================================

-- Persons Table (Plural)
CREATE TABLE public.persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_code VARCHAR(30) UNIQUE,
    title VARCHAR(30),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    gender VARCHAR(30),
    date_of_birth DATE,
    nationality VARCHAR(100),
    phone VARCHAR(100),
    email VARCHAR(255),
    id_card VARCHAR(30),
    passport VARCHAR(50),
    photo TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    remarks TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Drop existing view if exists
DROP VIEW IF EXISTS public.person CASCADE;

-- Backward Compatibility View
CREATE OR REPLACE VIEW public.person AS SELECT * FROM public.persons;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS tr_persons_updated_at ON public.persons CASCADE;

-- Trigger for updated_at
CREATE TRIGGER tr_persons_updated_at BEFORE UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select persons for authenticated" ON public.persons;
DROP POLICY IF EXISTS "Allow write persons for admins" ON public.persons;

-- RLS Policies
CREATE POLICY "Allow select persons for authenticated" ON public.persons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write persons for admins" ON public.persons FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);
