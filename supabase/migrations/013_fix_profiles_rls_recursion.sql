-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Helper function to check if the current user is an admin without causing recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the policy using the security definer helper
CREATE POLICY "Admins can view all profiles" ON public.profiles 
  FOR SELECT 
  USING (public.is_admin());
