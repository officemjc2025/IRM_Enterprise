-- =====================================================
-- IRM Enterprise Migration: 030_meter_reading_utility_operations.sql
-- =====================================================

-- 1. Add utility control columns to public.units
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS water_control_status VARCHAR(50) DEFAULT 'NORMAL' NOT NULL CHECK (water_control_status IN ('NORMAL', 'SHUTOFF_REQUESTED', 'SHUT_OFF', 'RECONNECT_REQUESTED', 'RESTRICTED_NO_RECONNECT')),
ADD COLUMN IF NOT EXISTS electricity_control_status VARCHAR(50) DEFAULT 'NORMAL' NOT NULL CHECK (electricity_control_status IN ('NORMAL', 'SHUTOFF_REQUESTED', 'SHUT_OFF', 'RECONNECT_REQUESTED', 'RESTRICTED_NO_RECONNECT'));

-- 2. Create utility_meters table
CREATE TABLE public.utility_meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    utility_type VARCHAR(20) NOT NULL CHECK (utility_type IN ('WATER', 'ELECTRICITY')),
    meter_number VARCHAR(100) NOT NULL,
    meter_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (meter_status IN ('ACTIVE', 'INACTIVE')),
    initial_reading NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (initial_reading >= 0),
    installed_at DATE NOT NULL DEFAULT NOW()::DATE,
    retired_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at column in utility_meters
CREATE TRIGGER tr_utility_meters_updated_at BEFORE UPDATE ON public.utility_meters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unique index ensuring only one active meter per type per unit
CREATE UNIQUE INDEX uq_active_unit_meter ON public.utility_meters (unit_id, utility_type) WHERE meter_status = 'ACTIVE';

-- Enable RLS for utility_meters
ALTER TABLE public.utility_meters ENABLE ROW LEVEL SECURITY;

-- Policies for utility_meters
CREATE POLICY "Allow select utility_meters for authenticated" 
ON public.utility_meters FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow write utility_meters for admins" 
ON public.utility_meters FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('super_admin', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role = 'property_admin' 
      AND p.property_id = utility_meters.property_id
  )
);


-- 3. Create utility_rates table
CREATE TABLE public.utility_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    utility_type VARCHAR(20) NOT NULL CHECK (utility_type IN ('WATER', 'ELECTRICITY')),
    rate_per_unit NUMERIC(10,2) NOT NULL CHECK (rate_per_unit >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Enable RLS for utility_rates
ALTER TABLE public.utility_rates ENABLE ROW LEVEL SECURITY;

-- Policies for utility_rates
CREATE POLICY "Allow select utility_rates for authenticated" 
ON public.utility_rates FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow write utility_rates for admins" 
ON public.utility_rates FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('super_admin', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role = 'property_admin' 
      AND p.property_id = utility_rates.property_id
  )
);

-- Overlap checking trigger function for utility_rates
CREATE OR REPLACE FUNCTION public.check_utility_rate_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.utility_rates
        WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND property_id = NEW.property_id
          AND utility_type = NEW.utility_type
          AND is_active = TRUE
          AND daterange(effective_from, effective_to, '[]') && daterange(NEW.effective_from, NEW.effective_to, '[]')
    ) THEN
        RAISE EXCEPTION 'Ambiguous overlapping active rate range detected for utility type %', NEW.utility_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_utility_rate_overlap
    BEFORE INSERT OR UPDATE ON public.utility_rates
    FOR EACH ROW
    EXECUTE FUNCTION public.check_utility_rate_overlap();


-- 4. Create meter_reading_cycles table
CREATE TABLE public.meter_reading_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    utility_type VARCHAR(20) NOT NULL CHECK (utility_type IN ('WATER', 'ELECTRICITY')),
    cycle_code VARCHAR(50) NOT NULL,
    cycle_name VARCHAR(255) NOT NULL,
    billing_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    reading_start_date DATE NOT NULL,
    reading_due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'IN_PROGRESS', 'REVIEW', 'CLOSED', 'CANCELLED')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at column in meter_reading_cycles
CREATE TRIGGER tr_meter_reading_cycles_updated_at BEFORE UPDATE ON public.meter_reading_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unique constraint ensuring only one active cycle per month/type
CREATE UNIQUE INDEX uq_cycle_active ON public.meter_reading_cycles (property_id, utility_type, billing_month) WHERE status <> 'CANCELLED';

-- Enable RLS for meter_reading_cycles
ALTER TABLE public.meter_reading_cycles ENABLE ROW LEVEL SECURITY;

