-- =====================================================
-- IRM Enterprise Migration: 004_properties.sql
-- =====================================================

-- Properties Table (Plural)
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_code VARCHAR(20) UNIQUE NOT NULL,
    property_name_th VARCHAR(255) NOT NULL,
    property_name_en VARCHAR(255),
    property_type VARCHAR(50) NOT NULL,
    juristic_name_th VARCHAR(255),
    juristic_name_en VARCHAR(255),
    tax_id VARCHAR(20),
    address_th TEXT,
    address_en TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    subdistrict VARCHAR(100),
    postcode VARCHAR(10),
    telephone VARCHAR(50),
    fax VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    timezone VARCHAR(100) DEFAULT 'Asia/Bangkok',
    currency VARCHAR(10) DEFAULT 'THB',
    status VARCHAR(30) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Buildings Table (Plural)
CREATE TABLE public.buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    building_code VARCHAR(20) NOT NULL,
    building_name_th VARCHAR(255) NOT NULL,
    building_name_en VARCHAR(255),
    total_floors INTEGER DEFAULT 0,
    total_units INTEGER DEFAULT 0,
    description TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Floors Table (Plural)
CREATE TABLE public.floors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    floor_name_th VARCHAR(100),
    floor_name_en VARCHAR(100),
    total_units INTEGER DEFAULT 0,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.property CASCADE;
DROP VIEW IF EXISTS public.building CASCADE;
DROP VIEW IF EXISTS public.floor CASCADE;

-- Backward Compatibility Views
CREATE OR REPLACE VIEW public.property AS SELECT * FROM public.properties;
CREATE OR REPLACE VIEW public.building AS SELECT * FROM public.buildings;
CREATE OR REPLACE VIEW public.floor AS SELECT * FROM public.floors;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_properties_updated_at ON public.properties CASCADE;
DROP TRIGGER IF EXISTS tr_buildings_updated_at ON public.buildings CASCADE;
DROP TRIGGER IF EXISTS tr_floors_updated_at ON public.floors CASCADE;

-- Triggers for updated_at
CREATE TRIGGER tr_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_buildings_updated_at BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_floors_updated_at BEFORE UPDATE ON public.floors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select properties for authenticated" ON public.properties;
DROP POLICY IF EXISTS "Allow write properties for admins" ON public.properties;
DROP POLICY IF EXISTS "Allow select buildings for authenticated" ON public.buildings;
DROP POLICY IF EXISTS "Allow write buildings for admins" ON public.buildings;
DROP POLICY IF EXISTS "Allow select floors for authenticated" ON public.floors;
DROP POLICY IF EXISTS "Allow write floors for admins" ON public.floors;

-- RLS Policies
-- Properties policies
CREATE POLICY "Allow select properties for authenticated" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write properties for admins" ON public.properties FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);

-- Buildings policies
CREATE POLICY "Allow select buildings for authenticated" ON public.buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write buildings for admins" ON public.buildings FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);

-- Floors policies
CREATE POLICY "Allow select floors for authenticated" ON public.floors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write floors for admins" ON public.floors FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);
