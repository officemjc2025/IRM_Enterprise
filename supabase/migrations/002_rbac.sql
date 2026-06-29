-- =====================================================
-- IRM Enterprise Migration: 002_rbac.sql
-- =====================================================

-- Roles Table
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Permissions Table
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

-- Role Permissions Mapping Table
CREATE TABLE public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles Mapping Table
CREATE TABLE public.user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_roles_updated_at ON public.roles;
DROP TRIGGER IF EXISTS tr_permissions_updated_at ON public.permissions;

-- Triggers for updated_at
CREATE TRIGGER tr_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select roles for authenticated users" ON public.roles;
DROP POLICY IF EXISTS "Allow write roles for super_admin" ON public.roles;
DROP POLICY IF EXISTS "Allow select permissions for authenticated users" ON public.permissions;
DROP POLICY IF EXISTS "Allow write permissions for super_admin" ON public.permissions;
DROP POLICY IF EXISTS "Allow select role_permissions for authenticated users" ON public.role_permissions;
DROP POLICY IF EXISTS "Allow write role_permissions for super_admin" ON public.role_permissions;
DROP POLICY IF EXISTS "Allow select user_roles for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Allow write user_roles for super_admin" ON public.user_roles;

-- RLS Policies
-- Roles policies
CREATE POLICY "Allow select roles for authenticated users" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write roles for super_admin" ON public.roles FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
);

-- Permissions policies
CREATE POLICY "Allow select permissions for authenticated users" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write permissions for super_admin" ON public.permissions FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
);

-- Role Permissions policies
CREATE POLICY "Allow select role_permissions for authenticated users" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write role_permissions for super_admin" ON public.role_permissions FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
);

-- User Roles policies
CREATE POLICY "Allow select user_roles for authenticated users" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write user_roles for super_admin" ON public.user_roles FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
);
