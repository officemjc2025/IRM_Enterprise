-- =====================================================
-- IRM Enterprise Migration: 035_ownership_and_bootstrap_atomicity.sql
-- =====================================================
-- Purpose: Implement database-authoritative aggregate ownership guard
-- with parent-row locking, and atomic plan-based batch import.
--
-- ⚠️ DO NOT APPLY THIS MIGRATION. STOP after creation.
-- =====================================================

-- -------------------------------------------------------
-- 1. AGGREGATE OWNERSHIP PERCENTAGE GUARD
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_aggregate_ownership_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_total_percent NUMERIC(5,2);
    v_new_start DATE := NEW.start_date;
    v_new_end DATE := COALESCE(NEW.end_date, '9999-12-31'::DATE);
BEGIN
    -- Only check active assignments
    IF NEW.status != 'ACTIVE' OR NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Concurrency: Lock parent Unit row to prevent empty-set insert race conditions on the same unit
    PERFORM 1 
    FROM public.units
    WHERE id = NEW.unit_id
    FOR UPDATE;

    -- Calculate aggregate percent of overlapping active assignments (self-counting exclusion handles inserts & updates correctly)
    SELECT COALESCE(SUM(ownership_percent), 0) INTO v_total_percent
    FROM public.owner_assignments
    WHERE unit_id = NEW.unit_id
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND start_date <= v_new_end
      AND COALESCE(end_date, '9999-12-31'::DATE) >= v_new_start;

    IF (v_total_percent + NEW.ownership_percent) > 100.00 THEN
        RAISE EXCEPTION 'Ownership limit exceeded: Active overlapping ownership shares on unit % total %, which exceeds 100%% limit.', 
            NEW.unit_id, (v_total_percent + NEW.ownership_percent);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_check_aggregate_ownership_limit ON public.owner_assignments;
CREATE TRIGGER tr_check_aggregate_ownership_limit
    BEFORE INSERT OR UPDATE ON public.owner_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.check_aggregate_ownership_limit();

