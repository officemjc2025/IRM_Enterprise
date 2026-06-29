-- =====================================================
-- IRM Enterprise Migration: 009_lookup.sql
-- =====================================================

-- Helper macro for standard lookup table structure
-- We will write them out explicitly to be pure standard SQL:

CREATE TABLE public.countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.owner_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.person_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.occupancy_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.unit_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.reservation_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.work_order_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.visitor_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_countries_updated_at ON public.countries CASCADE;
DROP TRIGGER IF EXISTS tr_languages_updated_at ON public.languages CASCADE;
DROP TRIGGER IF EXISTS tr_owner_types_updated_at ON public.owner_types CASCADE;
DROP TRIGGER IF EXISTS tr_person_types_updated_at ON public.person_types CASCADE;
DROP TRIGGER IF EXISTS tr_occupancy_statuses_updated_at ON public.occupancy_statuses CASCADE;
DROP TRIGGER IF EXISTS tr_unit_statuses_updated_at ON public.unit_statuses CASCADE;
DROP TRIGGER IF EXISTS tr_reservation_statuses_updated_at ON public.reservation_statuses CASCADE;
DROP TRIGGER IF EXISTS tr_work_order_statuses_updated_at ON public.work_order_statuses CASCADE;
DROP TRIGGER IF EXISTS tr_visitor_statuses_updated_at ON public.visitor_statuses CASCADE;

-- Triggers for updated_at column updates
CREATE TRIGGER tr_countries_updated_at BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_languages_updated_at BEFORE UPDATE ON public.languages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_owner_types_updated_at BEFORE UPDATE ON public.owner_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_person_types_updated_at BEFORE UPDATE ON public.person_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_occupancy_statuses_updated_at BEFORE UPDATE ON public.occupancy_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_unit_statuses_updated_at BEFORE UPDATE ON public.unit_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_reservation_statuses_updated_at BEFORE UPDATE ON public.reservation_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_work_order_statuses_updated_at BEFORE UPDATE ON public.work_order_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_visitor_statuses_updated_at BEFORE UPDATE ON public.visitor_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS) on all lookup tables
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupancy_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_statuses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select countries for authenticated" ON public.countries;
DROP POLICY IF EXISTS "Allow select languages for authenticated" ON public.languages;
DROP POLICY IF EXISTS "Allow select owner_types for authenticated" ON public.owner_types;
DROP POLICY IF EXISTS "Allow select person_types for authenticated" ON public.person_types;
DROP POLICY IF EXISTS "Allow select occupancy_statuses for authenticated" ON public.occupancy_statuses;
DROP POLICY IF EXISTS "Allow select unit_statuses for authenticated" ON public.unit_statuses;
DROP POLICY IF EXISTS "Allow select reservation_statuses for authenticated" ON public.reservation_statuses;
DROP POLICY IF EXISTS "Allow select work_order_statuses for authenticated" ON public.work_order_statuses;
DROP POLICY IF EXISTS "Allow select visitor_statuses for authenticated" ON public.visitor_statuses;

-- RLS Policies
CREATE POLICY "Allow select countries for authenticated" ON public.countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select languages for authenticated" ON public.languages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select owner_types for authenticated" ON public.owner_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select person_types for authenticated" ON public.person_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select occupancy_statuses for authenticated" ON public.occupancy_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select unit_statuses for authenticated" ON public.unit_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select reservation_statuses for authenticated" ON public.reservation_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select work_order_statuses for authenticated" ON public.work_order_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow select visitor_statuses for authenticated" ON public.visitor_statuses FOR SELECT TO authenticated USING (true);
