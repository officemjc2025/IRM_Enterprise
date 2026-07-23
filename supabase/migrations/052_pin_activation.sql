-- IRM-048 PIN Activation schema updates
-- 1. Create pin_activations table
CREATE TABLE IF NOT EXISTS public.pin_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  temporary_pin_hash TEXT NOT NULL,
  temporary_pin_expires_at TIMESTAMPTZ NOT NULL,
  temporary_pin_used_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ, -- Tracks PINs invalidated when a newer PIN is generated
  failed_pin_attempts INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup on profile ID
CREATE INDEX IF NOT EXISTS idx_pin_activations_profile_id ON public.pin_activations(profile_id);

-- Enable RLS on pin_activations
ALTER TABLE public.pin_activations ENABLE ROW LEVEL SECURITY;

-- 2. Alter profiles table to add status, activation method, and logging timestamps
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auth_status TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS activation_method TEXT NOT NULL DEFAULT 'PIN',
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- 3. Create simple RLS policies for pin_activations
DROP POLICY IF EXISTS "Allow select for administrators" ON public.pin_activations;
CREATE POLICY "Allow select for administrators" ON public.pin_activations
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'property_admin')
  );

DROP POLICY IF EXISTS "Allow insert/update for administrators" ON public.pin_activations;
CREATE POLICY "Allow insert/update for administrators" ON public.pin_activations
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'property_admin')
  );
