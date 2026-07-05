-- =====================================================
-- IRM Enterprise Migration: 023_harden_work_order_photo_security.sql
-- =====================================================

-- 1. Drop unsafe policies on public.work_order_photos created by 022
DROP POLICY IF EXISTS "Allow select work_order_photos for authenticated" ON public.work_order_photos;
DROP POLICY IF EXISTS "Allow insert work_order_photos for authenticated" ON public.work_order_photos;
DROP POLICY IF EXISTS "Allow delete work_order_photos for authenticated" ON public.work_order_photos;
DROP POLICY IF EXISTS "Harden select work_order_photos" ON public.work_order_photos;
DROP POLICY IF EXISTS "Harden insert work_order_photos" ON public.work_order_photos;
DROP POLICY IF EXISTS "Harden delete work_order_photos" ON public.work_order_photos;

-- 2. Create hardened policies for public.work_order_photos
CREATE POLICY "Harden select work_order_photos"
ON public.work_order_photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'property_admin')
        OR (
          p.role = 'technician'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_photos.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_photos.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

CREATE POLICY "Harden insert work_order_photos"
ON public.work_order_photos FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'property_admin')
        OR (
          p.role = 'technician'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_photos.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_photos.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

CREATE POLICY "Harden delete work_order_photos"
ON public.work_order_photos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'property_admin')
        OR (
          p.role = 'technician'
          AND auth.uid() = uploaded_by
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_photos.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND auth.uid() = uploaded_by
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_photos.work_order_id
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

-- 3. Drop unsafe policies on storage.objects created by 022
DROP POLICY IF EXISTS "Allow authenticated to select from work-orders bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to insert into work-orders bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete from work-orders bucket" ON storage.objects;
DROP POLICY IF EXISTS "Harden select storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Harden insert storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Harden delete storage objects" ON storage.objects;

-- 4. Create hardened storage policies for 'work-orders' bucket
CREATE POLICY "Harden select storage objects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-orders'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'property_admin')
        OR (
          p.role = 'technician'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id::text = split_part(name, '/', 2)
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id::text = split_part(name, '/', 2)
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

CREATE POLICY "Harden insert storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-orders'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'property_admin')
        OR (
          p.role = 'technician'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id::text = split_part(name, '/', 2)
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id::text = split_part(name, '/', 2)
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);

CREATE POLICY "Harden delete storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'work-orders'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'super_admin', 'property_admin')
        OR (
          p.role = 'technician'
          AND owner = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id::text = split_part(name, '/', 2)
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'TECHNICIAN'
          )
        )
        OR (
          p.role = 'housekeeping'
          AND owner = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id::text = split_part(name, '/', 2)
              AND wo.assigned_to = auth.uid()
              AND wo.service_team = 'HOUSEKEEPING'
          )
        )
      )
  )
);
