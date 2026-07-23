-- =====================================================
-- IRM Enterprise Migration: 053_reservation_stay_workflow.sql
-- =====================================================

-- 1. ADD stay_id AND occupancy_id TO public.work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS stay_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occupancy_id UUID REFERENCES public.occupancies(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.work_orders.stay_id IS 'Associated stay/reservation session driving this work order';
COMMENT ON COLUMN public.work_orders.occupancy_id IS 'Associated resident assignment or owner/tenant occupancy';

-- 2. WIDEN service_team CHECK CONSTRAINT TO INCLUDE INSPECTION_TEAM AND SUPERVISOR
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS chk_work_order_service_team;
ALTER TABLE public.work_orders ADD CONSTRAINT chk_work_order_service_team CHECK (
  service_team IN ('TECHNICIAN', 'HOUSEKEEPING', 'INSPECTION_TEAM', 'SUPERVISOR')
);

-- 3. RECREATE VIEW FOR BACKWARD COMPATIBILITY
CREATE OR REPLACE VIEW public.work_order AS SELECT * FROM public.work_orders;

-- 4. Centralized Status Derivation Function Supporting CLEANING & INSPECTION Categories
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
    v_has_active_cleaning_lock BOOLEAN;
    v_has_active_inspection_lock BOOLEAN;
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

    -- 3. MAINTENANCE (active maintenance work order lock, excluding cleaning and inspection)
    SELECT EXISTS (
        SELECT 1 FROM public.work_orders
        WHERE unit_id = p_unit_id
          AND affects_operational_status = TRUE
          AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')
          AND category NOT IN ('CLEANING', 'INSPECTION')
          AND deleted_at IS NULL
    ) INTO v_has_active_maintenance_lock;

    IF v_has_active_maintenance_lock THEN
        RETURN 'MAINTENANCE';
    END IF;

    -- 4. CLEANING (active cleaning work order lock)
    SELECT EXISTS (
        SELECT 1 FROM public.work_orders
        WHERE unit_id = p_unit_id
          AND affects_operational_status = TRUE
          AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')
          AND category = 'CLEANING'
          AND deleted_at IS NULL
    ) INTO v_has_active_cleaning_lock;

    IF v_has_active_cleaning_lock THEN
        RETURN 'CLEANING';
    END IF;

    -- 5. INSPECTION (active inspection work order lock)
    SELECT EXISTS (
        SELECT 1 FROM public.work_orders
        WHERE unit_id = p_unit_id
          AND affects_operational_status = TRUE
          AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')
          AND category = 'INSPECTION'
          AND deleted_at IS NULL
    ) INTO v_has_active_inspection_lock;

    IF v_has_active_inspection_lock THEN
        RETURN 'INSPECTION';
    END IF;

    -- 6. CHECKED_IN
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CHECKED_IN'
          AND check_in_at <= NOW() AND check_out_at >= NOW()
    ) INTO v_has_checked_in;

    IF v_has_checked_in THEN
        RETURN 'CHECKED_IN';
    END IF;

    -- 7. CHECKING_IN (arrival today)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CONFIRMED'
          AND check_in_at::DATE = CURRENT_DATE
    ) INTO v_has_checking_in;

    IF v_has_checking_in THEN
        RETURN 'CHECKING_IN';
    END IF;

    -- 8. CHECKING_OUT (departure today)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CHECKED_IN'
          AND check_out_at::DATE = CURRENT_DATE
    ) INTO v_has_checking_out;

    IF v_has_checking_out THEN
        RETURN 'CHECKING_OUT';
    END IF;

    -- 9. RESERVED (confirmed upcoming stay)
    SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE unit_id = p_unit_id
          AND status = 'CONFIRMED'
          AND check_in_at > NOW()
    ) INTO v_has_reserved;

    IF v_has_reserved THEN
        RETURN 'RESERVED';
    END IF;

    -- 10. TENANT_OCCUPIED
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

    -- 11. OWNER_OCCUPIED
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

    -- 12. STAFF
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

    -- 13. MJC
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

    -- 14. VACANT (fallback)
    RETURN 'VACANT';
END;
$$;
