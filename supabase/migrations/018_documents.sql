-- =====================================================
-- IRM Enterprise Migration: 018_documents.sql
-- =====================================================

CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255),
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Singular View for backward compatibility
CREATE OR REPLACE VIEW public.document AS SELECT * FROM public.documents;

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Allow select and write for authenticated
CREATE POLICY "Allow select documents for authenticated" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write documents for authenticated" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
