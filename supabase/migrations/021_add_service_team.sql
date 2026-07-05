-- =====================================================
-- IRM Enterprise Migration: 021_add_service_team.sql
-- =====================================================

-- Add service_team column to public.work_orders with check constraint
ALTER TABLE public.work_orders ADD COLUMN service_team VARCHAR(50) NOT NULL DEFAULT 'TECHNICIAN';

ALTER TABLE public.work_orders ADD CONSTRAINT chk_work_order_service_team CHECK (service_team IN ('TECHNICIAN', 'HOUSEKEEPING'));

-- Recreate view for backward compatibility
CREATE OR REPLACE VIEW public.work_order AS SELECT * FROM public.work_orders;
