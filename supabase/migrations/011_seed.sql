-- =====================================================
-- IRM Enterprise Migration: 011_seed.sql
-- =====================================================

-- Seed Roles
INSERT INTO public.roles (id, name, description) VALUES
  ('a0e829c6-a6c4-4b53-8e7c-03a110a26d7f', 'super_admin', 'System Super Administrator'),
  (gen_random_uuid(), 'property_admin', 'Property Administrator'),
  (gen_random_uuid(), 'manager', 'Building Manager'),
  (gen_random_uuid(), 'owner', 'Property Owner'),
  (gen_random_uuid(), 'co_owner', 'Co-owner'),
  (gen_random_uuid(), 'tenant', 'Tenant'),
  (gen_random_uuid(), 'resident', 'Resident'),
  (gen_random_uuid(), 'security', 'Security Officer'),
  (gen_random_uuid(), 'technician', 'Maintenance Technician'),
  (gen_random_uuid(), 'accounting', 'Accountant'),
  (gen_random_uuid(), 'housekeeping', 'Housekeeper'),
  (gen_random_uuid(), 'reception', 'Receptionist'),
  (gen_random_uuid(), 'committee', 'Committee Member'),
  (gen_random_uuid(), 'guest', 'Guest / Visitor')
ON CONFLICT (name) DO NOTHING;

