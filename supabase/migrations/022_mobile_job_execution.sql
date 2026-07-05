-- =====================================================
-- IRM Enterprise Migration: 022_mobile_job_execution.sql
-- =====================================================

-- Add job execution columns to public.work_orders
ALTER TABLE public.work_orders ADD COLUMN acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.work_orders ADD COLUMN acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN work_performed TEXT;
ALTER TABLE public.work_orders ADD COLUMN additional_work TEXT;
ALTER TABLE public.work_orders ADD COLUMN worker_remark TEXT;
ALTER TABLE public.work_orders ADD COLUMN charge_amount NUMERIC(10, 2) CONSTRAINT chk_charge_amount CHECK (charge_amount >= 0);
ALTER TABLE public.work_orders ADD COLUMN actual_cost NUMERIC(10, 2) CONSTRAINT chk_actual_cost CHECK (actual_cost >= 0);

-- Recreate view for backward compatibility
CREATE OR REPLACE VIEW public.work_order AS SELECT * FROM public.work_orders;

-- Create photo metadata table
CREATE TABLE public.work_order_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    photo_stage VARCHAR(50) NOT NULL,
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_photo_stage CHECK (photo_stage IN ('BEFORE', 'AFTER'))
);

-- Enable Row Level Security
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for work_order_photos
CREATE POLICY "Allow select work_order_photos for authenticated"
    ON public.work_order_photos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert work_order_photos for authenticated"
    ON public.work_order_photos FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Allow delete work_order_photos for authenticated"
    ON public.work_order_photos FOR DELETE
    TO authenticated
    USING (auth.uid() = uploaded_by);

-- Insert storage bucket for work orders
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-orders', 'work-orders', false)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for 'work-orders' bucket
DROP POLICY IF EXISTS "Allow authenticated to select from work-orders bucket" ON storage.objects;
CREATE POLICY "Allow authenticated to select from work-orders bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'work-orders');

DROP POLICY IF EXISTS "Allow authenticated to insert into work-orders bucket" ON storage.objects;
CREATE POLICY "Allow authenticated to insert into work-orders bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'work-orders' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated to delete from work-orders bucket" ON storage.objects;
CREATE POLICY "Allow authenticated to delete from work-orders bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'work-orders');