-- Policies for meter_reading_cycles
CREATE POLICY "Allow select meter_reading_cycles for authenticated" 
ON public.meter_reading_cycles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow write meter_reading_cycles for admins" 
ON public.meter_reading_cycles FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role IN ('super_admin', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND p.role = 'property_admin' 
      AND p.property_id = meter_reading_cycles.property_id
  )
);


-- 5. Create meter_readings table
CREATE TABLE public.meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.meter_reading_cycles(id) ON DELETE CASCADE,
    meter_id UUID NOT NULL REFERENCES public.utility_meters(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    utility_type VARCHAR(20) NOT NULL CHECK (utility_type IN ('WATER', 'ELECTRICITY')),
    previous_reading NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (previous_reading >= 0),
    current_reading NUMERIC(12,2) CHECK (current_reading >= 0),
    usage_units NUMERIC(12,2),
    rate_per_unit_snapshot NUMERIC(10,2),
    calculated_amount NUMERIC(12,2),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'REVIEW', 'APPROVED', 'REJECTED')),
    anomaly_status VARCHAR(30) NOT NULL DEFAULT 'NORMAL' CHECK (anomaly_status IN ('NORMAL', 'HIGH_USAGE', 'ZERO_USAGE', 'TECHNICIAN_FLAGGED', 'METER_SUSPECTED', 'REVIEW_REQUIRED')),
    anomaly_reason TEXT,
    technician_note TEXT,
    manager_note TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    photo_url TEXT,
    linked_stay_charge_period_id UUID REFERENCES public.stay_charge_periods(id) ON DELETE SET NULL,
    sync_status VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (sync_status IN ('NOT_APPLICABLE', 'PENDING_PERIOD', 'SYNCED', 'SYNC_FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cycle_meter UNIQUE (cycle_id, meter_id)
);

-- Trigger for updated_at column in meter_readings
CREATE TRIGGER tr_meter_readings_updated_at BEFORE UPDATE ON public.meter_readings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS for meter_readings
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

-- Policies for meter_readings
CREATE POLICY "Allow select meter_readings for authenticated" 
ON public.meter_readings FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'property_admin' AND p.property_id = meter_readings.property_id)
        OR (p.role = 'technician' AND p.property_id = meter_readings.property_id)
      )
  )
);

CREATE POLICY "Allow write meter_readings for admins_and_techs" 
ON public.meter_readings FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'property_admin' AND p.property_id = meter_readings.property_id)
        OR (p.role = 'technician' AND p.property_id = meter_readings.property_id)
      )
  )
);


-- 6. Create meter_replacement_history table
CREATE TABLE public.meter_replacement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    utility_type VARCHAR(20) NOT NULL CHECK (utility_type IN ('WATER', 'ELECTRICITY')),
    old_meter_id UUID REFERENCES public.utility_meters(id) ON DELETE SET NULL,
    old_meter_number VARCHAR(100),
    final_reading NUMERIC(12,2),
    new_meter_id UUID REFERENCES public.utility_meters(id) ON DELETE SET NULL,
    new_meter_number VARCHAR(100) NOT NULL,
    starting_reading NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (starting_reading >= 0),
    replacement_reason TEXT NOT NULL,
    replaced_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    replaced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for meter_replacement_history
ALTER TABLE public.meter_replacement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select meter_replacement_history for authenticated"
ON public.meter_replacement_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow insert meter_replacement_history for admins"
ON public.meter_replacement_history FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role = 'property_admin' AND p.property_id = meter_replacement_history.property_id)
      )
  )
);


