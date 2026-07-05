-- =====================================================
-- IRM Enterprise Migration: 026_room_reservations.sql
-- =====================================================

-- Enable btree_gist extension for exclusion constraint support
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create reservations table adapted for Monthly & Long-Stay Operations
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number VARCHAR(100) NOT NULL UNIQUE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    primary_guest_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
    reservation_type VARCHAR(50) NOT NULL CONSTRAINT chk_reservation_type CHECK (reservation_type IN ('RENTAL_GUEST', 'OWNER_STAY', 'MANAGEMENT_USE', 'OTHER')),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CONSTRAINT chk_reservation_status CHECK (status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')),
    billing_basis VARCHAR(50) NOT NULL DEFAULT 'MONTHLY' CONSTRAINT chk_billing_basis CHECK (billing_basis IN ('MONTHLY', 'DAILY', 'CUSTOM')),
    
    -- Stay period
    check_in_at TIMESTAMPTZ NOT NULL,
    check_out_at TIMESTAMPTZ NOT NULL,
    adult_count INT NOT NULL DEFAULT 1,
    child_count INT NOT NULL DEFAULT 0,
    
    -- Commercial pricing fields
    monthly_rate NUMERIC(10, 2),
    daily_rate NUMERIC(10, 2),
    base_rental_amount NUMERIC(10, 2),
    extension_amount NUMERIC(10, 2) DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    deposit_amount NUMERIC(10, 2) DEFAULT 0.00,
    calculated_total_amount NUMERIC(10, 2),
    approved_total_amount NUMERIC(10, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    
    -- Partner/front office fields
    booking_channel VARCHAR(100),
    external_reference VARCHAR(100),
    guest_note TEXT,
    internal_note TEXT,
    
    -- Audits
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actual_check_in_at TIMESTAMPTZ,
    checked_out_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actual_check_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_check_out_at CHECK (check_out_at > check_in_at),
    CONSTRAINT chk_adult_count CHECK (adult_count >= 0),
    CONSTRAINT chk_child_count CHECK (child_count >= 0),
    CONSTRAINT chk_monthly_rate CHECK (monthly_rate IS NULL OR monthly_rate >= 0),
    CONSTRAINT chk_daily_rate CHECK (daily_rate IS NULL OR daily_rate >= 0),
    CONSTRAINT chk_base_rental_amount CHECK (base_rental_amount IS NULL OR base_rental_amount >= 0),
    CONSTRAINT chk_extension_amount CHECK (extension_amount IS NULL OR extension_amount >= 0),
    CONSTRAINT chk_discount_amount CHECK (discount_amount IS NULL OR discount_amount >= 0),
    CONSTRAINT chk_deposit_amount CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
    CONSTRAINT chk_calculated_total_amount CHECK (calculated_total_amount IS NULL OR calculated_total_amount >= 0),
    CONSTRAINT chk_approved_total_amount CHECK (approved_total_amount IS NULL OR approved_total_amount >= 0),
    
    -- Unique composite key to enforce stays charge period relational integrity
    CONSTRAINT uq_reservation_property_unit UNIQUE (id, property_id, unit_id),
    
    -- Overlap Concurrency Exclusion Constraint (blocking confirmed/checked_in stays)
    CONSTRAINT exclude_overlapping_reservations EXCLUDE USING gist (
      unit_id WITH =,
      tstzrange(check_in_at, check_out_at, '[)') WITH &&
    ) WHERE (status IN ('CONFIRMED', 'CHECKED_IN'))
);

-- Sequence starting at 1000 for reservation number generation
CREATE SEQUENCE IF NOT EXISTS public.reservation_number_seq START 1000;

-- Dedicated sequence for work order code generation
CREATE SEQUENCE IF NOT EXISTS public.work_order_code_seq START 10000000;

-- Function to generate safe, unique reservation numbers (e.g. RS-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_reservation_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str TEXT;
    v_seq_val INT;
BEGIN
    v_date_str := to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYYMMDD');
    v_seq_val := nextval('public.reservation_number_seq');
    NEW.reservation_number := 'RS-' || v_date_str || '-' || lpad(v_seq_val::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_reservation_number ON public.reservations CASCADE;
CREATE TRIGGER tr_generate_reservation_number
    BEFORE INSERT ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_reservation_number();

-- Trigger to auto-update updated_at column
DROP TRIGGER IF EXISTS tr_reservations_updated_at ON public.reservations CASCADE;
CREATE TRIGGER tr_reservations_updated_at 
    BEFORE UPDATE ON public.reservations 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- Add reservation_extensions audit history table
-- =====================================================
CREATE TABLE public.reservation_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    previous_check_out_at TIMESTAMPTZ NOT NULL,
    requested_check_out_at TIMESTAMPTZ NOT NULL,
    approved_check_out_at TIMESTAMPTZ,
    pricing_method VARCHAR(50) NOT NULL CONSTRAINT chk_extension_pricing CHECK (pricing_method IN ('HALF_MONTH', 'DAILY_PRORATE', 'FULL_MONTH', 'CUSTOM')),
    calculated_amount NUMERIC(10, 2),
    approved_amount NUMERIC(10, 2),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_APPROVAL' CONSTRAINT chk_extension_status CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,

    CONSTRAINT chk_extension_requested_date CHECK (requested_check_out_at > previous_check_out_at)
);


-- =====================================================
-- Add reservation_id to work_orders to support multiple linked orders
-- =====================================================
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_reservation_id ON public.work_orders(reservation_id);

-- Recreate view for backward compatibility
CREATE OR REPLACE VIEW public.work_order AS SELECT * FROM public.work_orders;


-- =====================================================
-- RPC helper to generate concurrency-safe work order code
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_next_work_order_code()
RETURNS VARCHAR(100)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seq_val INT;
    v_wo_code VARCHAR(100);
BEGIN
    -- Authenticate user role
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    LOOP
        v_seq_val := nextval('public.work_order_code_seq');
        v_wo_code := 'WO-' || v_seq_val::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.work_orders WHERE work_order_code = v_wo_code);
    END LOOP;
    RETURN v_wo_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_work_order_code FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_work_order_code TO authenticated;


-- =====================================================
-- RPC function to approve reservation extensions atomically with overlap checking
-- =====================================================
CREATE OR REPLACE FUNCTION public.approve_reservation_extension(
    p_extension_id UUID,
    p_approved_amount NUMERIC(10, 2)
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_property_id UUID;
    v_ext public.reservation_extensions%ROWTYPE;
    v_res public.reservations%ROWTYPE;
    v_new_checkout TIMESTAMPTZ;
BEGIN
    -- 1. Resolve role & authentication
    SELECT role, property_id INTO v_role, v_property_id FROM public.profiles WHERE id = auth.uid();
    IF v_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Lock extension request
    SELECT * INTO v_ext FROM public.reservation_extensions
    WHERE id = p_extension_id AND status = 'PENDING_APPROVAL'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Extension request not found or not pending approval';
    END IF;

    -- 3. Lock target reservation
    SELECT * INTO v_res FROM public.reservations
    WHERE id = v_ext.reservation_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;

    -- 4. Property Admin Scoping Check
    IF v_role = 'property_admin' THEN
        IF v_property_id IS NULL OR v_property_id <> v_res.property_id THEN
            RAISE EXCEPTION 'Unauthorized: property admin scope mismatch';
        END IF;
    END IF;

    v_new_checkout := v_ext.requested_check_out_at;

    -- 5. Concurrency Overlap Check for the newly extended stay check_out_at range (authoritative database constraint check)
    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = v_res.unit_id
          AND id <> v_res.id
          AND status IN ('CONFIRMED', 'CHECKED_IN')
          AND check_in_at < v_new_checkout
          AND check_out_at > v_res.check_in_at
    ) THEN
        RAISE EXCEPTION 'Unit booking overlap conflict: Cannot approve extension due to conflicting stay reservation.';
    END IF;

    -- 6. Update extension record
    UPDATE public.reservation_extensions
    SET status = 'APPROVED',
        approved_amount = p_approved_amount,
        approved_check_out_at = v_new_checkout,
        approved_by = auth.uid(),
        approved_at = NOW()
    WHERE id = p_extension_id;

    -- 7. Update reservation check_out_at and aggregate commercial extension values
    UPDATE public.reservations
    SET check_out_at = v_new_checkout,
        extension_amount = COALESCE(extension_amount, 0) + p_approved_amount,
        approved_total_amount = COALESCE(base_rental_amount, 0) + COALESCE(extension_amount, 0) + p_approved_amount - COALESCE(discount_amount, 0),
        updated_at = NOW()
    WHERE id = v_res.id
    RETURNING * INTO v_res;

    RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_reservation_extension FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_reservation_extension TO authenticated;


-- =====================================================
-- RLS POLICIES FOR RESERVATIONS & EXTENSIONS
-- =====================================================
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_extensions ENABLE ROW LEVEL SECURITY;

-- SELECT policies
DROP POLICY IF EXISTS "Admins select reservations" ON public.reservations;
CREATE POLICY "Admins select reservations"
ON public.reservations FOR SELECT
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
          AND p.property_id = reservations.property_id
        )
      )
  )
);

