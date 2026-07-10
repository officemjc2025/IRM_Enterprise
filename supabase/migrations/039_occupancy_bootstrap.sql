-- =====================================================
-- IRM Enterprise Migration: 039_occupancy_bootstrap.sql
-- =====================================================

-- 0.0. CANONICAL PHONE NORMALIZATION
-- -------------------------------------------------------
-- Normalizes phone numbers for matching purposes.
-- - Strips all non-digit characters.
-- - For Thailand numbers, translates country code +66 or 66 to leading 0.
-- - Prepend 0 if length is 9 digits (mobile without leading zero).
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_digits text;
BEGIN
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RETURN NULL;
    END IF;
    -- Strip all non-digit characters
    v_digits := regexp_replace(p_phone, '\D', '', 'g');
    
    -- If starts with 66 and is 11 digits (typical Thai format +66 8x xxx xxxx)
    IF v_digits LIKE '66%' AND length(v_digits) = 11 THEN
        v_digits := '0' || substring(v_digits from 3);
    -- If starts with 66 and is 10 digits (fixed line e.g. +66 2xx xxxx)
    ELSIF v_digits LIKE '66%' AND length(v_digits) = 10 THEN
        v_digits := '0' || substring(v_digits from 3);
    -- If starts with 8 or 9 (no leading 0) and is 9 digits, prepend 0
    ELSIF length(v_digits) = 9 AND (v_digits LIKE '8%' OR v_digits LIKE '9%' OR v_digits LIKE '6%') THEN
        v_digits := '0' || v_digits;
    END IF;
    
    RETURN v_digits;
END;
$$;


-- 0.1. TEMPORAL OCCUPANCY RECONCILIATION FUNCTION
-- -------------------------------------------------------
-- Idempotent reconciliation function to adjust unit operational status
-- when dates pass without database mutations.
-- -------------------------------------------------------
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