-- 7. Update log_entity_change to support new entities
CREATE OR REPLACE FUNCTION public.log_entity_change(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_action_type VARCHAR,
    p_changed_fields JSONB,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_actor_property_id UUID;
    v_entity_property_id UUID;
    v_assigned_to UUID;
    v_new_id UUID;
BEGIN
    -- 1. Derive actor identity from auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated: Must be logged in to log changes';
    END IF;

    -- 2. Fetch actor profile details
    SELECT role, property_id INTO v_actor_role, v_actor_property_id
    FROM public.profiles
    WHERE id = v_actor_id;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'Profile not found for actor';
    END IF;

    -- 3. Validate supported entity types
    IF p_entity_type NOT IN ('work_orders', 'reservations', 'service_bookings', 'utility_rates', 'meter_reading_cycles', 'meter_readings', 'units') THEN
        RAISE EXCEPTION 'Invalid entity type: %', p_entity_type;
    END IF;

    -- 4. Validate supported action types
    IF p_action_type NOT IN ('CREATE', 'EDIT', 'CANCEL') THEN
        RAISE EXCEPTION 'Invalid action type: %', p_action_type;
    END IF;

    -- 5. Resolve target entity property scope and assignments
    IF p_entity_type = 'work_orders' THEN
        SELECT property_id, assigned_to INTO v_entity_property_id, v_assigned_to
        FROM public.work_orders
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'reservations' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.reservations
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'service_bookings' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.service_bookings
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'utility_rates' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.utility_rates
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'meter_reading_cycles' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.meter_reading_cycles
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'meter_readings' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.meter_readings
        WHERE id = p_entity_id;
    ELSIF p_entity_type = 'units' THEN
        SELECT property_id INTO v_entity_property_id
        FROM public.units
        WHERE id = p_entity_id;
    END IF;

    -- If the entity does not exist, fail-closed
    IF v_entity_property_id IS NULL THEN
        RAISE EXCEPTION 'Target entity not found: % with id %', p_entity_type, p_entity_id;
    END IF;

    -- 6. Enforce Role and Property scoping
    IF v_actor_role IN ('admin', 'super_admin') THEN
        -- Allow admin and super_admin
    ELSIF v_actor_role = 'property_admin' THEN
        IF v_actor_property_id IS NULL THEN
            RAISE EXCEPTION 'Property admin has no assigned property';
        END IF;
        IF v_actor_property_id != v_entity_property_id THEN
            RAISE EXCEPTION 'Cross-property action denied';
        END IF;
    ELSIF v_actor_role = 'technician' THEN
        -- Technicians can log edits for meter readings and work orders assigned
        IF p_entity_type = 'meter_readings' AND p_action_type = 'EDIT' THEN
            -- Allow technician to log edits to meter readings
        ELSIF p_entity_type = 'work_orders' AND p_action_type = 'EDIT' AND v_assigned_to = v_actor_id THEN
            -- Allow technician to log edits to assigned work orders
        ELSE
            RAISE EXCEPTION 'Access denied: Technician not authorized for this entity or action';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unauthorized to log entity changes';
    END IF;

    -- 7. Secure Insertion
    INSERT INTO public.entity_change_history (
        entity_type,
        entity_id,
        action_type,
        changed_fields,
        reason,
        actor_id,
        created_at
    )
    VALUES (
        p_entity_type,
        p_entity_id,
        p_action_type,
        p_changed_fields,
        p_reason,
        v_actor_id,
        NOW()
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;


-- 8. Redefine Allow select entity_change_history policy
DROP POLICY IF EXISTS "Allow select entity_change_history" ON public.entity_change_history;
CREATE POLICY "Allow select entity_change_history"
    ON public.entity_change_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND (
                p.role IN ('admin', 'super_admin')
                OR
                (p.role = 'property_admin' AND p.property_id IS NOT NULL AND (
                    (entity_type = 'work_orders' AND EXISTS (
                        SELECT 1 FROM public.work_orders wo
                        WHERE wo.id = entity_id AND wo.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'reservations' AND EXISTS (
                        SELECT 1 FROM public.reservations r
                        WHERE r.id = entity_id AND r.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'service_bookings' AND EXISTS (
                        SELECT 1 FROM public.service_bookings sb
                        WHERE sb.id = entity_id AND sb.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'utility_rates' AND EXISTS (
                        SELECT 1 FROM public.utility_rates ur
                        WHERE ur.id = entity_id AND ur.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'meter_reading_cycles' AND EXISTS (
                        SELECT 1 FROM public.meter_reading_cycles mrc
                        WHERE mrc.id = entity_id AND mrc.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'meter_readings' AND EXISTS (
                        SELECT 1 FROM public.meter_readings mr
                        WHERE mr.id = entity_id AND mr.property_id = p.property_id
                    ))
                    OR
                    (entity_type = 'units' AND EXISTS (
                        SELECT 1 FROM public.units u
                        WHERE u.id = entity_id AND u.property_id = p.property_id
                    ))
                ))
                OR
                (p.role = 'technician' AND (
                    (entity_type = 'work_orders' AND EXISTS (
                        SELECT 1 FROM public.work_orders wo
                        WHERE wo.id = entity_id AND wo.assigned_to = p.id
                    ))
                    OR
                    (entity_type = 'meter_readings' AND EXISTS (
                        SELECT 1 FROM public.meter_readings mr
                        WHERE mr.id = entity_id AND mr.recorded_by = p.id
                    ))
                ))
              )
        )
    );

-- 9. Storage policies for meter reading photos under 'work-orders' bucket
CREATE POLICY "Allow select meter reading photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-orders'
  AND split_part(name, '/', 1) = 'meters'
);

CREATE POLICY "Allow insert meter reading photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-orders'
  AND split_part(name, '/', 1) = 'meters'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin', 'property_admin', 'technician')
  )
);
