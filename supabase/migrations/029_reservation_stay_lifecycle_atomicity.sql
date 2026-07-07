-- =====================================================
-- IRM Enterprise Migration: 029_reservation_stay_lifecycle_atomicity.sql
-- =====================================================

-- SECURITY DEFINER Function for Check-in Guest Atomicity
CREATE OR REPLACE FUNCTION public.check_in_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_res RECORD;
    v_unit_id UUID;
    v_start DATE;
    v_end DATE;
    v_current_start DATE;
    v_next_month DATE;
    v_period_end DATE;
    v_start_str VARCHAR;
    v_end_str VARCHAR;
    v_due_str VARCHAR;
    v_rent NUMERIC;
    v_expected_total NUMERIC;
    v_days_in_period INTEGER;
    v_discount NUMERIC;
    v_is_first_period BOOLEAN DEFAULT TRUE;
BEGIN
    -- 1. Derive actor from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- 2. Fetch actor profile & validate role
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role NOT IN ('admin', 'super_admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Role % is not authorized to check in guests', v_actor_role;
    END IF;

    -- 3. Lock Reservation row FOR UPDATE
    SELECT * INTO v_res
    FROM public.reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;

    -- 4. Lock Unit row FOR UPDATE to establish unit concurrency boundary
    SELECT id INTO v_unit_id
    FROM public.units
    WHERE id = v_res.unit_id
    FOR UPDATE;

    -- 5. Enforce property scope
    IF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR v_res.property_id <> v_actor_property_id THEN
            RAISE EXCEPTION 'Forbidden: cross-property check-in denied';
        END IF;
    END IF;

    -- 6. Validate current status is CONFIRMED
    IF v_res.status <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'Only confirmed reservations can be checked in';
    END IF;

    -- 7. Double check conflicting active occupancy under locked unit boundary
    IF EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = v_res.unit_id
          AND status = 'CHECKED_IN'
          AND id <> p_reservation_id
          AND tstzrange(check_in_at, check_out_at, '[)') && tstzrange(v_res.check_in_at, v_res.check_out_at, '[)')
    ) THEN
        RAISE EXCEPTION 'Occupancy conflict: Another reservation is already checked-in for this unit during this period';
    END IF;

    -- 8. Transition Reservation status to CHECKED_IN
    UPDATE public.reservations
    SET status = 'CHECKED_IN',
        checked_in_by = v_actor_id,
        actual_check_in_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;

    -- 9. Generate stay charge period records
    v_start := v_res.check_in_at::DATE;
    v_end := v_res.check_out_at::DATE;

    v_current_start := v_start;

    WHILE v_current_start < v_end LOOP
        v_next_month := (date_trunc('month', v_current_start) + INTERVAL '1 month')::DATE;
        v_period_end := LEAST((v_next_month - INTERVAL '1 day')::DATE, v_end);

        v_start_str := to_char(v_current_start, 'YYYY-MM-DD');
        v_end_str := to_char(v_period_end, 'YYYY-MM-DD');
        v_due_str := to_char(LEAST((date_trunc('month', v_current_start) + INTERVAL '4 days')::DATE, v_period_end), 'YYYY-MM-DD');

        v_rent := COALESCE(v_res.monthly_rate, 0);
        IF v_res.billing_basis = 'DAILY' THEN
            IF v_period_end = v_end THEN
                v_days_in_period := v_period_end - v_current_start;
            ELSE
                v_days_in_period := v_next_month - v_current_start;
            END IF;
            v_rent := COALESCE(v_res.daily_rate, 0) * v_days_in_period;
        END IF;

        -- Apply discount only to the first period to prevent monthly multiplication
        v_discount := 0;
        IF v_is_first_period THEN
            v_discount := COALESCE(v_res.discount_amount, 0);
            v_is_first_period := FALSE;
        END IF;

        v_expected_total := v_rent - v_discount;
        IF v_expected_total < 0 THEN
            v_expected_total := 0;
        END IF;

        INSERT INTO public.stay_charge_periods (
            reservation_id,
            property_id,
            unit_id,
            period_start,
            period_end,
            due_date,
            rent_amount,
            discount_amount,
            expected_total,
            outstanding_amount,
            overall_status
        ) VALUES (
            v_res.id,
            v_res.property_id,
            v_res.unit_id,
            v_start_str::DATE,
            v_end_str::DATE,
            v_due_str::DATE,
            v_rent,
            v_discount,
            v_expected_total,
            v_expected_total,
            'NOT_READY'
        ) ON CONFLICT (reservation_id, period_start, period_end) DO NOTHING;

        v_current_start := v_next_month;
    END LOOP;

    -- 10. Write audit log history using log_entity_change
    PERFORM public.log_entity_change(
        'reservations',
        p_reservation_id,
        'EDIT',
        jsonb_build_object('status', 'CHECKED_IN'),
        'Checked in via public.check_in_reservation'
    );
END;
$$;

-- SECURITY DEFINER Function for Check-out Guest Atomicity
CREATE OR REPLACE FUNCTION public.check_out_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_res RECORD;
    v_unit_id UUID;
BEGIN
    -- 1. Derive actor from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- 2. Fetch actor profile & validate role
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role NOT IN ('admin', 'super_admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Role % is not authorized to check out guests', v_actor_role;
    END IF;

    -- 3. Lock Reservation row FOR UPDATE
    SELECT * INTO v_res
    FROM public.reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;

    -- 4. Lock Unit row FOR UPDATE to establish unit concurrency boundary
    SELECT id INTO v_unit_id
    FROM public.units
    WHERE id = v_res.unit_id
    FOR UPDATE;

    -- 5. Enforce property scope
    IF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR v_res.property_id <> v_actor_property_id THEN
            RAISE EXCEPTION 'Forbidden: cross-property check-out denied';
        END IF;
    END IF;

    -- 6. Validate current status is CHECKED_IN
    IF v_res.status <> 'CHECKED_IN' THEN
        RAISE EXCEPTION 'Only active checked-in stays can be checked out';
    END IF;

    -- 7. Transition Reservation status to CHECKED_OUT
    UPDATE public.reservations
    SET status = 'CHECKED_OUT',
        checked_out_by = v_actor_id,
        actual_check_out_at = NOW(),
        updated_at = NOW()
    WHERE id = p_reservation_id;

    -- 8. Write audit log history using log_entity_change
    PERFORM public.log_entity_change(
        'reservations',
        p_reservation_id,
        'EDIT',
        jsonb_build_object('status', 'CHECKED_OUT'),
        'Checked out via public.check_out_reservation'
    );
END;
$$;

-- Revoke default public execution privileges and grant only to authenticated roles
REVOKE EXECUTE ON FUNCTION public.check_in_reservation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_reservation(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_out_reservation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out_reservation(UUID) TO authenticated;
