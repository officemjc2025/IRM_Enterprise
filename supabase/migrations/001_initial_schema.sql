-- =====================================================
-- IRM Enterprise Migration: 001_initial_schema.sql
-- =====================================================

-- Enable necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop trigger function if exists
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Create updated_at column helper trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
