-- =====================================================
-- IRM Enterprise Migration: 017_work_orders.sql
-- =====================================================

-- Create work_orders table
CREATE TABLE public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_code VARCHAR(100) UNIQUE NOT NULL,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    resident_assignment_id UUID REFERENCES public.resident_assignments(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT chk_work_order_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    CONSTRAINT chk_work_order_status CHECK (status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'))
);

-- Singular View for backward compatibility
CREATE OR REPLACE VIEW public.work_order AS SELECT * FROM public.work_orders;

-- Trigger to auto-update updated_at column
DROP TRIGGER IF EXISTS tr_work_orders_updated_at ON public.work_orders CASCADE;
CREATE TRIGGER tr_work_orders_updated_at 
    BEFORE UPDATE ON public.work_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow select work_orders for authenticated" ON public.work_orders;
CREATE POLICY "Allow select work_orders for authenticated" 
    ON public.work_orders FOR SELECT 
    TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Allow write work_orders for authenticated" ON public.work_orders;
CREATE POLICY "Allow write work_orders for authenticated" 
    ON public.work_orders FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
