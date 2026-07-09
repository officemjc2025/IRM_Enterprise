-- =====================================================
-- IRM Enterprise Migration: 034_operational_status_integrity_correction.sql
-- =====================================================
-- Purpose: Corrects Unit Operational Status Derivation Engine,
-- Work Order status transition atomicity, and audit security.
--
-- ⚠️ DO NOT APPLY THIS MIGRATION. STOP after creation.
-- =====================================================

-- -------------------------------------------------------
-- 1. CENTRALIZED AUTHORITATIVE DERIVATION STRATEGY
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_unit_operational_status(p_unit_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_unit_status VARCHAR;
    v_current_op_status VARCHAR;
    v_has_active_maintenance_lock BOOLEAN;
    v_has_checked_in BOOLEAN;
    v_has_checking_in BOOLEAN;
    v_has_checking_out BOOLEAN;
    v_has_reserved BOOLEAN;
    v_has_tenant_occupancy BOOLEAN;
    v_has_owner_occupancy BOOLEAN;
    v_has_staff_occupancy BOOLEAN;
    v_has_company_occupancy BOOLEAN;
BEGIN
    -- Get unit's status and current operational status
    SELECT status, operational_status INTO v_unit_status, v_current_op_status
    FROM public.units
    WHERE id = p_unit_id;

    -- 1. OUT_OF_SERVICE (highest priority)
    -- If unit status is INACTIVE, it is permanently OUT_OF_SERVICE.
    -- Or if it was manually set to OUT_OF_SERVICE, preserve it.
    IF v_unit_status = 'INACTIVE' OR v_current_op_status = 'OUT_OF_SERVICE' THEN
        RETURN 'OUT_OF_SERVICE';
    END IF;

    -- 2. LOCKED
    -- Preserve manual LOCKED state
    IF v_current_op_status = 'LOCKED' THEN
        RETURN 'LOCKED';
    END IF;

    -- 3. MAINTENANCE / active operational lock
    -- Check if there are active work orders with affects_operational_status = TRUE
    -- that are in status 'IN_PROGRESS'
    SELECT EXISTS (
        SELECT 1 FROM public.work_orders
        WHERE unit_id = p_unit_id
          AND affects_operational_status = TRUE
          AND status = 'IN_PROGRESS'
          AND deleted_at IS NULL
    ) INTO v_has_active_maintenance_lock;

    IF v_has_active_maintenance_lock THEN
        RETURN 'MAINTENANCE';
    END IF;

    -- Check stay/reservation lifecycle (table reservations)
    -- 4. CHECKED_IN
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CHECKED_IN'
          AND check_in_at <= NOW() AND check_out_at >= NOW()
    ) INTO v_has_checked_in;

    IF v_has_checked_in THEN
        RETURN 'CHECKED_IN';
    END IF;

    -- 5. CHECKING_IN (arrival today)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CONFIRMED'
          AND check_in_at::DATE = CURRENT_DATE
    ) INTO v_has_checking_in;

    IF v_has_checking_in THEN
        RETURN 'CHECKING_IN';
    END IF;

    -- 6. CHECKING_OUT (departure today)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CHECKED_IN'
          AND check_out_at::DATE = CURRENT_DATE
    ) INTO v_has_checking_out;

    IF v_has_checking_out THEN
        RETURN 'CHECKING_OUT';
    END IF;

    -- 7. RESERVED (confirmed upcoming stay)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CONFIRMED'
          AND check_in_at > NOW()
    ) INTO v_has_reserved;

    IF v_has_reserved THEN
        RETURN 'RESERVED';
    END IF;

    -- Check occupancies (active assignments)
    -- 8. TENANT_OCCUPIED
    SELECT EXISTS (
        SELECT 1 FROM public.occupancies
        WHERE unit_id = p_unit_id
          AND occupancy_type = 'TENANT'
          AND status = 'ACTIVE'
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND deleted_at IS NULL
    ) INTO v_has_tenant_occupancy;

    IF v_has_tenant_occupancy THEN
        RETURN 'TENANT_OCCUPIED';
    END IF;

    -- 9. OWNER_OCCUPIED
    SELECT EXISTS (
        SELECT 1 FROM public.occupancies
        WHERE unit_id = p_unit_id
          AND occupancy_type IN ('OWNER', 'CO_OWNER')
          AND status = 'ACTIVE'
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND deleted_at IS NULL
    ) INTO v_has_owner_occupancy;

    IF v_has_owner_occupancy THEN
        RETURN 'OWNER_OCCUPIED';
    END IF;

    -- 10. STAFF
    SELECT EXISTS (
        SELECT 1 FROM public.occupancies
        WHERE unit_id = p_unit_id
          AND occupancy_type = 'STAFF'
          AND status = 'ACTIVE'
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND deleted_at IS NULL
    ) INTO v_has_staff_occupancy;

    IF v_has_staff_occupancy THEN
        RETURN 'STAFF';
    END IF;

    -- 11. MJC
    SELECT EXISTS (
        SELECT 1 FROM public.occupancies
        WHERE unit_id = p_unit_id
          AND occupancy_type = 'COMPANY'
          AND status = 'ACTIVE'
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND deleted_at IS NULL
    ) INTO v_has_company_occupancy;

    IF v_has_company_occupancy THEN
        RETURN 'MJC';
    END IF;

    -- 12. VACANT (fallback)
    RETURN 'VACANT';
