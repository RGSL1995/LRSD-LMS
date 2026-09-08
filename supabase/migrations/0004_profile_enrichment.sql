-- ============================================================
-- Enrich individual_profiles and corporate_profiles to match the
-- fields captured on the company's actual Loan Application Form
-- (LAF): personal/KYC details, current vs permanent address, work
-- details for individuals; business type, registration, and
-- office addresses for corporates.
-- ============================================================

create type public.gender as enum ('male', 'female', 'other');
create type public.marital_status as enum ('married', 'single', 'other');
create type public.qualification as enum (
  'high_school',
  'graduate',
  'post_graduate',
  'professional',
  'other'
);
create type public.occupation_type as enum ('salaried', 'business', 'housewife', 'other');
create type public.residence_type as enum ('rented', 'owned', 'other');
create type public.corporate_business_type as enum (
  'public',
  'private_limited',
  'partnership',
  'llp',
  'other'
);

-- ---------- individual_profiles ----------

alter table public.individual_profiles
  drop column address,
  drop column employment_type,
  drop column employer_name;

alter table public.individual_profiles
  add column father_or_husband_name text,
  add column gender public.gender,
  add column marital_status public.marital_status,
  add column qualification public.qualification,
  add column occupation public.occupation_type,
  add column aadhaar_number text,
  add column passport_number text,
  add column landline text,
  add column current_address_line text,
  add column current_city text,
  add column current_state text,
  add column current_pincode text,
  add column current_residence_type public.residence_type,
  add column current_residence_years integer,
  add column permanent_address_line text,
  add column permanent_city text,
  add column permanent_state text,
  add column permanent_pincode text,
  add column permanent_residence_type public.residence_type,
  add column permanent_residence_years integer,
  add column office_name text,
  add column office_address text,
  add column office_landmark text,
  add column office_city text,
  add column office_pincode text,
  add column office_landline text,
  add column office_email text;

-- ---------- corporate_profiles ----------

alter table public.corporate_profiles
  drop column business_type,
  drop column registered_address;

alter table public.corporate_profiles
  add column business_type public.corporate_business_type,
  add column is_registered boolean,
  add column corporate_office_address text,
  add column corporate_office_city text,
  add column corporate_office_state text,
  add column corporate_office_pincode text,
  add column registered_office_address text,
  add column registered_office_city text,
  add column registered_office_state text,
  add column registered_office_pincode text,
  add column ownership_type text,
  add column contact_no text,
  add column contact_email text,
  add column landline text;
