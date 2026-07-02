-- =====================================================
-- IRM Enterprise Migration: 015_announcements.sql
-- =====================================================

-- Create Announcements Table (Plural)
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(30) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    status VARCHAR(30) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
    publish_at TIMESTAMPTZ DEFAULT NOW(),
    expire_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ
);

-- Singular View for backward compatibility
CREATE OR REPLACE VIEW public.announcement AS SELECT * FROM public.announcements;

-- Trigger for updated_at column update
CREATE TRIGGER tr_announcements_updated_at BEFORE UPDATE ON public.announcements 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow select announcements for authenticated" ON public.announcements;
DROP POLICY IF EXISTS "Allow write announcements for admins" ON public.announcements;

-- RLS Policies
-- Select: Admins can view all, residents can only view published and not expired
CREATE POLICY "Allow select announcements for authenticated" ON public.announcements FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  ) OR (
    status = 'PUBLISHED' 
    AND (publish_at IS NULL OR publish_at <= NOW()) 
    AND (expire_at IS NULL OR expire_at > NOW())
    AND deleted_at IS NULL
  )
);

-- Write: Admins can do all operations
CREATE POLICY "Allow write announcements for admins" ON public.announcements FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'property_admin')
  )
);
