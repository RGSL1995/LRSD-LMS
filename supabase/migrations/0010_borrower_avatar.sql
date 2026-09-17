-- ============================================================
-- 0010_borrower_avatar.sql
-- Add avatar / logo support to borrowers, corporate profiles,
-- and individual profiles.
-- ============================================================

-- Common avatar URL for any borrower type
alter table public.borrowers
  add column if not exists avatar_url text;

-- Specific logo URL for corporate profiles
alter table public.corporate_profiles
  add column if not exists logo_url text;

-- Specific photo URL for individual profiles
alter table public.individual_profiles
  add column if not exists photo_url text;