END;
$$;

-- -------------------------------------------------------
-- 2. ATOMIC WORK ORDER STATUS TRANSITION FUNCTION
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_work_order_status(
    p_work_order_id UUID,
    p_new_status VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_work_order RECORD;
    v_unit RECORD;
    v_previous_op_status VARCHAR;
    v_new_op_status VARCHAR;
    v_change_history_id UUID;
    v_wo_change_id UUID;
BEGIN
    -- 1. Derive actor identity from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Must be logged in to update work orders';
    END IF;

    -- 2. Fetch actor profile details
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    -- 3. Lock Work Order row FOR UPDATE
    SELECT * INTO v_work_order
    FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    -- 4. Lock Unit row FOR UPDATE
    SELECT * INTO v_unit
    FROM public.units
    WHERE id = v_work_order.unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unit not found';
    END IF;

    -- Save previous operational status
    v_previous_op_status := v_unit.operational_status;

    -- 5. Enforce role and property scoping
    IF v_actor_role IN ('admin', 'super_admin') THEN
        -- Allow
    ELSIF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR v_actor_property_id != v_work_order.property_id THEN
            RAISE EXCEPTION 'Forbidden: Cross-property action denied';
        END IF;
    ELSIF v_actor_role = 'technician' THEN
        IF v_work_order.service_team != 'TECHNICIAN' OR v_work_order.assigned_to != v_actor_id THEN
            RAISE EXCEPTION 'Forbidden: Technician not assigned to this work order';
        END IF;
    ELSIF v_actor_role = 'housekeeping' THEN
        IF v_work_order.service_team != 'HOUSEKEEPING' OR v_work_order.assigned_to != v_actor_id THEN
            RAISE EXCEPTION 'Forbidden: Housekeeping not assigned to this work order';
        END IF;
    ELSE
        RAISE EXCEPTION 'Forbidden: Role not authorized';
    END IF;

    -- 6. Enforce read-only constraint for completed/closed/cancelled work orders
    IF v_work_order.status IN ('COMPLETED', 'CLOSED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Completed, closed, or cancelled work orders are read-only';
    END IF;

    -- 7. Update Work Order lifecycle status
    UPDATE public.work_orders
    SET status = p_new_status,
        updated_at = NOW(),
        updated_by = v_actor_id,
        started_at = CASE WHEN p_new_status = 'IN_PROGRESS' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_new_status = 'COMPLETED' THEN NOW() ELSE completed_at END,
        closed_at = CASE WHEN p_new_status = 'CLOSED' THEN NOW() ELSE closed_at END
    WHERE id = p_work_order_id;

    -- 8. Audit Work Order update using log_entity_change
    v_wo_change_id := public.log_entity_change(
        'work_orders',
        p_work_order_id,
        'EDIT',
        jsonb_build_object('status', p_new_status),
        COALESCE(p_reason, 'Work order status updated to ' || p_new_status)
    );

    -- 9. Re-derive Unit Operational Status
    v_new_op_status := public.derive_unit_operational_status(v_work_order.unit_id);

    -- 10. Update unit if operational status changed
    IF v_previous_op_status != v_new_op_status THEN
        UPDATE public.units
        SET operational_status = v_new_op_status,
            updated_at = NOW(),
            updated_by = v_actor_id
        WHERE id = v_work_order.unit_id;

        -- Write audit for unit status change using public.log_entity_change
        v_change_history_id := public.log_entity_change(
            'units',
            v_work_order.unit_id,
            'EDIT',
            jsonb_build_object('operational_status', jsonb_build_object('from', v_previous_op_status, 'to', v_new_op_status)),
            'Atomic transition: Work Order ' || v_work_order.work_order_code || ' updated to ' || p_new_status
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'work_order_id', p_work_order_id,
        'work_order_status', p_new_status,
        'unit_id', v_work_order.unit_id,
        'previous_operational_status', v_previous_op_status,
        'new_operational_status', v_new_op_status
    );
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.transition_work_order_status(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_work_order_status(UUID, VARCHAR, TEXT) TO authenticated;
