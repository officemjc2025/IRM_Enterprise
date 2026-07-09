-- =====================================================
-- IRM Enterprise Migration: 037_meter_identity_foundation.sql
-- =====================================================

-- 1. Add manufacturer_serial_number column (nullable) to utility_meters
ALTER TABLE public.utility_meters 
ADD COLUMN IF NOT EXISTS manufacturer_serial_number VARCHAR(100);

-- 2. Add installation_date_known column to utility_meters
ALTER TABLE public.utility_meters 
ADD COLUMN IF NOT EXISTS installation_date_known BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Make installed_at nullable in utility_meters
ALTER TABLE public.utility_meters 
ALTER COLUMN installed_at DROP NOT NULL,
ALTER COLUMN installed_at DROP DEFAULT;

-- 4. Update check constraint on meter_status in utility_meters to allow 'RETIRED'
ALTER TABLE public.utility_meters 
DROP CONSTRAINT IF EXISTS utility_meters_meter_status_check;

ALTER TABLE public.utility_meters 
ADD CONSTRAINT utility_meters_meter_status_check 
CHECK (meter_status IN ('ACTIVE', 'INACTIVE', 'RETIRED'));

-- 5. Add unique constraint on meter_number (Internal Meter Code)
ALTER TABLE public.utility_meters
ADD CONSTRAINT uq_utility_meters_meter_number UNIQUE (meter_number);

-- 6. Add unique index on manufacturer_serial_number when not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_utility_meters_serial 
ON public.utility_meters (manufacturer_serial_number) 
WHERE manufacturer_serial_number IS NOT NULL;

-- 7. Add atomic replacement helper function
CREATE OR REPLACE FUNCTION public.replace_utility_meter(
    p_old_meter_id UUID,
    p_new_internal_code VARCHAR,
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
AS $$
DECLARE
    v_old_meter RECORD;
    v_new_meter_id UUID;
    v_unit_number VARCHAR;
BEGIN
    -- 1. Fetch old meter and lock it
    SELECT * INTO v_old_meter
    FROM public.utility_meters
    WHERE id = p_old_meter_id
    FOR UPDATE;

    IF v_old_meter IS NULL THEN
        RAISE EXCEPTION 'Old meter not found';
    END IF;

    IF v_old_meter.meter_status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Old meter is not active';
    END IF;

    -- 2. Fetch unit number
    SELECT unit_number INTO v_unit_number
    FROM public.units
    WHERE id = v_old_meter.unit_id;

    -- 3. Check duplicate manufacturer serial number if provided
    IF p_manufacturer_serial_number IS NOT NULL AND TRIM(p_manufacturer_serial_number) != '' THEN
        IF EXISTS (
            SELECT 1 FROM public.utility_meters
            WHERE manufacturer_serial_number = TRIM(p_manufacturer_serial_number)
        ) THEN
            RAISE EXCEPTION 'Manufacturer serial number % is already registered', p_manufacturer_serial_number;
        END IF;
    END IF;

    -- 4. Retire old meter
    UPDATE public.utility_meters
    SET meter_status = 'RETIRED',
        retired_at = p_replacement_date,
        updated_at = NOW()
    WHERE id = p_old_meter_id;

    -- 5. Insert new meter
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
        p_new_internal_code,
        NULLIF(TRIM(p_manufacturer_serial_number), ''),
        p_replacement_date,
        TRUE,
        'ACTIVE',
        p_starting_reading,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_meter_id;

    -- 6. Insert replacement history record
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
        p_new_internal_code,
        p_starting_reading,
        p_replacement_reason,
        p_actor_id,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'old_meter_id', p_old_meter_id,
        'new_meter_id', v_new_meter_id,
        'new_internal_code', p_new_internal_code
    );
END;
$$;