-- 0. CORRECTED derive_unit_operational_status
-- -------------------------------------------------------
-- Fixes defect from migration 034:
--   FAMILY_MEMBER active occupancy → was mapping to VACANT (WRONG)
--   RESIDENT active occupancy      → was mapping to VACANT (WRONG)
-- 
-- Canonical interim mapping (IRM-039):
--   OWNER       → OWNER_OCCUPIED
--   CO_OWNER    → OWNER_OCCUPIED
--   FAMILY_MEMBER → OWNER_OCCUPIED  ← FIXED
--   RESIDENT    → OWNER_OCCUPIED    ← FIXED
--   TENANT      → TENANT_OCCUPIED   (highest precedence among occupancy types)
--   STAFF       → STAFF
--   COMPANY     → MJC
--
-- Precedence rules (high → low, evaluated by SELECT EXISTS):
--   OUT_OF_SERVICE > LOCKED > MAINTENANCE > CHECKED_IN > CHECKING_IN >
--   CHECKING_OUT > RESERVED > TENANT_OCCUPIED > OWNER_OCCUPIED > STAFF > MJC > VACANT
--
-- Multi-occupant precedence:
--   TENANT + any    → TENANT_OCCUPIED
--   OWNER|CO_OWNER|FAMILY_MEMBER|RESIDENT + STAFF → OWNER_OCCUPIED
--   COMPANY + OWNER → OWNER_OCCUPIED (owner takes precedence over company)
--   COMPANY + TENANT → TENANT_OCCUPIED
--   STAFF + TENANT → TENANT_OCCUPIED
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
    IF v_unit_status = 'INACTIVE' OR v_current_op_status = 'OUT_OF_SERVICE' THEN
        RETURN 'OUT_OF_SERVICE';
    END IF;

    -- 2. LOCKED (preserve manual lock)
    IF v_current_op_status = 'LOCKED' THEN
        RETURN 'LOCKED';
    END IF;

    -- 3. MAINTENANCE (active work order lock)
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

    -- 8. TENANT_OCCUPIED (highest occupancy precedence)
    -- Canonical active date rule: start_date <= CURRENT_DATE AND (end_date IS NULL OR end_date >= CURRENT_DATE)
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
    -- Includes: OWNER, CO_OWNER, FAMILY_MEMBER, RESIDENT
    -- FAMILY_MEMBER and RESIDENT are household members of the owner — unit is occupied, not vacant.
    SELECT EXISTS (
        SELECT 1 FROM public.occupancies
        WHERE unit_id = p_unit_id
          AND occupancy_type IN ('OWNER', 'CO_OWNER', 'FAMILY_MEMBER', 'RESIDENT')
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

    -- 12. VACANT (fallback — no active occupancy or lifecycle state)
    RETURN 'VACANT';
END;
$$;

-- 1. Unique Index to Enforce One Active Occupancy Per Person and Unit (Overlap Guard)
DROP INDEX IF EXISTS public.uq_active_person_unit_occupancy;
CREATE UNIQUE INDEX uq_active_person_unit_occupancy 
ON public.occupancies(person_id, unit_id) 
WHERE (status = 'ACTIVE' AND deleted_at IS NULL);

-- 2. Trigger Function to Validate, Authorize, and Audit Occupancy Mutations
CREATE OR REPLACE FUNCTION public.tr_audit_and_authorize_occupancy()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_unit_id UUID;
    v_unit_property_id UUID;
    v_unit_number VARCHAR;
    v_person_name VARCHAR;
BEGIN
    -- Determine target unit_id
    IF TG_OP = 'DELETE' THEN
        v_unit_id := OLD.unit_id;
    ELSE
        v_unit_id := NEW.unit_id;
    END IF;

    -- Fetch unit details
    SELECT property_id, unit_number INTO v_unit_property_id, v_unit_number
    FROM public.units
    WHERE id = v_unit_id;

    -- Resolve authoritative actor from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        -- Allow system role / migrations / seeds without auth.uid()
        IF CURRENT_USER IN ('postgres', 'service_role') THEN
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            ELSE
                RETURN NEW;
            END IF;
        ELSE
            RAISE EXCEPTION 'Unauthorized: auth.uid() is null';
        END IF;
    END IF;

    -- Fetch actor profile details
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Forbidden: Profile not found for actor';
    END IF;

    -- Role Check: Only super_admin, admin, and property_admin are permitted
    IF v_actor_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Actor lacks authorization to manage occupancies';
    END IF;

    -- Property Scope Check: property_admin must match the unit property_id
    IF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR v_unit_property_id != v_actor_property_id THEN
            RAISE EXCEPTION 'Forbidden: Cross-property action is denied';
        END IF;
    END IF;

    -- Write Audit Log to entity_change_history for each write operation
    IF TG_OP = 'DELETE' THEN
        SELECT first_name || ' ' || COALESCE(last_name, '') INTO v_person_name
        FROM public.persons WHERE id = OLD.person_id;

        PERFORM public.log_entity_change(
            'units',
            v_unit_id,
            'EDIT',
            jsonb_build_object(
                'action', 'OCCUPANCY_DELETE',
                'occupancy_id', OLD.id,
                'person_id', OLD.person_id,
                'person_name', v_person_name,
                'occupancy_type', OLD.occupancy_type
            ),
            'Archived/deleted ' || OLD.occupancy_type || ' occupancy of ' || v_person_name
        );
    ELSIF TG_OP = 'INSERT' THEN
        SELECT first_name || ' ' || COALESCE(last_name, '') INTO v_person_name
        FROM public.persons WHERE id = NEW.person_id;

        PERFORM public.log_entity_change(
            'units',
            v_unit_id,
            'EDIT',
            jsonb_build_object(
                'action', 'OCCUPANCY_CREATE',
                'occupancy_id', NEW.id,
                'person_id', NEW.person_id,
                'person_name', v_person_name,
                'occupancy_type', NEW.occupancy_type,
                'start_date', NEW.start_date,
                'end_date', NEW.end_date
            ),
            'Created ' || NEW.occupancy_type || ' occupancy for ' || v_person_name
        );
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT first_name || ' ' || COALESCE(last_name, '') INTO v_person_name
        FROM public.persons WHERE id = NEW.person_id;

        IF OLD.unit_id IS DISTINCT FROM NEW.unit_id OR
           OLD.person_id IS DISTINCT FROM NEW.person_id OR
           OLD.occupancy_type IS DISTINCT FROM NEW.occupancy_type OR
           OLD.start_date IS DISTINCT FROM NEW.start_date OR
           OLD.end_date IS DISTINCT FROM NEW.end_date OR
           OLD.status IS DISTINCT FROM NEW.status OR
           OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN

            PERFORM public.log_entity_change(
                'units',
                v_unit_id,
                'EDIT',
                jsonb_build_object(
                    'action', 'OCCUPANCY_UPDATE',
                    'occupancy_id', NEW.id,
                    'person_id', NEW.person_id,
                    'person_name', v_person_name,
                    'old_occupancy_type', OLD.occupancy_type,
                    'new_occupancy_type', NEW.occupancy_type,
                    'old_start_date', OLD.start_date,
                    'new_start_date', NEW.start_date,
                    'old_end_date', OLD.end_date,
                    'new_end_date', NEW.end_date,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'old_deleted_at', OLD.deleted_at,
                    'new_deleted_at', NEW.deleted_at
                ),
                'Updated occupancy for ' || v_person_name
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Register BEFORE trigger
DROP TRIGGER IF EXISTS tr_occupancies_auth_and_audit ON public.occupancies;
CREATE TRIGGER tr_occupancies_auth_and_audit
BEFORE INSERT OR UPDATE OR DELETE ON public.occupancies
FOR EACH ROW
EXECUTE FUNCTION public.tr_audit_and_authorize_occupancy();


-- 3. Trigger Function to Automatically Synchronize Unit Operational Status on Occupancy Changes
CREATE OR REPLACE FUNCTION public.tr_sync_unit_operational_status()
RETURNS TRIGGER AS $$
DECLARE
    v_unit_id UUID;
    v_new_op_status VARCHAR;
    v_previous_op_status VARCHAR;
BEGIN
    -- Determine target unit_id
    IF TG_OP = 'DELETE' THEN
        v_unit_id := OLD.unit_id;
    ELSE
        v_unit_id := NEW.unit_id;
    END IF;

    -- Fetch current operational status of the unit
    SELECT operational_status INTO v_previous_op_status
    FROM public.units
    WHERE id = v_unit_id;

    -- Derive new status using centralized strategy
    v_new_op_status := public.derive_unit_operational_status(v_unit_id);

    -- Update unit table if status changed
    IF v_previous_op_status IS DISTINCT FROM v_new_op_status THEN
        UPDATE public.units
        SET operational_status = v_new_op_status,
            updated_at = NOW()
        WHERE id = v_unit_id;

        -- Write audit log to entity_change_history if actor is authenticated
        IF auth.uid() IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
                PERFORM public.log_entity_change(
                    'units',
                    v_unit_id,
                    'EDIT',
                    jsonb_build_object(
                        'operational_status', 
                        jsonb_build_object('from', v_previous_op_status, 'to', v_new_op_status)
                    ),
                    'Synchronized unit operational status due to occupancy change'
                );
            END IF;
        END IF;
    END IF;

    -- Handle unit transition case (e.g. moving resident from one unit to another)
    IF TG_OP = 'UPDATE' AND OLD.unit_id IS DISTINCT FROM NEW.unit_id THEN
        SELECT operational_status INTO v_previous_op_status
        FROM public.units
        WHERE id = OLD.unit_id;

        v_new_op_status := public.derive_unit_operational_status(OLD.unit_id);

        IF v_previous_op_status IS DISTINCT FROM v_new_op_status THEN
            UPDATE public.units
            SET operational_status = v_new_op_status,
                updated_at = NOW()
            WHERE id = OLD.unit_id;

            IF auth.uid() IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN
                    PERFORM public.log_entity_change(
                        'units',
                        OLD.unit_id,
                        'EDIT',
                        jsonb_build_object(
                            'operational_status', 
                            jsonb_build_object('from', v_previous_op_status, 'to', v_new_op_status)
                        ),
                        'Synchronized unit operational status due to occupancy update (unit changed)'
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Create Trigger on public.occupancies
DROP TRIGGER IF EXISTS tr_occupancies_sync_status ON public.occupancies;
CREATE TRIGGER tr_occupancies_sync_status
AFTER INSERT OR UPDATE OR DELETE ON public.occupancies
FOR EACH ROW
EXECUTE FUNCTION public.tr_sync_unit_operational_status();


-- 4. Database RPC Function to Perform Transactional Resident Occupancy Import
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
        IF v_workbook_duplicates @> ARRAY[v_duplicate_check_key] THEN
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

-- Grant execution permissions on RPC
REVOKE ALL ON FUNCTION public.import_occupancies(JSONB, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_occupancies(JSONB, UUID, BOOLEAN) TO authenticated;


-- 5. Database RPC Function to Perform Atomic Move Resident Transaction
CREATE OR REPLACE FUNCTION public.move_occupancy(
    p_occupancy_id UUID,
    p_new_unit_id UUID,
    p_move_date DATE,
    p_remarks TEXT
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
    v_old_occ RECORD;
    v_new_occ_id UUID;
    v_old_unit_property_id UUID;
    v_new_unit_property_id UUID;
BEGIN
    -- 1. Authoritative actor from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: auth.uid() is null';
    END IF;

    -- 2. Fetch actor profile
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    -- 3. Role Authorization check
    IF v_actor_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Forbidden: Actor lacks authorization to manage occupancies';
    END IF;

    -- 4. Fetch old occupancy details
    SELECT o.*, u.property_id INTO v_old_occ
    FROM public.occupancies o
    JOIN public.units u ON u.id = o.unit_id
    WHERE o.id = p_occupancy_id
      AND o.status = 'ACTIVE'
      AND o.deleted_at IS NULL;

    IF v_old_occ.id IS NULL THEN
        RAISE EXCEPTION 'Active occupancy record not found';
    END IF;

    -- Fetch new unit details
    SELECT property_id INTO v_new_unit_property_id
    FROM public.units
    WHERE id = p_new_unit_id;

    IF v_new_unit_property_id IS NULL THEN
        RAISE EXCEPTION 'Target unit not found';
    END IF;

    -- 5. Cross-Property Scope enforcement
    IF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL OR 
           v_old_occ.property_id != v_actor_property_id OR 
           v_new_unit_property_id != v_actor_property_id THEN
            RAISE EXCEPTION 'Forbidden: Cross-property action is denied';
        END IF;
    END IF;

    -- 6. End old occupancy (this automatically triggers operational status derivation)
    UPDATE public.occupancies
    SET end_date = p_move_date,
        status = 'INACTIVE',
        remarks = TRIM(COALESCE(remarks || E'\n' || p_remarks, p_remarks)),
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE id = p_occupancy_id;

    -- 7. Create new occupancy (this automatically triggers operational status derivation)
    INSERT INTO public.occupancies (
        unit_id,
        person_id,
        occupancy_type,
        start_date,
        status,
        remarks,
        created_by,
        updated_by
    )
    VALUES (
        p_new_unit_id,
        v_old_occ.person_id,
        v_old_occ.occupancy_type,
        p_move_date + 1, -- Starts next day after move out
        'ACTIVE',
        p_remarks,
        v_actor_id,
        v_actor_id
    )
    RETURNING id INTO v_new_occ_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Resident moved successfully',
        'old_occupancy_id', p_occupancy_id,
        'new_occupancy_id', v_new_occ_id
    );
END;
$$;

-- Grant execution permissions on Move RPC
REVOKE ALL ON FUNCTION public.move_occupancy(UUID, UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_occupancy(UUID, UUID, DATE, TEXT) TO authenticated;
