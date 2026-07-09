-- Migration 031: Wastewater Treatment Rate and Reading Recheck Attempts support
-- Add treatment_rate_per_unit to utility_rates
ALTER TABLE public.utility_rates ADD COLUMN treatment_rate_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (treatment_rate_per_unit >= 0);

-- Add recheck fields and treatment snapshots/amounts to meter_readings
ALTER TABLE public.meter_readings ADD COLUMN treatment_rate_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (treatment_rate_snapshot >= 0);
ALTER TABLE public.meter_readings ADD COLUMN treatment_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (treatment_amount >= 0);
ALTER TABLE public.meter_readings ADD COLUMN recheck_requested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.meter_readings ADD COLUMN recheck_reason TEXT;

-- Create meter_reading_attempts table for recheck history
CREATE TABLE public.meter_reading_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_reading_id UUID NOT NULL REFERENCES public.meter_readings(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    reading_value NUMERIC(12,2) NOT NULL CHECK (reading_value >= 0),
    photo_url TEXT,
    technician_note TEXT,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recheck_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for meter_reading_attempts
ALTER TABLE public.meter_reading_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for meter_reading_attempts
CREATE POLICY "Allow select attempts for property scope"
ON public.meter_reading_attempts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meter_readings mr
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE mr.id = meter_reading_attempts.meter_reading_id
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role IN ('property_admin', 'technician') AND p.property_id = mr.property_id)
      )
  )
);

CREATE POLICY "Allow insert attempts for technicians and admins"
ON public.meter_reading_attempts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meter_readings mr
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE mr.id = meter_reading_attempts.meter_reading_id
      AND (
        p.role IN ('super_admin', 'admin')
        OR (p.role IN ('property_admin', 'technician') AND p.property_id = mr.property_id)
      )
  )
);
