-- =====================================================
-- IRM Enterprise Migration: 008_occupancies.sql
-- =====================================================

-- Occupancies Table (Plural)
CREATE TABLE public.occupancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    occupancy_type VARCHAR(30) NOT NULL, -- OWNER, CO_OWNER, TENANT, RESIDENT, COMPANY, VACANT
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    remarks TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Resident Assignments Table (Plural)
CREATE TABLE public.resident_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    resident_type VARCHAR(30) NOT NULL,
    relationship_type VARCHAR(30),
    move_in_date DATE NOT NULL,
    move_out_date DATE,
    is_primary BOOLEAN DEFAULT FALSE,
    can_receive_mail BOOLEAN DEFAULT TRUE,
    can_book_facility BOOLEAN DEFAULT TRUE,
    can_vote BOOLEAN DEFAULT FALSE,
    emergency_contact BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    remarks TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Vehicles Table (Plural)
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    registration_no VARCHAR(30) NOT NULL,
    province VARCHAR(100),
    vehicle_type VARCHAR(30),
    brand VARCHAR(100),
    model VARCHAR(100),
    color VARCHAR(100),
    year INTEGER,
    sticker_no VARCHAR(50),
    rfid_code VARCHAR(100),
    parking_zone VARCHAR(50),
    parking_space VARCHAR(50),
    ownership_type VARCHAR(30) DEFAULT 'PRIVATE',
    is_primary BOOLEAN DEFAULT FALSE,
    lpr_enabled BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    remarks TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Visitors Table (Plural)
CREATE TABLE public.visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_number VARCHAR(100) UNIQUE NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    phone VARCHAR(100),
    purpose VARCHAR(255) NOT NULL,
    vehicle_plate VARCHAR(100),
    company VARCHAR(255),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    occupancy_id UUID REFERENCES public.occupancies(id) ON DELETE SET NULL,
    security_user VARCHAR(255),
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_checkout_time TIMESTAMPTZ,
    actual_checkout_time TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'CHECKED_IN',
    remarks TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.occupancy CASCADE;
DROP VIEW IF EXISTS public.resident_assignment CASCADE;
DROP VIEW IF EXISTS public.vehicle CASCADE;
DROP VIEW IF EXISTS public.visitor CASCADE;

-- Backward Compatibility Views
CREATE OR REPLACE VIEW public.occupancy AS SELECT * FROM public.occupancies;
CREATE OR REPLACE VIEW public.resident_assignment AS SELECT * FROM public.resident_assignments;
CREATE OR REPLACE VIEW public.vehicle AS SELECT * FROM public.vehicles;
CREATE OR REPLACE VIEW public.visitor AS SELECT * FROM public.visitors;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_occupancies_updated_at ON public.occupancies CASCADE;
DROP TRIGGER IF EXISTS tr_resident_assignments_updated_at ON public.resident_assignments CASCADE;
DROP TRIGGER IF EXISTS tr_vehicles_updated_at ON public.vehicles CASCADE;
DROP TRIGGER IF EXISTS tr_visitors_updated_at ON public.visitors CASCADE;

-- Triggers for updated_at
CREATE TRIGGER tr_occupancies_updated_at BEFORE UPDATE ON public.occupancies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_resident_assignments_updated_at BEFORE UPDATE ON public.resident_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_visitors_updated_at BEFORE UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.occupancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select occupancies for authenticated" ON public.occupancies;
DROP POLICY IF EXISTS "Allow write occupancies for admins" ON public.occupancies;
DROP POLICY IF EXISTS "Allow select resident_assignments for authenticated" ON public.resident_assignments;
DROP POLICY IF EXISTS "Allow write resident_assignments for admins" ON public.resident_assignments;
DROP POLICY IF EXISTS "Allow select vehicles for authenticated" ON public.vehicles;
DROP POLICY IF EXISTS "Allow write vehicles for admins" ON public.vehicles;
DROP POLICY IF EXISTS "Allow select visitors for authenticated" ON public.visitors;
DROP POLICY IF EXISTS "Allow write visitors for security and admins" ON public.visitors;

-- RLS Policies
-- Occupancies policies
CREATE POLICY "Allow select occupancies for authenticated" ON public.occupancies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write occupancies for admins" ON public.occupancies FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);

-- Resident Assignments policies
CREATE POLICY "Allow select resident_assignments for authenticated" ON public.resident_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write resident_assignments for admins" ON public.resident_assignments FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);

-- Vehicles policies
CREATE POLICY "Allow select vehicles for authenticated" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write vehicles for admins" ON public.vehicles FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);

-- Visitors policies
CREATE POLICY "Allow select visitors for authenticated" ON public.visitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write visitors for security and admins" ON public.visitors FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin', 'security')
  )
);
