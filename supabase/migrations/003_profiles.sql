-- =====================================================
-- IRM Enterprise Migration: 003_profiles.sql
-- =====================================================

-- Profiles Table (Plural)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'resident',
    property_id UUID, -- Foreign Key referencing properties(id) will be added in 012_constraints.sql
    language TEXT DEFAULT 'th',
    theme TEXT DEFAULT 'light',
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Drop existing view if exists
DROP VIEW IF EXISTS public.profile CASCADE;

-- Singular View for backward compatibility with repositories querying singular table name
CREATE OR REPLACE VIEW public.profile AS 
SELECT * FROM public.profiles;

-- Drop existing trigger on auth.users if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;

-- Drop existing trigger function if exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Trigger Function for auto profile creation upon signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, full_name, role, status, language, theme)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    'resident',
    'active',
    'th',
    'light'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function on new auth.users insertion
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop existing trigger on public.profiles if exists
DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles CASCADE;

-- Trigger for updated_at column update
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

