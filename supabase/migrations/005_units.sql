-- =====================================================
-- IRM Enterprise Migration: 005_units.sql
-- =====================================================

-- Units Table (Plural)
CREATE TABLE public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    building_code VARCHAR(20) NOT NULL,
    floor VARCHAR(20) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    area NUMERIC(10,2) NOT NULL DEFAULT 0,
    ownership_ratio NUMERIC(10,6) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Drop existing view if exists
DROP VIEW IF EXISTS public.unit CASCADE;

-- Backward Compatibility View
CREATE OR REPLACE VIEW public.unit AS SELECT * FROM public.units;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS tr_units_updated_at ON public.units CASCADE;

-- Trigger for updated_at
CREATE TRIGGER tr_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select units for authenticated" ON public.units;
DROP POLICY IF EXISTS "Allow write units for admins" ON public.units;

-- RLS Policies
CREATE POLICY "Allow select units for authenticated" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write units for admins" ON public.units FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);
