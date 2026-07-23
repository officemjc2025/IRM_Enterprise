-- Add new fields to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prefix TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'NOT_SENT';

-- Recreate profile view in exact order to expose new fields at the end
CREATE OR REPLACE VIEW public.profile AS
SELECT
    p.id,
    p.email,
    p.display_name,
    p.full_name,
    p.phone,
    p.avatar_url,
    p.role,
    p.property_id,
    p.language,
    p.theme,
    p.status,
    p.is_active,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    p.deleted_at,
    p.person_id,
    p.force_password_change,
    p.accepted_terms_at,
    p.accepted_privacy_at,
    p.account_status,
    p.department,
    p.import_batch_id,
    p.photo_url,
    p.prefix,
    p.nickname,
    p.team,
    p.invitation_status
FROM public.profiles p;
