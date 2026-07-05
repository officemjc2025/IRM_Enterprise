-- =====================================================
-- IRM Enterprise Migration: 028_cancellation_audit_fields.sql
-- =====================================================

-- Add cancellation audit fields to work_orders
ALTER TABLE public.work_orders 
ADD COLUMN cancelled_at TIMESTAMPTZ,
ADD COLUMN cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN cancellation_reason TEXT;

-- Create generic entity change history for audit trail
CREATE TABLE public.entity_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'CREATE', 'EDIT', 'CANCEL'
    changed_fields JSONB,
    reason TEXT,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.entity_change_history ENABLE ROW LEVEL SECURITY;

-- Secure SELECT Policy (Admin/Super Admin see all; Property Admin scopes own property; Worker scopes assigned Work Orders; Resident blocked)
CREATE POLICY "Allow select entity_change_history"
    ON public.entity_change_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.role IN ('admin', 'super_admin')
                OR
                (p.role = 'property_admin' AND p.property_id IS NOT NULL AND (
                    (entity_type = 'work_orders' AND EXISTS (
                        SELECT 1 FROM public.work_orders wo
                        WHERE wo.id = entity_id AND wo.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'reservations' AND EXISTS (
                        SELECT 1 FROM public.reservations r
                        WHERE r.id = entity_id AND r.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'service_bookings' AND EXISTS (
                        SELECT 1 FROM public.service_bookings sb
                        WHERE sb.id = entity_id AND sb.property_id = p.property_id
                    ))
                ))
                OR
                (p.role IN ('technician', 'housekeeping') AND (
                    entity_type = 'work_orders' AND EXISTS (
                        SELECT 1 FROM public.work_orders wo
                        WHERE wo.id = entity_id AND wo.assigned_to = p.id
                    ))
                )
              )
        )
    );

-- DO NOT define any INSERT policy to prevent direct, unverified client INSERTs.
-- All inserts must go through the SECURITY DEFINER RPC function to ensure actor identity and scoping integrity.

