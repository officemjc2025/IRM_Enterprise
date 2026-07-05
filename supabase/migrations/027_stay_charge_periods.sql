-- =====================================================
-- IRM Enterprise Migration: 027_stay_charge_periods.sql
-- =====================================================

-- Create stay charge periods table
CREATE TABLE public.stay_charge_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,
    property_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    
    rent_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    water_amount NUMERIC(10, 2),
    electricity_amount NUMERIC(10, 2),
    other_amount NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    
    expected_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    approved_total NUMERIC(10, 2),
    
    rent_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CONSTRAINT chk_rent_status CHECK (rent_status IN ('PENDING', 'PAID', 'OVERDUE', 'WAIVED')),
    water_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CONSTRAINT chk_water_status CHECK (water_status IN ('PENDING', 'READY', 'PAID')),
    electricity_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CONSTRAINT chk_electricity_status CHECK (electricity_status IN ('PENDING', 'READY', 'PAID')),
    overall_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CONSTRAINT chk_overall_status CHECK (overall_status IN ('NOT_READY', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED')),
    
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    outstanding_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    note TEXT,
    status_changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_period_dates CHECK (period_end >= period_start),
    CONSTRAINT chk_due_date CHECK (due_date >= period_start), -- Business Assumption: Rent due date falls on or after period start (typically the 5th)
    CONSTRAINT chk_rent_amount CHECK (rent_amount >= 0),
    CONSTRAINT chk_water_amount CHECK (water_amount IS NULL OR water_amount >= 0),
    CONSTRAINT chk_electricity_amount CHECK (electricity_amount IS NULL OR electricity_amount >= 0),
    CONSTRAINT chk_other_amount CHECK (other_amount >= 0),
    CONSTRAINT chk_discount_amount CHECK (discount_amount >= 0),
    CONSTRAINT chk_expected_total CHECK (expected_total >= 0),
    CONSTRAINT chk_approved_total CHECK (approved_total IS NULL OR approved_total >= 0),
    CONSTRAINT chk_paid_amount CHECK (paid_amount >= 0),
    CONSTRAINT chk_outstanding_amount CHECK (outstanding_amount >= 0),

    -- Relational Integrity Composite Foreign Key
    CONSTRAINT fk_charge_period_reservation_composite 
      FOREIGN KEY (reservation_id, property_id, unit_id) 
      REFERENCES public.reservations(id, property_id, unit_id) 
      ON DELETE CASCADE,

    -- Unique constraint to prevent duplicate charge periods for same reservation, start date and end date
    CONSTRAINT uq_reservation_period UNIQUE (reservation_id, period_start, period_end),

    -- Overlap Exclusion Constraint to prevent overlapping periods for the same reservation
    CONSTRAINT exclude_overlapping_stay_periods EXCLUDE USING gist (
      reservation_id WITH =,
      daterange(period_start, period_end, '[]') WITH &&
    )
);

-- Totals & Overall Status Sync Trigger Function
CREATE OR REPLACE FUNCTION public.sync_stay_charge_period_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Derive expected total
    NEW.expected_total := NEW.rent_amount + COALESCE(NEW.water_amount, 0) + COALESCE(NEW.electricity_amount, 0) + NEW.other_amount - NEW.discount_amount;
    IF NEW.expected_total < 0 THEN
        NEW.expected_total := 0;
    END IF;

    -- Derive outstanding amount
    NEW.outstanding_amount := NEW.expected_total - NEW.paid_amount;
    IF NEW.outstanding_amount < 0 THEN
        NEW.outstanding_amount := 0;
    END IF;

    -- Derive overall payment status based on utility readiness & payment details
    IF NEW.water_status = 'PENDING' OR NEW.electricity_status = 'PENDING' THEN
        NEW.overall_status := 'NOT_READY';
    ELSIF NEW.outstanding_amount = 0 THEN
        NEW.overall_status := 'PAID';
    ELSIF NEW.paid_amount > 0 AND NEW.outstanding_amount > 0 THEN
        NEW.overall_status := 'PARTIALLY_PAID';
    ELSIF NEW.due_date < NOW()::date THEN
        NEW.overall_status := 'OVERDUE';
    ELSE
        NEW.overall_status := 'PENDING';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync totals automatically before save
DROP TRIGGER IF EXISTS tr_sync_stay_charge_period_totals ON public.stay_charge_periods CASCADE;
CREATE TRIGGER tr_sync_stay_charge_period_totals
    BEFORE INSERT OR UPDATE ON public.stay_charge_periods
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_stay_charge_period_totals();

-- Trigger for updated_at column
DROP TRIGGER IF EXISTS tr_stay_charge_periods_updated_at ON public.stay_charge_periods CASCADE;
CREATE TRIGGER tr_stay_charge_periods_updated_at 
    BEFORE UPDATE ON public.stay_charge_periods 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.stay_charge_periods ENABLE ROW LEVEL SECURITY;

-- SELECT policy: admin/super_admin see all; property_admin is property scoped
DROP POLICY IF EXISTS "Admins select stay_charge_periods" ON public.stay_charge_periods;
CREATE POLICY "Admins select stay_charge_periods"
ON public.stay_charge_periods FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = stay_charge_periods.property_id
        )
      )
  )
);

-- INSERT policy: admin/super_admin see all; property_admin is property scoped
DROP POLICY IF EXISTS "Admins insert stay_charge_periods" ON public.stay_charge_periods;
CREATE POLICY "Admins insert stay_charge_periods"
ON public.stay_charge_periods FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = stay_charge_periods.property_id
        )
      )
  )
);

-- UPDATE policy: admin/super_admin see all; property_admin is property scoped
DROP POLICY IF EXISTS "Admins update stay_charge_periods" ON public.stay_charge_periods;
CREATE POLICY "Admins update stay_charge_periods"
ON public.stay_charge_periods FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = stay_charge_periods.property_id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = stay_charge_periods.property_id
          AND p.property_id = property_id
        )
      )
  )
);
