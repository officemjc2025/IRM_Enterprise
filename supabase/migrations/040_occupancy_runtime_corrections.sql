-- =====================================================
-- IRM Enterprise Migration: 040_occupancy_runtime_corrections.sql
-- =====================================================

-- 1. Correct import_occupancies to resolve array coercion runtime error
-- Replaces "v_workbook_duplicates @> ARRAY[v_duplicate_check_key]" with "= ANY(v_workbook_duplicates)"
CREATE OR REPLACE FUNCTION public.import_occupancies(
    p_rows JSONB,
    p_actor_id UUID,
    p_dry_run BOOLEAN
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
    v_row JSONB;
    v_row_idx INT := 0;
    v_unit_id UUID;
    v_property_id UUID;
    v_unit_number VARCHAR;
    v_full_name VARCHAR;
    v_first_name VARCHAR;
    v_last_name VARCHAR;
    v_phone VARCHAR;
    v_email VARCHAR;
    v_type_raw VARCHAR;
    v_type VARCHAR;
    v_move_in DATE;
    v_move_out DATE;
    v_note TEXT;
    v_person_id UUID;
    v_existing_person RECORD;
    v_next_person_seq INT;
    v_generated_person_code VARCHAR;
    v_existing_occ RECORD;
    v_new_occ_id UUID;
    
    -- Counter and validation status
    v_total_rows INT := 0;
    v_valid_rows INT := 0;
    v_error_rows INT := 0;
    v_warning_rows INT := 0;
    v_persons_created INT := 0;
    v_persons_matched INT := 0;
    v_occupancies_created INT := 0;
    v_occupancies_updated INT := 0;
    
    -- Outputs
    v_results JSONB := '[]'::JSONB;
    v_errors JSONB;
    v_error_msg VARCHAR;
    v_has_critical_error BOOLEAN := FALSE;
    v_duplicate_check_key VARCHAR;
    
    -- In-memory arrays/hashes to check workbook duplicates
    v_workbook_duplicates TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Resolve authoritative actor from auth.uid() (preferred hardening)
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: auth.uid() is null';
    END IF;

    -- Verify Actor exists and is authorized
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    IF v_actor_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Actor lacks authorization for import';
    END IF;

    -- Validate input rows count
    v_total_rows := jsonb_array_length(p_rows);
    IF v_total_rows = 0 THEN
        RAISE EXCEPTION 'Payload is empty';
    END IF;

    -- Loop to validate each row
    FOR v_row_idx IN 0..(v_total_rows - 1) LOOP
        v_row := p_rows->v_row_idx;
        
        -- Extract inputs
        v_unit_number := TRIM(COALESCE(v_row->>'UNIT_NUMBER', v_row->>'unit_number', ''));
        v_full_name := TRIM(COALESCE(v_row->>'FULL_NAME', v_row->>'full_name', ''));
        v_phone := TRIM(COALESCE(v_row->>'PHONE', v_row->>'phone', ''));
        v_email := TRIM(COALESCE(v_row->>'EMAIL', v_row->>'email', ''));
        v_type_raw := UPPER(TRIM(COALESCE(v_row->>'OCCUPANCY_TYPE', v_row->>'occupancy_type', '')));
        v_note := TRIM(COALESCE(v_row->>'NOTE', v_row->>'note', v_row->>'remarks', ''));
        
        -- Extract dates
        v_move_in := NULL;
        v_move_out := NULL;
        BEGIN
            IF (v_row->>'MOVE_IN_DATE') IS NOT NULL AND (v_row->>'MOVE_IN_DATE') != '' THEN
                v_move_in := (v_row->>'MOVE_IN_DATE')::DATE;
            ELSIF (v_row->>'move_in_date') IS NOT NULL AND (v_row->>'move_in_date') != '' THEN
                v_move_in := (v_row->>'move_in_date')::DATE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Handle conversion error below
        END;

        BEGIN
            IF (v_row->>'MOVE_OUT_DATE') IS NOT NULL AND (v_row->>'MOVE_OUT_DATE') != '' THEN
                v_move_out := (v_row->>'MOVE_OUT_DATE')::DATE;
            ELSIF (v_row->>'move_out_date') IS NOT NULL AND (v_row->>'move_out_date') != '' THEN
                v_move_out := (v_row->>'move_out_date')::DATE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Handle conversion error below
        END;

        -- Row validation tracking
        v_errors := '[]'::JSONB;
        v_error_msg := NULL;

        -- 1. Validate required fields
        IF v_unit_number = '' THEN
            v_errors := v_errors || jsonb_build_object('column', 'UNIT_NUMBER', 'message', 'Room No (unit_number) is required', 'severity', 'error');
        END IF;

        IF v_full_name = '' THEN
            v_errors := v_errors || jsonb_build_object('column', 'FULL_NAME', 'message', 'Full Name is required', 'severity', 'error');
        END IF;

        IF v_type_raw = '' THEN
            v_errors := v_errors || jsonb_build_object('column', 'OCCUPANCY_TYPE', 'message', 'Occupancy Type is required', 'severity', 'error');
        END IF;

        IF v_move_in IS NULL THEN
            v_errors := v_errors || jsonb_build_object('column', 'MOVE_IN_DATE', 'message', 'Move-in date is required and must be a valid date (YYYY-MM-DD)', 'severity', 'error');
        END IF;

        -- 2. Validate move-out before move-in
        IF v_move_in IS NOT NULL AND v_move_out IS NOT NULL AND v_move_out < v_move_in THEN
            v_errors := v_errors || jsonb_build_object('column', 'MOVE_OUT_DATE', 'message', 'Move-out date cannot be earlier than move-in date', 'severity', 'error');
        END IF;

        -- 3. Validate occupancy type values
        IF v_type_raw != '' THEN
            IF v_type_raw IN ('OWNER', 'CO_OWNER', 'FAMILY_MEMBER', 'TENANT', 'RESIDENT', 'STAFF', 'COMPANY') THEN
                v_type := v_type_raw;
            ELSE
                v_errors := v_errors || jsonb_build_object('column', 'OCCUPANCY_TYPE', 'message', 'Occupancy type must be one of: OWNER, CO_OWNER, FAMILY_MEMBER, TENANT, RESIDENT, STAFF, COMPANY', 'severity', 'error');
            END IF;
        END IF;

        -- 4. Check workbook duplicate
        v_duplicate_check_key := v_unit_number || '::' || v_full_name || '::' || COALESCE(v_type, '');
        IF v_duplicate_check_key = ANY(v_workbook_duplicates) THEN
            v_errors := v_errors || jsonb_build_object('column', 'UNIT_NUMBER', 'message', 'Duplicate identical assignment row detected in workbook', 'severity', 'error');
        ELSE
            v_workbook_duplicates := array_append(v_workbook_duplicates, v_duplicate_check_key);
        END IF;

        -- 5. Resolve unit and verify property scope
        v_unit_id := NULL;
        IF v_unit_number != '' THEN
            SELECT id, property_id INTO v_unit_id, v_property_id
            FROM public.units
            WHERE UPPER(TRIM(unit_number)) = UPPER(v_unit_number)
              AND deleted_at IS NULL;

            IF v_unit_id IS NULL THEN
                v_errors := v_errors || jsonb_build_object('column', 'UNIT_NUMBER', 'message', 'Unit number "' || v_unit_number || '" not found in database', 'severity', 'error');
            ELSIF v_actor_role = 'property_admin' AND v_actor_property_id != v_property_id THEN
                v_errors := v_errors || jsonb_build_object('column', 'UNIT_NUMBER', 'message', 'Forbidden: Cross-property action is denied', 'severity', 'error');
            END IF;
        END IF;

        -- Check if row has error so far
        IF jsonb_array_length(v_errors) > 0 THEN
            v_has_critical_error := TRUE;
        END IF;

        -- 6. Person Resolution & Dup-checking
        v_person_id := NULL;
        IF v_full_name != '' THEN
            -- Deduplicate by email first if present
            IF v_email != '' AND v_person_id IS NULL THEN
                SELECT id INTO v_person_id
                FROM public.persons
                WHERE LOWER(TRIM(email)) = LOWER(v_email)
                  AND deleted_at IS NULL
                ORDER BY created_at ASC
                LIMIT 1;
            END IF;

            -- Deduplicate by phone next if present
            IF v_phone != '' AND v_person_id IS NULL THEN
                SELECT id INTO v_person_id
                FROM public.persons
                WHERE public.normalize_phone(phone) = public.normalize_phone(v_phone)
                  AND deleted_at IS NULL
                ORDER BY created_at ASC
                LIMIT 1;
            END IF;

            IF v_person_id IS NOT NULL THEN
                v_persons_matched := v_persons_matched + 1;
                v_errors := v_errors || jsonb_build_object('column', 'FULL_NAME', 'message', 'Resolved to existing person in database', 'severity', 'warning');
            ELSE
                v_persons_created := v_persons_created + 1;
                v_errors := v_errors || jsonb_build_object('column', 'FULL_NAME', 'message', 'New occupant profile will be created', 'severity', 'warning');
            END IF;
        END IF;

        -- 7. Check existing active equivalent occupancy in database
        IF v_unit_id IS NOT NULL AND v_person_id IS NOT NULL AND v_type IS NOT NULL THEN
            SELECT * INTO v_existing_occ
            FROM public.occupancies
            WHERE unit_id = v_unit_id
              AND person_id = v_person_id
              AND occupancy_type = v_type
              AND status = 'ACTIVE'
              AND deleted_at IS NULL;

            IF v_existing_occ.id IS NOT NULL THEN
                v_errors := v_errors || jsonb_build_object('column', 'UNIT_NUMBER', 'message', 'Active equivalent assignment already exists in database (skipped)', 'severity', 'warning');
            END IF;
        END IF;

        -- 8. Verify status and counts
        IF EXISTS (SELECT 1 FROM jsonb_to_recordset(v_errors) AS x(severity TEXT) WHERE severity = 'error') THEN
            v_error_rows := v_error_rows + 1;
        ELSIF jsonb_array_length(v_errors) > 0 THEN
            v_warning_rows := v_warning_rows + 1;
            v_valid_rows := v_valid_rows + 1;
        ELSE
            v_valid_rows := v_valid_rows + 1;
        END IF;

        v_results := v_results || jsonb_build_object(
            'rowNumber', v_row_idx + 2,
            'normalizedData', jsonb_build_object(
                'unit_number', v_unit_number,
                'full_name', v_full_name,
                'phone', NULLIF(v_phone, ''),
                'email', NULLIF(v_email, ''),
                'occupancy_type', v_type,
                'move_in_date', v_move_in,
                'move_out_date', v_move_out,
                'remark', NULLIF(v_note, '')
            ),
            'errors', v_errors
        );
    END LOOP;

    -- Return stats if it is a dry run or has critical validation errors
    IF p_dry_run OR v_has_critical_error THEN
        RETURN jsonb_build_object(
            'success', NOT v_has_critical_error,
            'summary', jsonb_build_object(
                'totalRows', v_total_rows,
                'validRows', v_valid_rows,
                'warningRows', v_warning_rows,
                'errorRows', v_error_rows,
                'importReady', NOT v_has_critical_error
            ),
            'results', v_results,
            'previewStats', jsonb_build_object(
                'occupancies', jsonb_build_object('create', v_total_rows - v_error_rows, 'update', 0),
                'persons', jsonb_build_object('create', v_persons_created, 'match', v_persons_matched)
            )
        );
    END IF;

    -- 9. Commit Mode — perform writes
    FOR v_row_idx IN 0..(v_total_rows - 1) LOOP
        v_row := p_rows->v_row_idx;
        v_unit_number := TRIM(COALESCE(v_row->>'UNIT_NUMBER', v_row->>'unit_number', ''));
        v_full_name := TRIM(COALESCE(v_row->>'FULL_NAME', v_row->>'full_name', ''));
        v_phone := TRIM(COALESCE(v_row->>'PHONE', v_row->>'phone', ''));
        v_email := TRIM(COALESCE(v_row->>'EMAIL', v_row->>'email', ''));
        v_type := UPPER(TRIM(COALESCE(v_row->>'OCCUPANCY_TYPE', v_row->>'occupancy_type', '')));
        v_note := TRIM(COALESCE(v_row->>'NOTE', v_row->>'note', v_row->>'remarks', ''));
        
        v_move_in := (COALESCE(v_row->>'MOVE_IN_DATE', v_row->>'move_in_date'))::DATE;
        v_move_out := NULL;
        IF (v_row->>'MOVE_OUT_DATE') IS NOT NULL AND (v_row->>'MOVE_OUT_DATE') != '' THEN
            v_move_out := (v_row->>'MOVE_OUT_DATE')::DATE;
        ELSIF (v_row->>'move_out_date') IS NOT NULL AND (v_row->>'move_out_date') != '' THEN
            v_move_out := (v_row->>'move_out_date')::DATE;
        END IF;

        -- Resolve Unit ID and Property ID
        SELECT id, property_id INTO v_unit_id, v_property_id
        FROM public.units
        WHERE UPPER(TRIM(unit_number)) = UPPER(v_unit_number)
          AND deleted_at IS NULL;

        -- Person Resolution
        v_person_id := NULL;
        IF v_email != '' THEN
            SELECT id INTO v_person_id
            FROM public.persons
            WHERE LOWER(TRIM(email)) = LOWER(v_email)
              AND deleted_at IS NULL
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        IF v_phone != '' AND v_person_id IS NULL THEN
            SELECT id INTO v_person_id
            FROM public.persons
            WHERE public.normalize_phone(phone) = public.normalize_phone(v_phone)
              AND deleted_at IS NULL
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;

        -- If not resolved, create new Person
        IF v_person_id IS NULL THEN
            -- Parse first and last name
            v_first_name := split_part(v_full_name, ' ', 1);
            v_last_name := substr(v_full_name, length(v_first_name) + 2);
            IF v_last_name = '' THEN
                v_last_name := '-';
            END IF;

            -- Generate person_code (P + max_seq + 1)
            SELECT COALESCE(MAX(SUBSTRING(person_code FROM 2)::INTEGER), 0) INTO v_next_person_seq
            FROM public.persons
            WHERE person_code LIKE 'P%';

            v_generated_person_code := 'P' || LPAD((v_next_person_seq + 1)::TEXT, 5, '0');

            -- Insert Person record
            INSERT INTO public.persons (
                person_code,
                first_name,
                last_name,
                display_name,
                phone,
                email,
                status,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            )
            VALUES (
                v_generated_person_code,
                v_first_name,
                v_last_name,
                v_full_name,
                NULLIF(v_phone, ''),
                NULLIF(LOWER(v_email), ''),
                'ACTIVE',
                TRUE,
                NOW(),
                NOW(),
                v_actor_id,
                v_actor_id
            )
            RETURNING id INTO v_person_id;
        END IF;

        -- Check existing active equivalent occupancy in database to avoid duplicate writes
        v_existing_occ.id := NULL;
        SELECT * INTO v_existing_occ
        FROM public.occupancies
        WHERE unit_id = v_unit_id
          AND person_id = v_person_id
          AND occupancy_type = v_type
          AND status = 'ACTIVE'
          AND deleted_at IS NULL;

        IF v_existing_occ.id IS NULL THEN
            -- Create new occupancy record
            INSERT INTO public.occupancies (
                unit_id,
                person_id,
                occupancy_type,
                start_date,
                end_date,
                status,
                remarks,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            )
            VALUES (
                v_unit_id,
                v_person_id,
                v_type,
                v_move_in,
                v_move_out,
                'ACTIVE',
                NULLIF(v_note, ''),
                TRUE,
                NOW(),
                NOW(),
                v_actor_id,
                v_actor_id
            )
            RETURNING id INTO v_new_occ_id;

            v_occupancies_created := v_occupancies_created + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Imported successfully',
        'summary', jsonb_build_object(
            'totalRows', v_total_rows,
            'persons_created', v_persons_created,
            'persons_matched', v_persons_matched,
            'occupancies_created', v_occupancies_created,
            'occupancies_updated', v_occupancies_updated
        )
    );