-- Seed Permissions
INSERT INTO public.permissions (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ManageProperty', 'Manage property, buildings, floors, and units'),
  ('00000000-0000-0000-0000-000000000002', 'ManageResident', 'Manage owners, occupants, and resident assignments'),
  ('00000000-0000-0000-0000-000000000003', 'SecurityGate', 'Access visitor check-in/out and security gates'),
  ('00000000-0000-0000-0000-000000000004', 'WorkOrder', 'Access and manage maintenance work orders'),
  ('00000000-0000-0000-0000-000000000005', 'ResidentPortal', 'Access resident portal features')
ON CONFLICT (name) DO NOTHING;

-- Seed Role Permissions based on permissions.ts mapping
DO $$
DECLARE
  super_admin_id UUID;
  prop_admin_id UUID;
  security_id UUID;
  tech_id UUID;
  owner_id UUID;
  co_owner_id UUID;
  tenant_id UUID;
  resident_id UUID;
  p_property UUID := '00000000-0000-0000-0000-000000000001';
  p_resident UUID := '00000000-0000-0000-0000-000000000002';
  p_security UUID := '00000000-0000-0000-0000-000000000003';
  p_tech     UUID := '00000000-0000-0000-0000-000000000004';
  p_portal   UUID := '00000000-0000-0000-0000-000000000005';
BEGIN
  SELECT id INTO super_admin_id FROM public.roles WHERE name = 'super_admin';
  SELECT id INTO prop_admin_id FROM public.roles WHERE name = 'property_admin';
  SELECT id INTO security_id FROM public.roles WHERE name = 'security';
  SELECT id INTO tech_id FROM public.roles WHERE name = 'technician';
  SELECT id INTO owner_id FROM public.roles WHERE name = 'owner';
  SELECT id INTO co_owner_id FROM public.roles WHERE name = 'co_owner';
  SELECT id INTO tenant_id FROM public.roles WHERE name = 'tenant';
  SELECT id INTO resident_id FROM public.roles WHERE name = 'resident';

  -- ManageProperty
  INSERT INTO public.role_permissions (role_id, permission_id) VALUES (super_admin_id, p_property), (prop_admin_id, p_property) ON CONFLICT DO NOTHING;
  -- ManageResident
  INSERT INTO public.role_permissions (role_id, permission_id) VALUES (super_admin_id, p_resident), (prop_admin_id, p_resident) ON CONFLICT DO NOTHING;
  -- SecurityGate
  INSERT INTO public.role_permissions (role_id, permission_id) VALUES (security_id, p_security), (prop_admin_id, p_security) ON CONFLICT DO NOTHING;
  -- WorkOrder
  INSERT INTO public.role_permissions (role_id, permission_id) VALUES (tech_id, p_tech), (prop_admin_id, p_tech) ON CONFLICT DO NOTHING;
  -- ResidentPortal
  INSERT INTO public.role_permissions (role_id, permission_id) VALUES (owner_id, p_portal), (co_owner_id, p_portal), (tenant_id, p_portal), (resident_id, p_portal) ON CONFLICT DO NOTHING;
END;
$$;

-- Seed Lookup Values
-- Countries
INSERT INTO public.countries (code, name_th, name_en) VALUES
  ('TH', 'ประเทศไทย', 'Thailand'),
  ('US', 'สหรัฐอเมริกา', 'United States'),
  ('GB', 'สหราชอาณาจักร', 'United Kingdom'),
  ('JP', 'ญี่ปุ่น', 'Japan'),
  ('SG', 'สิงคโปร์', 'Singapore')
ON CONFLICT (code) DO NOTHING;

-- Languages
INSERT INTO public.languages (code, name_th, name_en) VALUES
  ('th', 'ภาษาไทย', 'Thai'),
  ('en', 'ภาษาอังกฤษ', 'English')
ON CONFLICT (code) DO NOTHING;

-- Owner Types
INSERT INTO public.owner_types (code, name_th, name_en) VALUES
  ('INDIVIDUAL', 'บุคคลธรรมดา', 'Individual'),
  ('JURISTIC', 'นิติบุคคล', 'Juristic Person')
ON CONFLICT (code) DO NOTHING;

-- Person Types
INSERT INTO public.person_types (code, name_th, name_en) VALUES
  ('INDIVIDUAL', 'บุคคลทั่วไป', 'Individual'),
  ('CONTACT', 'บุคคลผู้ติดต่อ', 'Contact Person')
ON CONFLICT (code) DO NOTHING;

-- Occupancy Statuses
INSERT INTO public.occupancy_statuses (code, name_th, name_en) VALUES
  ('ACTIVE', 'ใช้งานอยู่', 'Active'),
  ('INACTIVE', 'ไม่ได้ใช้งาน', 'Inactive'),
  ('PENDING', 'รอดำเนินการ', 'Pending')
ON CONFLICT (code) DO NOTHING;

-- Unit Statuses
INSERT INTO public.unit_statuses (code, name_th, name_en) VALUES
  ('ACTIVE', 'ใช้งานอยู่', 'Active'),
  ('INACTIVE', 'ไม่ได้ใช้งาน', 'Inactive'),
  ('MAINTENANCE', 'ปรับปรุง/ซ่อมบำรุง', 'Maintenance')
ON CONFLICT (code) DO NOTHING;

-- Reservation Statuses
INSERT INTO public.reservation_statuses (code, name_th, name_en) VALUES
  ('PENDING', 'รอดำเนินการ', 'Pending'),
  ('CONFIRMED', 'ยืนยันแล้ว', 'Confirmed'),
  ('CANCELLED', 'ยกเลิกแล้ว', 'Cancelled')
ON CONFLICT (code) DO NOTHING;

-- Work Order Statuses
INSERT INTO public.work_order_statuses (code, name_th, name_en) VALUES
  ('PENDING', 'รอดำเนินการ', 'Pending'),
  ('IN_PROGRESS', 'กำลังดำเนินการ', 'In Progress'),
  ('COMPLETED', 'เสร็จสิ้น', 'Completed'),
  ('CANCELLED', 'ยกเลิกแล้ว', 'Cancelled')
ON CONFLICT (code) DO NOTHING;

-- Visitor Statuses
INSERT INTO public.visitor_statuses (code, name_th, name_en) VALUES
  ('CHECKED_IN', 'เข้าพบอยู่', 'Checked In'),
  ('CHECKED_OUT', 'ออกจากโครงการ', 'Checked Out'),
  ('OVERSTAYED', 'อยู่เกินกำหนด', 'Overstayed')
ON CONFLICT (code) DO NOTHING;
