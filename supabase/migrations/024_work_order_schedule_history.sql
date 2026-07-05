-- =====================================================
-- IRM Enterprise Migration: 024_work_order_schedule_history.sql
-- =====================================================

-- Create schedule change requests & history table
CREATE TABLE public.work_order_schedule_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    old_scheduled_at TIMESTAMPTZ,
    requested_scheduled_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CONSTRAINT chk_schedule_change_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_remark TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index to enforce "One Active Request Rule" at database level
CREATE UNIQUE INDEX idx_work_order_pending_schedule_change 
ON public.work_order_schedule_changes (work_order_id) 
WHERE status = 'PENDING';

-- Trigger to auto-update updated_at column
DROP TRIGGER IF EXISTS tr_work_order_schedule_changes_updated_at ON public.work_order_schedule_changes CASCADE;
CREATE TRIGGER tr_work_order_schedule_changes_updated_at 
    BEFORE UPDATE ON public.work_order_schedule_changes 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.work_order_schedule_changes ENABLE ROW LEVEL SECURITY;

-- SELECT policy: admin/super_admin see all; property_admin is property scoped; technician/housekeeping are assigned scoped
CREATE POLICY "Harden select work_order_schedule_changes"
ON public.work_order_schedule_changes FOR SELECT
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
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.property_id = p.property_id
          )
        )
        OR (
          p.role = 'technician'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

-- INSERT policy: worker can request for their assigned job; property_admin scoped; admin/super_admin globally allowed
CREATE POLICY "Harden insert work_order_schedule_changes"
ON public.work_order_schedule_changes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requested_by
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin')
        OR (
          p.role = 'property_admin'
          AND p.property_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.property_id = p.property_id
          )
        )
        OR (
          p.role = 'technician'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

-- UPDATE policy: admins only, property scoped for property_admin
CREATE POLICY "Harden update work_order_schedule_changes"
ON public.work_order_schedule_changes FOR UPDATE
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
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_schedule_changes.work_order_id
              AND wo.property_id = p.property_id
          )
        )
      )
  )
);


-- =====================================================
-- SECURITY DEFINER Atomic RPC Functions
-- =====================================================

-- A. Approve Schedule Change
CREATE OR REPLACE FUNCTION public.approve_work_order_schedule_change(
    p_work_order_id UUID,
    p_change_id UUID,
    p_review_remark TEXT
)
RETURNS public.work_order_schedule_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_property_id UUID;
    v_order public.work_orders%ROWTYPE;
    v_change public.work_order_schedule_changes%ROWTYPE;
BEGIN
    -- 1. Authentication & Role resolution
    SELECT role, property_id INTO v_role, v_property_id FROM public.profiles WHERE id = auth.uid();
    IF v_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Lock target schedule request (verify PENDING)
    SELECT * INTO v_change FROM public.work_order_schedule_changes
    WHERE id = p_change_id AND work_order_id = p_work_order_id AND status = 'PENDING'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule change request not found or not pending';
    END IF;

    -- 3. Lock associated work order
    SELECT * INTO v_order FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    -- 4. Property Admin Fail-Closed Scoping Check
    IF v_role = 'property_admin' THEN
        IF v_property_id IS NULL OR v_property_id <> v_order.property_id THEN
            RAISE EXCEPTION 'Unauthorized: property_admin must match work order property';
        END IF;
    END IF;

    -- 5. Stale request check: verify current scheduled_at still equals the baseline old_scheduled_at
    IF v_order.scheduled_at IS DISTINCT FROM v_change.old_scheduled_at THEN
        -- Mark stale request REJECTED in database deterministically without transaction rollback
        UPDATE public.work_order_schedule_changes
        SET status = 'REJECTED',
            reviewed_by = auth.uid(),
            reviewed_at = NOW(),
            review_remark = 'Stale request: Current schedule differs from request baseline',
            updated_at = NOW()
        WHERE id = p_change_id
        RETURNING * INTO v_change;
        
        RETURN v_change;
    END IF;

    -- 6. Perform Updates
    UPDATE public.work_orders
    SET scheduled_at = v_change.requested_scheduled_at,
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE id = p_work_order_id;

    UPDATE public.work_order_schedule_changes
    SET status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_remark = p_review_remark,
        updated_at = NOW()
    WHERE id = p_change_id
    RETURNING * INTO v_change;

    RETURN v_change;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_work_order_schedule_change FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_work_order_schedule_change TO authenticated;


-- B. Admin Direct Reschedule
CREATE OR REPLACE FUNCTION public.admin_direct_reschedule_work_order(
    p_work_order_id UUID,
    p_requested_scheduled_at TIMESTAMPTZ,
    p_reason TEXT
)
RETURNS public.work_order_schedule_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_property_id UUID;
    v_order public.work_orders%ROWTYPE;
    v_history public.work_order_schedule_changes%ROWTYPE;
