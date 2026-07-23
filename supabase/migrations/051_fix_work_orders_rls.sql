-- Fix work_orders select policy to allow housekeepers and technicians to see jobs for their service team
DROP POLICY IF EXISTS "Allow select work_orders for authenticated" ON public.work_orders;
CREATE POLICY "Allow select work_orders for authenticated" ON public.work_orders
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
  )
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR resident_assignment_id IN (SELECT public.irm_active_assignment_ids())
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'housekeeping'
    AND service_team = 'HOUSEKEEPING'
    AND (
      (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'technician'
    AND service_team = 'TECHNICIAN'
    AND (
      (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);

-- Fix work_orders write policy to allow housekeepers and technicians to claim/update jobs for their service team
DROP POLICY IF EXISTS "Allow write work_orders for authenticated" ON public.work_orders;
CREATE POLICY "Allow write work_orders for authenticated" ON public.work_orders
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
  )
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'housekeeping'
    AND service_team = 'HOUSEKEEPING'
    AND (
      (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'technician'
    AND service_team = 'TECHNICIAN'
    AND (
      (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
)
WITH CHECK (
  public.is_admin()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'property_admin'
    AND (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
  )
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'housekeeping'
    AND service_team = 'HOUSEKEEPING'
    AND (
      (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  OR (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'technician'
    AND service_team = 'TECHNICIAN'
    AND (
      (SELECT property_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);
