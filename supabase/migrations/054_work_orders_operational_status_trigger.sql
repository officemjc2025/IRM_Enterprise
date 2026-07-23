-- =====================================================
-- IRM Enterprise Migration: 054_work_orders_operational_status_trigger.sql
-- =====================================================

-- 1. Create trigger function to automatically sync unit operational status on work order changes
CREATE OR REPLACE FUNCTION public.sync_work_order_operational_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_unit_id UUID;
    v_previous_op_status VARCHAR;
    v_new_op_status VARCHAR;
BEGIN
    -- Determine which unit to sync
    IF TG_OP = 'DELETE' THEN
        v_unit_id := OLD.unit_id;
    ELSE
        v_unit_id := NEW.unit_id;
    END IF;

    IF v_unit_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- If UPDATE and unit_id has changed, sync the old unit first
    IF TG_OP = 'UPDATE' AND OLD.unit_id IS DISTINCT FROM NEW.unit_id AND OLD.unit_id IS NOT NULL THEN
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
                        'Synchronized unit operational status due to work order update (unit changed)'
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- Sync current/new unit
    SELECT operational_status INTO v_previous_op_status
    FROM public.units
    WHERE id = v_unit_id;

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
                    'Synchronized unit operational status due to work order change'
                );
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Register trigger on public.work_orders
DROP TRIGGER IF EXISTS tr_work_orders_sync_status ON public.work_orders;
CREATE TRIGGER tr_work_orders_sync_status
AFTER INSERT OR UPDATE OR DELETE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.sync_work_order_operational_status();