-- -------------------------------------------------------
-- 2. ATOMIC PLAN-BASED METRO BATCH IMPORT RPC
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_validated_metro_plan(
    p_property_id UUID,
    p_plan JSONB
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
    
    v_units_to_upsert JSONB := COALESCE(p_plan->'units_to_upsert', '[]'::JSONB);
    v_persons_to_create JSONB := COALESCE(p_plan->'persons_to_create', '[]'::JSONB);
    v_ownerships_to_create JSONB := COALESCE(p_plan->'ownerships_to_create', '[]'::JSONB);
    v_meters_to_create JSONB := COALESCE(p_plan->'meters_to_create', '[]'::JSONB);
    
    v_item JSONB;
    v_unit_id UUID;
    v_first_unit_id UUID := NULL;
    v_person_id UUID;
    
    v_inserted_units INT := 0;
    v_updated_units INT := 0;
    v_created_persons INT := 0;
    v_created_owners INT := 0;
    v_created_meters INT := 0;
    
    v_unit_num VARCHAR;
    v_floor VARCHAR;
    v_area NUMERIC;
    v_ratio NUMERIC;
    v_status_str VARCHAR;
    v_op_status_val VARCHAR;
    
    v_owner_name VARCHAR;
    v_first_name VARCHAR;
    v_last_name VARCHAR;
    v_own_pct NUMERIC(5,2);
    v_own_type VARCHAR;
    
    v_utility_type VARCHAR;
    v_meter_number VARCHAR;
BEGIN
    -- 1. Derive actor identity from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Must be logged in';
    END IF;

    -- 2. Fetch actor profile details
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    -- 3. Scoping & cross-property checks (Fail closed)
    IF v_actor_role NOT IN ('admin', 'super_admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Role % not authorized to import data', v_actor_role;
    END IF;

    IF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR v_actor_property_id != p_property_id THEN
            RAISE EXCEPTION 'Forbidden: Cross-property import denied';
        END IF;
    END IF;

    -- Verify target property exists
    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id) THEN
        RAISE EXCEPTION 'Target property not found';
    END IF;

    -- Lock the target property row to serialize imports on this property
    PERFORM 1 FROM public.properties WHERE id = p_property_id FOR UPDATE;

    -- 4. Process Units Upsert
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_units_to_upsert)
    LOOP
        v_unit_num := UPPER(TRIM(v_item->>'unit_number'));
        v_floor := TRIM(COALESCE(v_item->>'floor', '1'));
        v_area := COALESCE((v_item->>'area')::NUMERIC, 0);
        v_ratio := COALESCE((v_item->>'ownership_ratio')::NUMERIC, 0);
        v_status_str := UPPER(TRIM(COALESCE(v_item->>'status', 'ACTIVE')));
        v_op_status_val := v_item->>'operational_status';

        SELECT id INTO v_unit_id FROM public.units
        WHERE property_id = p_property_id AND UPPER(TRIM(unit_number)) = v_unit_num AND deleted_at IS NULL
        FOR UPDATE;

        IF FOUND THEN
            IF v_op_status_val IS NOT NULL THEN
                UPDATE public.units
                SET floor = v_floor,
                    area = v_area,
                    ownership_ratio = v_ratio,
                    status = v_status_str,
                    operational_status = v_op_status_val,
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_unit_id;
            ELSE
                UPDATE public.units
                SET floor = v_floor,
                    area = v_area,
                    ownership_ratio = v_ratio,
                    status = v_status_str,
                    updated_at = NOW(),
                    updated_by = v_actor_id
                WHERE id = v_unit_id;
            END IF;
            v_updated_units := v_updated_units + 1;
        ELSE
            INSERT INTO public.units (
                property_id,
                building_code,
                floor,
                unit_number,
                area,
                ownership_ratio,
                status,
                operational_status,
                created_at,
                updated_at,
                updated_by
            ) VALUES (
                p_property_id,
                'A',
                v_floor,
                v_unit_num,
                v_area,
                v_ratio,
                v_status_str,
                COALESCE(v_op_status_val, 'VACANT'),
                NOW(),
                NOW(),
                v_actor_id
            ) RETURNING id INTO v_unit_id;
            v_inserted_units := v_inserted_units + 1;
        END IF;

        IF v_first_unit_id IS NULL THEN
            v_first_unit_id := v_unit_id;
        END IF;
    END LOOP;

    -- 5. Process Persons Upsert
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_persons_to_create)
    LOOP
        v_owner_name := TRIM(v_item->>'display_name');
        v_first_name := TRIM(v_item->>'first_name');
        v_last_name := TRIM(v_item->>'last_name');
        v_unit_num := UPPER(TRIM(v_item->>'unit_number'));

        SELECT id INTO v_person_id FROM public.persons
        WHERE UPPER(TRIM(first_name)) = UPPER(TRIM(v_first_name))
          AND UPPER(TRIM(last_name)) = UPPER(TRIM(v_last_name))
          AND deleted_at IS NULL
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.persons (
                person_code,
                first_name,
                last_name,
                display_name,
                status,
                created_at,
                updated_at
            ) VALUES (
                'PER-OWN-' || v_unit_num || '-' || floor(random() * 1000000)::text,
                v_first_name,
                v_last_name,
                v_owner_name,
                'ACTIVE',
                NOW(),
                NOW()
            );
            v_created_persons := v_created_persons + 1;
        END IF;
    END LOOP;

    -- 6. Process Owner Assignments
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_ownerships_to_create)
    LOOP
        v_unit_num := UPPER(TRIM(v_item->>'unit_number'));
        v_owner_name := TRIM(v_item->>'owner_name');
        v_own_type := UPPER(TRIM(COALESCE(v_item->>'ownership_type', 'OWNER')));
        v_own_pct := COALESCE((v_item->>'ownership_percent')::NUMERIC, 100.00);

        SELECT id INTO v_unit_id FROM public.units
        WHERE property_id = p_property_id AND UPPER(TRIM(unit_number)) = v_unit_num AND deleted_at IS NULL;
        
        DECLARE
            v_parts TEXT[];
        BEGIN
            v_parts := regexp_split_to_array(v_owner_name, '\s+');
            v_first_name := v_parts[1];
            IF array_length(v_parts, 1) > 1 THEN
                v_last_name := array_to_string(v_parts[2:array_length(v_parts, 1)], ' ');
            ELSE
                v_last_name := '-';
            END IF;
        END;

        SELECT id INTO v_person_id FROM public.persons
        WHERE UPPER(TRIM(first_name)) = UPPER(TRIM(v_first_name))
          AND UPPER(TRIM(last_name)) = UPPER(TRIM(v_last_name))
          AND deleted_at IS NULL;

        IF v_unit_id IS NOT NULL AND v_person_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.owner_assignments
                WHERE unit_id = v_unit_id AND person_id = v_person_id AND deleted_at IS NULL
            ) THEN
                INSERT INTO public.owner_assignments (
                    person_id,
                    unit_id,
                    ownership_type,
                    ownership_percent,
                    start_date,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    v_person_id,
                    v_unit_id,
                    v_own_type,
                    v_own_pct,
                    CURRENT_DATE,
                    'ACTIVE',
                    NOW(),
                    NOW()
                );
                v_created_owners := v_created_owners + 1;
            END IF;
        END IF;
    END LOOP;

    -- 7. Process Utility Meters
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_meters_to_create)
    LOOP
        v_unit_num := UPPER(TRIM(v_item->>'unit_number'));
        v_utility_type := UPPER(TRIM(v_item->>'utility_type'));
        v_meter_number := TRIM(v_item->>'meter_number');

        SELECT id INTO v_unit_id FROM public.units
        WHERE property_id = p_property_id AND UPPER(TRIM(unit_number)) = v_unit_num AND deleted_at IS NULL;

        IF v_unit_id IS NOT NULL AND v_meter_number != '' THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.utility_meters
                WHERE unit_id = v_unit_id AND utility_type = v_utility_type
            ) THEN
                INSERT INTO public.utility_meters (
                    property_id,
                    unit_id,
                    utility_type,
                    meter_number,
                    installed_at,
                    meter_status,
                    initial_reading,
                    created_at,
                    updated_at
                ) VALUES (
                    p_property_id,
                    v_unit_id,
                    v_utility_type,
                    v_meter_number,
                    CURRENT_DATE,
                    'ACTIVE',
                    0.00,
                    NOW(),
                    NOW()
                );
                v_created_meters := v_created_meters + 1;
            END IF;
        END IF;
    END LOOP;

    -- 8. Write Audit Trail using log_entity_change
    IF v_first_unit_id IS NOT NULL THEN
        PERFORM public.log_entity_change(
            'units',
            v_first_unit_id,
            'EDIT',
            jsonb_build_object(
                'inserted_units', v_inserted_units,
                'updated_units', v_updated_units,
                'created_persons', v_created_persons,
                'created_owners', v_created_owners,
                'created_meters', v_created_meters
            ),
            'Validated Metro bootstrap plan batch import'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'summary', jsonb_build_object(
            'inserted', v_inserted_units,
            'updated', v_updated_units,
            'persons_created', v_created_persons,
            'owners_assigned', v_created_owners,
            'meters_created', v_created_meters
        )
    );
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.import_validated_metro_plan(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_validated_metro_plan(UUID, JSONB) TO authenticated;