END;
$$;


-- 2. Correct reconcile_all_units_operational_status to run safely in system/cron contexts
-- Replaces unconditional log_entity_change call with IF auth.uid() IS NOT NULL guard.
CREATE OR REPLACE FUNCTION public.reconcile_all_units_operational_status(
    p_property_id UUID DEFAULT NULL
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
    v_unit RECORD;
    v_new_status VARCHAR;
    v_checked_count INT := 0;
    v_changed_count INT := 0;
    v_results JSONB := '[]'::JSONB;
BEGIN
    -- Determine actor
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        SELECT role, property_id INTO v_actor_role, v_actor_property_id
        FROM public.profiles
        WHERE id = v_actor_id;
        
        -- Role check
        IF v_actor_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
            RAISE EXCEPTION 'Forbidden: Actor lacks authorization for reconciliation';
        END IF;
        
        -- Property scope enforcement
        IF v_actor_role = 'property_admin' THEN
            p_property_id := v_actor_property_id;
        END IF;
    ELSE
        -- System/cron context check
        IF CURRENT_USER NOT IN ('postgres', 'service_role') THEN
            RAISE EXCEPTION 'Unauthorized: System role execution required when auth.uid() is null';
        END IF;
    END IF;

    -- Loop all units matching scope
    FOR v_unit IN 
        SELECT id, unit_number, operational_status, property_id 
        FROM public.units
        WHERE deleted_at IS NULL
          AND (p_property_id IS NULL OR property_id = p_property_id)
    LOOP
        v_checked_count := v_checked_count + 1;
        v_new_status := public.derive_unit_operational_status(v_unit.id);
        
        IF v_unit.operational_status IS DISTINCT FROM v_new_status THEN
            -- Update unit
            UPDATE public.units
            SET operational_status = v_new_status,
                updated_at = NOW()
            WHERE id = v_unit.id;
            
            v_changed_count := v_changed_count + 1;
            v_results := v_results || jsonb_build_object(
                'unit_id', v_unit.id,
                'unit_number', v_unit.unit_number,
                'old_status', v_unit.operational_status,
                'new_status', v_new_status
            );
            
            -- Log change
            IF auth.uid() IS NOT NULL THEN
                PERFORM public.log_entity_change(
                    'units',
                    v_unit.id,
                    'EDIT',
                    jsonb_build_object(
                        'operational_status', 
                        jsonb_build_object('from', v_unit.operational_status, 'to', v_new_status),
                        'reconciliation', true
                    ),
                    'Synchronized operational status via temporal reconciliation'
                );
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'checked', v_checked_count,
        'changed', v_changed_count,
        'updates', v_results
    );
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.reconcile_all_units_operational_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_all_units_operational_status(UUID) TO authenticated;