-- SECURITY DEFINER Function for secure logging
CREATE OR REPLACE FUNCTION public.log_entity_change(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_action_type VARCHAR,
    p_changed_fields JSONB,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_entity_property_id UUID;
    v_assigned_to UUID;
    v_new_id UUID;
BEGIN
    -- 1. Derive actor identity from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Must be logged in to log changes';
    END IF;

    -- 2. Fetch actor profile details
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    -- 3. Validate supported entity types
    IF p_entity_type NOT IN ('work_orders', 'reservations', 'service_bookings') THEN
        RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
    END IF;

    -- 4. Validate supported action types
    IF p_action_type NOT IN ('CREATE', 'EDIT', 'CANCEL') THEN
        RAISE EXCEPTION 'Invalid action type: %', p_action_type;
    END IF;

    -- 5. Resolve target entity property scope and assignments
    IF p_entity_type = 'work_orders' THEN
        SELECT property_id, assigned_to INTO v_entity_property_id, v_assigned_to
        FROM public.work_orders
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'reservations' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.reservations
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'service_bookings' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.service_bookings
        WHERE id = p_entity_id;
    END IF;

    -- If the entity does not exist, fail-closed
    IF v_entity_property_id IS NULL THEN
        RAISE EXCEPTION 'Target entity not found: % with id %', p_entity_type, p_entity_id;
    END IF;

    -- 6. Enforce Role and Property scoping
    IF v_actor_role IN ('admin', 'super_admin') THEN
        -- Allow admin and super_admin
    ELSIF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL THEN
            RAISE EXCEPTION 'Property admin has no assigned property';
        END IF;
        IF v_actor_property_id != v_entity_property_id THEN
            RAISE EXCEPTION 'Cross-property action denied';
        END IF;
    ELSIF v_actor_role IN ('technician', 'housekeeping') THEN
        IF p_entity_type != 'work_orders' THEN
            RAISE EXCEPTION 'Access denied: Workers can only log changes for work orders';
        END IF;
        IF p_action_type != 'EDIT' THEN
            RAISE EXCEPTION 'Access denied: Workers are not authorized to log % actions', p_action_type;
        END IF;
        IF v_assigned_to IS NULL OR v_assigned_to != v_actor_id THEN
            RAISE EXCEPTION 'Access denied: Work order not assigned to you';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized to log entity changes';
    END IF;

    -- 7. Secure Insertion
    INSERT INTO public.entity_change_history (
        entity_type,
        entity_id,
        action_type,
        changed_fields,
        reason,
        actor_id,
        created_at
    )
    VALUES (
        p_entity_type,
        p_entity_id,
        p_action_type,
        p_changed_fields,
        p_reason,
        v_actor_id,
        NOW()
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- Revoke all PUBLIC privileges from function and grant execute to authenticated role
REVOKE ALL ON FUNCTION public.log_entity_change(VARCHAR, UUID, VARCHAR, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_entity_change(VARCHAR, UUID, VARCHAR, JSONB, TEXT) TO authenticated;

-- SECURITY DEFINER Function for secure atomic booking cancellation
CREATE OR REPLACE FUNCTION public.cancel_service_booking(
    p_booking_id UUID,
    p_cancellation_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_booking_status VARCHAR;
    v_booking_property_id UUID;
    v_work_order_id UUID;
    v_wo_status VARCHAR;
    v_trimmed_reason TEXT;
BEGIN
    -- 1. Derive and validate actor identity from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Must be logged in';
    END IF;

    -- 2. Fetch actor profile
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    -- 3. Trim and validate cancellation reason
    v_trimmed_reason := trim(p_cancellation_reason);
    IF v_trimmed_reason IS NULL OR v_trimmed_reason = '' THEN
        RAISE EXCEPTION 'Cancellation reason must be non-empty';
    END IF;

    -- 4. Lock and retrieve Service Booking row for update
    SELECT status, property_id, work_order_id INTO v_booking_status, v_booking_property_id, v_work_order_id
    FROM public.service_bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF v_booking_status IS NULL THEN
        RAISE EXCEPTION 'Service booking not found';
    END IF;

    -- 5. Validate current status
    IF v_booking_status = 'CANCELLED' OR v_booking_status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Service booking is already completed or cancelled';
    END IF;

    -- 6. Enforce role and property scope
    IF v_actor_role IN ('admin', 'super_admin') THEN
        -- Allow
    ELSIF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL THEN
            RAISE EXCEPTION 'Property admin has no assigned property';
        END IF;
        IF v_actor_property_id != v_booking_property_id THEN
            RAISE EXCEPTION 'Cross-property cancellation denied';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized: Only admins can cancel bookings';
    END IF;

    -- 7. Coordinate with linked Work Order
    IF v_work_order_id IS NOT NULL THEN
        -- Lock and retrieve linked Work Order
        SELECT status INTO v_wo_status
        FROM public.work_orders
        WHERE id = v_work_order_id
        FOR UPDATE;

        IF v_wo_status IS NULL THEN
            RAISE EXCEPTION 'Linked work order % not found', v_work_order_id;
        END IF;

        -- If Work Order has already started/completed/closed, block booking cancellation
        IF v_wo_status NOT IN ('NEW', 'ASSIGNED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Cannot cancel booking: linked work order has already started or is completed';
        END IF;

        -- Cancel the eligible Work Order
        IF v_wo_status IN ('NEW', 'ASSIGNED') THEN
            UPDATE public.work_orders
            SET status = 'CANCELLED',
                cancelled_by = v_actor_id,
                cancelled_at = NOW(),
                cancellation_reason = 'Cancelled via linked Service Booking: ' || v_trimmed_reason,
                updated_at = NOW(),
                updated_by = v_actor_id
            WHERE id = v_work_order_id;

            -- Log Work Order cancellation history
            INSERT INTO public.entity_change_history (
                entity_type,
                entity_id,
                action_type,
                changed_fields,
                reason,
                actor_id,
                created_at
            )
            VALUES (
                'work_orders',
                v_work_order_id,
                'CANCEL',
                jsonb_build_object('status', 'CANCELLED'),
                'Cancelled via linked Service Booking: ' || v_trimmed_reason,
                v_actor_id,
                NOW()
            );
        END IF;
    END IF;

    -- 8. Cancel the Service Booking itself
    UPDATE public.service_bookings
    SET status = 'CANCELLED',
        cancelled_by = v_actor_id,
        cancelled_at = NOW(),
        cancellation_reason = v_trimmed_reason
    WHERE id = p_booking_id;

    -- Log Service Booking cancellation history
    INSERT INTO public.entity_change_history (
        entity_type,
        entity_id,
        action_type,
        changed_fields,
        reason,
        actor_id,
        created_at
    )
    VALUES (
        'service_bookings',
        p_booking_id,
        'CANCEL',
        jsonb_build_object('status', 'CANCELLED'),
        v_trimmed_reason,
        v_actor_id,
        NOW()
    );

END;
$$;

-- Revoke all PUBLIC privileges and grant execute to authenticated role
REVOKE ALL ON FUNCTION public.cancel_service_booking(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_service_booking(UUID, TEXT) TO authenticated;