BEGIN
    -- 1. Authentication & Role resolution
    SELECT role, property_id INTO v_role, v_property_id FROM public.profiles WHERE id = auth.uid();
    IF v_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Lock Work Order
    SELECT * INTO v_order FROM public.work_orders
    WHERE id = p_work_order_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    -- 3. Property Admin Fail-Closed Scoping Check
    IF v_role = 'property_admin' THEN
        IF v_property_id IS NULL OR v_property_id <> v_order.property_id THEN
            RAISE EXCEPTION 'Unauthorized: property_admin must match work order property';
        END IF;
    END IF;

    -- 4. Check different schedule
    IF v_order.scheduled_at IS NOT DISTINCT FROM p_requested_scheduled_at THEN
        RAISE EXCEPTION 'New schedule must differ from current schedule';
    END IF;

    -- 5. Perform direct update
    UPDATE public.work_orders
    SET scheduled_at = p_requested_scheduled_at,
        updated_at = NOW(),
        updated_by = auth.uid()
    WHERE id = p_work_order_id;

    -- 6. Insert approved history record
    INSERT INTO public.work_order_schedule_changes (
        work_order_id,
        old_scheduled_at,
        requested_scheduled_at,
        reason,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        review_remark
    )
    VALUES (
        p_work_order_id,
        v_order.scheduled_at,
        p_requested_scheduled_at,
        p_reason,
        'APPROVED',
        auth.uid(),
        NOW(),
        auth.uid(),
        NOW(),
        'Direct admin schedule update'
    )
    RETURNING * INTO v_history;

    RETURN v_history;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_direct_reschedule_work_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_direct_reschedule_work_order TO authenticated;


-- C. Reject Schedule Change
CREATE OR REPLACE FUNCTION public.reject_work_order_schedule_change(
    p_work_order_id UUID,
    p_change_id UUID,
    p_review_remark TEXT
)
RETURNS public.work_order_schedule_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_property_id UUID;
    v_order public.work_orders%ROWTYPE;
    v_change public.work_order_schedule_changes%ROWTYPE;
BEGIN
    -- 1. Authentication & Role resolution
    SELECT role, property_id INTO v_role, v_property_id FROM public.profiles WHERE id = auth.uid();
    IF v_role NOT IN ('super_admin', 'admin', 'property_admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- 2. Lock associated work order
    SELECT * INTO v_order FROM public.work_orders
    WHERE id = p_work_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    -- 3. Property Admin Fail-Closed Scoping Check
    IF v_role = 'property_admin' THEN
        IF v_property_id IS NULL OR v_property_id <> v_order.property_id THEN
            RAISE EXCEPTION 'Unauthorized: property_admin must match work order property';
        END IF;
    END IF;

    -- 4. Lock request (verify PENDING)
    SELECT * INTO v_change FROM public.work_order_schedule_changes
    WHERE id = p_change_id AND work_order_id = p_work_order_id AND status = 'PENDING'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule change request not found or not pending';
    END IF;

    -- 5. Update request status to REJECTED
    UPDATE public.work_order_schedule_changes
    SET status = 'REJECTED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_remark = p_review_remark,
        updated_at = NOW()
    WHERE id = p_change_id
    RETURNING * INTO v_change;

    RETURN v_change;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_work_order_schedule_change FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_work_order_schedule_change TO authenticated;


-- D. Worker Cancel Request
CREATE OR REPLACE FUNCTION public.cancel_work_order_schedule_change(
    p_work_order_id UUID,
    p_change_id UUID
)
RETURNS public.work_order_schedule_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT;
    v_property_id UUID;
    v_change public.work_order_schedule_changes%ROWTYPE;
    v_order public.work_orders%ROWTYPE;
BEGIN
    -- 1. Authentication & Role resolution
    SELECT role, property_id INTO v_role, v_property_id FROM public.profiles WHERE id = auth.uid();

    -- 2. Lock request (verify PENDING)
    SELECT * INTO v_change FROM public.work_order_schedule_changes
    WHERE id = p_change_id AND work_order_id = p_work_order_id AND status = 'PENDING'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule change request not found or not pending';
    END IF;

    -- 3. Lock associated work order
    SELECT * INTO v_order FROM public.work_orders
    WHERE id = p_work_order_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Work order not found';
    END IF;

    -- 4. Authorization & Scoping check
    IF v_role IN ('super_admin', 'admin') THEN
        -- Allowed globally
    ELSIF v_role = 'property_admin' THEN
        -- Property Admin Scoping Check
        IF v_property_id IS NULL OR v_property_id <> v_order.property_id THEN
            RAISE EXCEPTION 'Unauthorized: property_admin must match work order property';
        END IF;
    ELSE
        -- Worker Flow
        IF v_role = 'technician' THEN
            IF v_change.requested_by <> auth.uid() OR v_order.assigned_to <> auth.uid() OR v_order.service_team <> 'TECHNICIAN' THEN
                RAISE EXCEPTION 'Unauthorized';
            END IF;
        ELSIF v_role = 'housekeeping' THEN
            IF v_change.requested_by <> auth.uid() OR v_order.assigned_to <> auth.uid() OR v_order.service_team <> 'HOUSEKEEPING' THEN
                RAISE EXCEPTION 'Unauthorized';
            END IF;
        ELSE
            RAISE EXCEPTION 'Unauthorized';
        END IF;
    END IF;

    -- 5. Cancel request
    UPDATE public.work_order_schedule_changes
    SET status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = p_change_id
    RETURNING * INTO v_change;

    RETURN v_change;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_work_order_schedule_change FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_work_order_schedule_change TO authenticated;
