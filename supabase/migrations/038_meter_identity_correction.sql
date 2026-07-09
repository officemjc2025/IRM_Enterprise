-- =====================================================
-- IRM Enterprise Migration: 038_meter_identity_correction.sql
-- =====================================================

-- 1. Drop old replace_utility_meter function to redefine it
DROP FUNCTION IF EXISTS public.replace_utility_meter(UUID, VARCHAR, VARCHAR, NUMERIC, NUMERIC, TEXT, DATE, UUID);

-- 2. Define the corrected replace_utility_meter function
CREATE OR REPLACE FUNCTION public.replace_utility_meter(
    p_old_meter_id UUID,
    p_new_internal_code VARCHAR, -- Accepted for compatibility, but ignored in favor of authoritative DB generation
    p_manufacturer_serial_number VARCHAR,
    p_starting_reading NUMERIC,
    p_final_reading NUMERIC,
    p_replacement_reason TEXT,
    p_replacement_date DATE,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_old_meter RECORD;
    v_new_meter_id UUID;
    v_unit_number VARCHAR;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_last_reading NUMERIC;
    v_max_seq INTEGER;
    v_next_seq INTEGER;
    v_seq_str VARCHAR(10);
    v_util_code VARCHAR(10);
    v_yyyymm VARCHAR(10);
    v_new_internal_code VARCHAR(100);
BEGIN
    -- 1. Fetch old meter and lock it
    SELECT * INTO v_old_meter
    FROM public.utility_meters
    WHERE id = p_old_meter_id
    FOR UPDATE;

    IF v_old_meter IS NULL THEN
        RAISE EXCEPTION 'Old meter not found';
    END IF;

    -- 2. Lock parent unit row to serialize replacements per unit
    SELECT unit_number INTO v_unit_number
    FROM public.units
    WHERE id = v_old_meter.unit_id
    FOR UPDATE;

    IF v_unit_number IS NULL THEN
        RAISE EXCEPTION 'Unit not found';
    END IF;

    -- 3. Fetch actor profile details and check role authorization
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = p_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    IF v_actor_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Actor lacks authorization for replacement';
    END IF;

    -- Property scope check
    IF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR v_old_meter.property_id != v_actor_property_id THEN
            RAISE EXCEPTION 'Forbidden: Cross-property action is denied';
        END IF;
    END IF;

    -- Verify old meter status
    IF v_old_meter.meter_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Old meter is not active';
    END IF;

    -- 4. Old final reading validation
    SELECT COALESCE(MAX(current_reading), v_old_meter.initial_reading) INTO v_last_reading
    FROM public.meter_readings
    WHERE meter_id = p_old_meter_id AND status = 'APPROVED';

    IF p_final_reading IS NULL THEN
        RAISE EXCEPTION 'Final reading of the old meter is required';
    END IF;

    IF p_final_reading < v_last_reading THEN
        RAISE EXCEPTION 'Invalid final reading: % is less than the last approved or initial reading (%)', p_final_reading, v_last_reading;
    END IF;

    -- 5. Calculate next sequence and generate the canonical internal meter code
    SELECT COALESCE(MAX(regexp_replace(meter_number, '^.*-', '')::INTEGER), 0) INTO v_max_seq
    FROM public.utility_meters
    WHERE unit_id = v_old_meter.unit_id AND utility_type = v_old_meter.utility_type;

    v_next_seq := v_max_seq + 1;
    v_seq_str := LPAD(v_next_seq::TEXT, 2, '0');
    v_util_code := CASE WHEN v_old_meter.utility_type = 'WATER' THEN 'WM' ELSE 'EM' END;
    v_yyyymm := to_char(p_replacement_date, 'YYYYMM');
    v_new_internal_code := v_unit_number || '-' || v_util_code || '-' || v_yyyymm || '-' || v_seq_str;

    -- 6. Check duplicate manufacturer serial number if provided
    IF p_manufacturer_serial_number IS NOT NULL AND TRIM(p_manufacturer_serial_number) != '' THEN
        IF EXISTS (
            SELECT 1 FROM public.utility_meters
            WHERE manufacturer_serial_number = TRIM(p_manufacturer_serial_number)
        ) THEN
            RAISE EXCEPTION 'Manufacturer serial number % is already registered', p_manufacturer_serial_number;
        END IF;
    END IF;

    -- 7. Retire old meter
    UPDATE public.utility_meters
    SET meter_status = 'RETIRED',
        retired_at = p_replacement_date,
        updated_at = NOW()
    WHERE id = p_old_meter_id;

    -- 8. Insert new meter
    INSERT INTO public.utility_meters (
        property_id,
        unit_id,
        utility_type,
        meter_number,
        manufacturer_serial_number,
        installed_at,
        installation_date_known,
        meter_status,
        initial_reading,
        created_at,
        updated_at
    )
    VALUES (
        v_old_meter.property_id,
        v_old_meter.unit_id,
        v_old_meter.utility_type,
        v_new_internal_code,
        NULLIF(TRIM(p_manufacturer_serial_number), ''),
        p_replacement_date,
        TRUE,
        'ACTIVE',
        p_starting_reading,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_meter_id;

    -- 9. Insert replacement history record
    INSERT INTO public.meter_replacement_history (
        property_id,
        unit_id,
        utility_type,
        old_meter_id,
        old_meter_number,
        final_reading,
        new_meter_id,
        new_meter_number,
        starting_reading,
        replacement_reason,
        replaced_by,
        replaced_at
    )
    VALUES (
        v_old_meter.property_id,
        v_old_meter.unit_id,
        v_old_meter.utility_type,
        p_old_meter_id,
        v_old_meter.meter_number,
        p_final_reading,
        v_new_meter_id,
        v_new_internal_code,
        p_starting_reading,
        p_replacement_reason,
        p_actor_id,
        NOW()
    );

    -- 10. Write Audit Log
    PERFORM public.log_entity_change(
        'units',
        v_old_meter.unit_id,
        'EDIT',
        jsonb_build_object(
            'action', 'METER_REPLACEMENT',
            'utility_type', v_old_meter.utility_type,
            'old_meter_number', v_old_meter.meter_number,
            'new_meter_number', v_new_internal_code,
            'manufacturer_serial_number', NULLIF(TRIM(p_manufacturer_serial_number), ''),
            'reason', p_replacement_reason
        ),
        'Replaced ' || v_old_meter.utility_type || ' meter in Unit ' || v_unit_number
    );

    RETURN jsonb_build_object(
        'success', true,
        'old_meter_id', p_old_meter_id,
        'new_meter_id', v_new_meter_id,
        'new_internal_code', v_new_internal_code
    );
END;
$$;
