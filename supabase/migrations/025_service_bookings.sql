-- =====================================================
-- IRM Enterprise Migration: 025_service_bookings.sql
-- =====================================================

-- Create service bookings table
CREATE TABLE public.service_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_number VARCHAR(100) NOT NULL UNIQUE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    customer_person_id UUID REFERENCES public.persons(id) ON DELETE SET NULL,
    service_type VARCHAR(50) NOT NULL CONSTRAINT chk_service_booking_type CHECK (service_type IN ('ROOM_CLEANING', 'ROOM_SERVICE', 'OTHER')),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CONSTRAINT chk_service_booking_status CHECK (status IN ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'WORK_ORDER_CREATED', 'COMPLETED', 'CANCELLED')),
    requested_start_at TIMESTAMPTZ NOT NULL,
    requested_end_at TIMESTAMPTZ,
    customer_note TEXT,
    admin_note TEXT,
    quoted_amount NUMERIC(10, 2),
    confirmed_amount NUMERIC(10, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    work_order_id UUID UNIQUE REFERENCES public.work_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_requested_end_at CHECK (requested_end_at IS NULL OR requested_end_at > requested_start_at),
    CONSTRAINT chk_quoted_amount CHECK (quoted_amount IS NULL OR quoted_amount >= 0),
    CONSTRAINT chk_confirmed_amount CHECK (confirmed_amount IS NULL OR confirmed_amount >= 0)
);

-- Sequence starting at 1000 for booking number generation
CREATE SEQUENCE IF NOT EXISTS public.service_booking_number_seq START 1000;

-- Dedicated sequence for work order code generation
CREATE SEQUENCE IF NOT EXISTS public.work_order_code_seq START 10000000;

-- Function to generate safe, unique service booking numbers (e.g. SB-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.generate_service_booking_number()
RETURNS TRIGGER AS $$
DECLARE
    v_date_str TEXT;
    v_seq_val INT;
BEGIN
    v_date_str := to_char(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYYMMDD');
    v_seq_val := nextval('public.service_booking_number_seq');
    NEW.booking_number := 'SB-' || v_date_str || '-' || lpad(v_seq_val::text, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_service_booking_number ON public.service_bookings CASCADE;
CREATE TRIGGER tr_generate_service_booking_number
    BEFORE INSERT ON public.service_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_service_booking_number();

-- Trigger to auto-update updated_at column
DROP TRIGGER IF EXISTS tr_service_bookings_updated_at ON public.service_bookings CASCADE;
CREATE TRIGGER tr_service_bookings_updated_at 
    BEFORE UPDATE ON public.service_bookings 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

-- SELECT policy: admin/super_admin see all; property_admin is property scoped
DROP POLICY IF EXISTS "Admins select service_bookings" ON public.service_bookings;
CREATE POLICY "Admins select service_bookings"
ON public.service_bookings FOR SELECT
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
          AND p.property_id = service_bookings.property_id
        )
      )
  )
);

-- INSERT policy: admin/super_admin see all; property_admin is property scoped
DROP POLICY IF EXISTS "Admins insert service_bookings" ON public.service_bookings;
CREATE POLICY "Admins insert service_bookings"
ON public.service_bookings FOR INSERT
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
          AND p.property_id = service_bookings.property_id
        )
      )
  )
);

-- UPDATE policy: admin/super_admin see all; property_admin is property scoped
DROP POLICY IF EXISTS "Admins update service_bookings" ON public.service_bookings;
CREATE POLICY "Admins update service_bookings"
ON public.service_bookings FOR UPDATE
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
          AND p.property_id = service_bookings.property_id
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
          AND p.property_id = service_bookings.property_id
          AND p.property_id = property_id  -- prevent property_id changes
        )
      )
  )
);


