-- =====================================================
-- IRM Enterprise Migration: 019_seed_uat_accounts.sql
-- =====================================================

-- Ensure pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 1. Insert Test Property
INSERT INTO public.properties (id, property_code, property_name_th, property_name_en, property_type, address_th, address_en, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'MJC_UAT',
  'เมโทร จอมเทียน คอนโดเทล (UAT)',
  'Metro Jomtien Condotel (UAT)',
  'CONDOMINIUM',
  'Jomtien Beach Road, Pattaya, Chonburi',
  'Jomtien Beach Road, Pattaya, Chonburi',
  'ACTIVE'
) ON CONFLICT (property_code) DO NOTHING;
-- 2. Insert Test Units
INSERT INTO public.units (id, property_id, building_code, floor, unit_number, area, ownership_ratio, status)
VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'A', '10', '1001', 45.5, 0.0125, 'ACTIVE'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'A', '10', '1002', 45.5, 0.0125, 'ACTIVE'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'A', '10', '1003', 60.0, 0.0150, 'ACTIVE'),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', 'A', '10', '1004', 60.0, 0.0150, 'ACTIVE'),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111111', 'A', '10', '1005', 90.0, 0.0220, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
-- 3. Insert Test Persons
INSERT INTO public.persons (id, person_code, first_name, last_name, display_name, email, phone, status)
VALUES
  ('33333333-3333-3333-3333-333333333301', 'P_RES1', 'John', 'Doe', 'John Doe', 'resident1@example.com', '0812345671', 'ACTIVE'),
  ('33333333-3333-3333-3333-333333333302', 'P_RES2', 'Jane', 'Smith', 'Jane Smith', 'resident2@example.com', '0812345672', 'ACTIVE'),
  ('33333333-3333-3333-3333-333333333303', 'P_RES3', 'Somchai', 'Jaidee', 'Somchai Jaidee', 'resident3@example.com', '0812345673', 'ACTIVE'),
  ('33333333-3333-3333-3333-333333333304', 'P_RES4', 'Somsri', 'Rukdee', 'Somsri Rukdee', 'resident4@example.com', '0812345674', 'ACTIVE'),
  ('33333333-3333-3333-3333-333333333305', 'P_RES5', 'Robert', 'Johnson', 'Robert Johnson', 'resident5@example.com', '0812345675', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
-- 4. Insert Active Resident Assignments
INSERT INTO public.resident_assignments (id, person_id, unit_id, resident_type, is_primary, move_in_date, status)
VALUES
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'owner', true, '2026-01-01', 'ACTIVE'),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', 'co_owner', true, '2026-01-01', 'ACTIVE'),
  ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222203', 'tenant', true, '2026-01-01', 'ACTIVE'),
  ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222204', 'resident', false, '2026-01-01', 'ACTIVE'),
  ('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222205', 'resident', true, '2026-01-01', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;
-- Helper macro to insert auth.users
-- Passwords set to "Password123!" using bcrypt hash
CREATE OR REPLACE FUNCTION public.provision_uat_user(
  p_id UUID,
  p_email TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email OR id = p_id) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      p_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      '$2a$10$qV3U68ZzB0B6p63c.277o.R0yUvIeG3mS8s4f0sZtZ4s7yZ0.K1.S', -- Password123!
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
-- 5. Seed UAT accounts in auth.users
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555501', 'superadmin@example.com');
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555502', 'admin@example.com');
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555503', 'propertyadmin@example.com');
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555504', 'security1@example.com');
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555505', 'security2@example.com');
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555506', 'technician1@example.com');
SELECT public.provision_uat_user('55555555-5555-5555-5555-555555555507', 'technician2@example.com');
SELECT public.provision_uat_user('33333333-3333-3333-3333-333333333301', 'resident1@example.com');
SELECT public.provision_uat_user('33333333-3333-3333-3333-333333333302', 'resident2@example.com');
SELECT public.provision_uat_user('33333333-3333-3333-3333-333333333303', 'resident3@example.com');
SELECT public.provision_uat_user('33333333-3333-3333-3333-333333333304', 'resident4@example.com');
SELECT public.provision_uat_user('33333333-3333-3333-3333-333333333305', 'resident5@example.com');
-- Clean up helper function
DROP FUNCTION IF EXISTS public.provision_uat_user(UUID, TEXT);
-- 6. Update role mappings in public.profiles to establish correct permission mappings
UPDATE public.profiles SET role = 'super_admin' WHERE email = 'superadmin@example.com';
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@example.com';
UPDATE public.profiles SET role = 'property_admin' WHERE email = 'propertyadmin@example.com';
UPDATE public.profiles SET role = 'security' WHERE email IN ('security1@example.com', 'security2@example.com');
UPDATE public.profiles SET role = 'technician' WHERE email IN ('technician1@example.com', 'technician2@example.com');
UPDATE public.profiles SET role = 'resident' WHERE email IN (
  'resident1@example.com',
  'resident2@example.com',
  'resident3@example.com',
  'resident4@example.com',
  'resident5@example.com'
);