CREATE POLICY "Admins select reservation_extensions"
ON public.reservation_extensions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.reservations r ON r.id = reservation_extensions.reservation_id
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = r.property_id
        )
      )
  )
);

-- INSERT policies
DROP POLICY IF EXISTS "Admins insert reservations" ON public.reservations;
CREATE POLICY "Admins insert reservations"
ON public.reservations FOR INSERT
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
          AND p.property_id = reservations.property_id
        )
      )
  )
);

CREATE POLICY "Admins insert reservation_extensions"
ON public.reservation_extensions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.reservations r ON r.id = reservation_extensions.reservation_id
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = r.property_id
        )
      )
  )
);

-- UPDATE policies
DROP POLICY IF EXISTS "Admins update reservations" ON public.reservations;
CREATE POLICY "Admins update reservations"
ON public.reservations FOR UPDATE
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
          AND p.property_id = reservations.property_id
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
          AND p.property_id = reservations.property_id
          AND p.property_id = property_id
        )
      )
  )
);

DROP POLICY IF EXISTS "Admins update reservation_extensions" ON public.reservation_extensions;
CREATE POLICY "Admins update reservation_extensions"
ON public.reservation_extensions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.reservations r ON r.id = reservation_extensions.reservation_id
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = r.property_id
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.reservations r ON r.id = reservation_id
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND p.property_id = r.property_id
          AND r.property_id = (SELECT property_id FROM public.reservations WHERE id = reservation_id)
        )
      )
  )
);