-- =====================================================
-- SECURITY DEFINER Atomic RPC convert function
-- =====================================================
CREATE OR REPLACE FUNCTION public.convert_booking_to_work_order(
    p_booking_id UUID,
    p_service_team VARCHAR(50),
    p_assigned_to UUID
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_property_id UUID;
    v_booking public.service_bookings%ROWTYPE;
    v_wo public.work_orders%ROWTYPE;
    v_wo_code VARCHAR(100);
    v_category VARCHAR(100);
    v_title VARCHAR(255);
    v_service_team VARCHAR(50);
    v_seq_val INT;
    v_resident_assignment_id UUID;
BEGIN
    -- 1. Authentication & Role resolution
    SELECT role, property_id INTO v_role, v_property_id FROM public.profiles WHERE id = auth.uid();
    IF v_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Lock target booking (verify status is CONFIRMED)
    SELECT * INTO v_booking FROM public.service_bookings
    WHERE id = p_booking_id AND status = 'CONFIRMED'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found or not in CONFIRMED status';
    END IF;

    -- 3. Property Admin Fail-Closed Scoping Check
    IF v_role = 'property_admin' THEN
        IF v_property_id IS NULL OR v_property_id <> v_booking.property_id THEN
            RAISE EXCEPTION 'Unauthorized: property_admin must match booking property';
        END IF;
    END IF;

    -- 4. Check if Work Order already exists
    IF v_booking.work_order_id IS NOT NULL THEN
        RAISE EXCEPTION 'Work order already created for this booking';
    END IF;

    -- 5. Database Relational Integrity: Verify unit belongs to property
    IF NOT EXISTS (
        SELECT 1 FROM public.units
        WHERE id = v_booking.unit_id AND property_id = v_booking.property_id
    ) THEN
        RAISE EXCEPTION 'Database Integrity: Unit does not belong to the selected Property';
    END IF;

    -- 6. Enforce Service Team Selection
    IF v_booking.service_type = 'ROOM_CLEANING' THEN
        v_service_team := 'HOUSEKEEPING';
        v_category := 'Cleaning';
        v_title := 'Room Cleaning - ' || v_booking.booking_number;
    ELSIF v_booking.service_type = 'ROOM_SERVICE' THEN
        IF p_service_team NOT IN ('TECHNICIAN', 'HOUSEKEEPING') THEN
            RAISE EXCEPTION 'Invalid service_team';
        END IF;
        v_service_team := p_service_team;
        v_category := 'Room Service';
        v_title := 'Room Service - ' || v_booking.booking_number;
    ELSE -- OTHER
        IF p_service_team NOT IN ('TECHNICIAN', 'HOUSEKEEPING') THEN
            RAISE EXCEPTION 'Invalid service_team';
        END IF;
        v_service_team := p_service_team;
        v_category := 'Other';
        v_title := 'Service Request - ' || v_booking.booking_number;
    END IF;

    -- 7. Validate Assignee Role and Team
    IF p_assigned_to IS NOT NULL THEN
        DECLARE
            v_assignee_role TEXT;
        BEGIN
            SELECT role INTO v_assignee_role FROM public.profiles WHERE id = p_assigned_to;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Assignee profile not found';
            END IF;
            IF v_service_team = 'HOUSEKEEPING' AND v_assignee_role <> 'housekeeping' THEN
                RAISE EXCEPTION 'Housekeeping job can only be assigned to a housekeeping role';
            END IF;
            IF v_service_team = 'TECHNICIAN' AND v_assignee_role <> 'technician' THEN
                RAISE EXCEPTION 'Technician job can only be assigned to a technician role';
            END IF;
        END;
    END IF;

    -- 8. Generate Work Order Code (concurrency-safe and collision-protected via dedicated sequence)
    LOOP
        v_seq_val := nextval('public.work_order_code_seq');
        v_wo_code := 'WO-' || v_seq_val::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.work_orders WHERE work_order_code = v_wo_code);
    END LOOP;

    -- 9. Find resident assignment id for target unit/customer
    IF v_booking.customer_person_id IS NOT NULL THEN
        SELECT id INTO v_resident_assignment_id FROM public.resident_assignments
        WHERE person_id = v_booking.customer_person_id AND unit_id = v_booking.unit_id
        LIMIT 1;
    END IF;

    -- 10. Insert Work Order
    INSERT INTO public.work_orders (
        work_order_code,
        property_id,
        unit_id,
        resident_assignment_id,
        category,
        title,
        description,
        priority,
        status,
        assigned_to,
        scheduled_at,
        created_by,
        service_team
    )
    VALUES (
        v_wo_code,
        v_booking.property_id,
        v_booking.unit_id,
        v_resident_assignment_id,
        v_category,
        v_title,
        v_booking.customer_note,
        'NORMAL',
        CASE WHEN p_assigned_to IS NOT NULL THEN 'ASSIGNED'::VARCHAR ELSE 'NEW'::VARCHAR END,
        p_assigned_to,
        v_booking.requested_start_at,
        auth.uid(),
        v_service_team
    )
    RETURNING * INTO v_wo;

    -- 11. Update Service Booking with work_order_id and status WORK_ORDER_CREATED
    UPDATE public.service_bookings
    SET work_order_id = v_wo.id,
        status = 'WORK_ORDER_CREATED',
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN v_wo;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_booking_to_work_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_booking_to_work_order TO authenticated;


-- =====================================================
-- Automatic Work Order -> Service Booking synchronization
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_work_order_status_to_booking()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN
        UPDATE public.service_bookings
        SET status = 'COMPLETED',
            updated_at = NOW()
        WHERE work_order_id = NEW.id AND status = 'WORK_ORDER_CREATED';
    ELSIF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
        UPDATE public.service_bookings
        SET status = 'CANCELLED',
            cancelled_at = NOW(),
            cancellation_reason = 'Linked Work Order was cancelled',
            updated_at = NOW()
        WHERE work_order_id = NEW.id AND status = 'WORK_ORDER_CREATED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_work_order_status_to_booking ON public.work_orders CASCADE;
CREATE TRIGGER tr_sync_work_order_status_to_booking
    AFTER UPDATE ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_work_order_status_to_booking();
