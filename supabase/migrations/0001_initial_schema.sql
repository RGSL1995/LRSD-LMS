-- ============================================================
-- Loan Management System — Initial Schema
-- Stage 1/2: Employee profiles + roles, borrower model,
-- loan lifecycle skeleton, audit log.
-- ============================================================

-- ---------- Enums ----------

create type public.employee_role as enum ('executive', 'approver');

create type public.borrower_type as enum ('individual', 'corporate', 'other');

create type public.borrower_status as enum ('draft', 'submitted', 'approved', 'rejected');

create type public.corporate_associate_role as enum (
  'director',
  'promoter',
  'authorised_signatory',
  'key_management',
  'shareholder',
  'guarantor'
);

create type public.loan_application_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'sent_back'
);

create type public.approval_action as enum ('approved', 'rejected', 'sent_back');

create type public.loan_status as enum ('active', 'closed', 'defaulted', 'written_off');

-- ---------- Employee profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.employee_role not null default 'executive',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Borrowers (common) ----------

create table public.borrowers (
  id uuid primary key default gen_random_uuid(),
  borrower_code text not null unique,
  borrower_type public.borrower_type not null,
  status public.borrower_status not null default 'draft',
  relationship_manager_id uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index borrowers_type_idx on public.borrowers (borrower_type);
create index borrowers_status_idx on public.borrowers (status);
create index borrowers_created_by_idx on public.borrowers (created_by);

-- ---------- Individual borrower profile ----------

create table public.individual_profiles (
  borrower_id uuid primary key references public.borrowers (id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  pan text,
  email text,
  phone text,
  address text,
  employment_type text,
  employer_name text,
  monthly_income numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Corporate borrower profile ----------

create table public.corporate_profiles (
  borrower_id uuid primary key references public.borrowers (id) on delete cascade,
  legal_name text not null,
  trade_name text,
  cin text,
  pan text,
  gstin text,
  incorporation_date date,
  business_type text,
  registered_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- People associated with a corporate borrower (directors, promoters,
-- authorised signatories, key management, shareholders, guarantors).
create table public.corporate_associates (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  associate_role public.corporate_associate_role not null,
  full_name text not null,
  pan text,
  din text,
  email text,
  phone text,
  shareholding_percent numeric(5, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index corporate_associates_borrower_idx on public.corporate_associates (borrower_id);

-- ---------- Other borrower profile (flexible, future entity types) ----------

create table public.other_profiles (
  borrower_id uuid primary key references public.borrowers (id) on delete cascade,
  entity_name text not null,
  entity_category text,
  registration_number text,
  pan text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Borrower contacts (any borrower type) ----------

create table public.borrower_contacts (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  contact_name text not null,
  designation text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index borrower_contacts_borrower_idx on public.borrower_contacts (borrower_id);

-- ---------- Loan products ----------

create table public.loan_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Loan applications ----------

create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  application_code text not null unique,
  borrower_id uuid not null references public.borrowers (id),
  loan_product_id uuid references public.loan_products (id),
  requested_amount numeric(16, 2) not null check (requested_amount > 0),
  purpose text,
  status public.loan_application_status not null default 'draft',
  submitted_by uuid references public.profiles (id),
  submitted_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loan_applications_borrower_idx on public.loan_applications (borrower_id);
create index loan_applications_status_idx on public.loan_applications (status);

-- ---------- Approval history ----------

create table public.approval_history (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications (id) on delete cascade,
  approver_id uuid not null references public.profiles (id),
  action public.approval_action not null,
  comments text,
  created_at timestamptz not null default now()
);

create index approval_history_application_idx on public.approval_history (loan_application_id);

-- ---------- Loans (post-approval) ----------

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  loan_code text not null unique,
  loan_application_id uuid not null references public.loan_applications (id),
  borrower_id uuid not null references public.borrowers (id),
  sanctioned_amount numeric(16, 2) not null check (sanctioned_amount > 0),
  interest_rate numeric(6, 3),
  tenure_months integer check (tenure_months > 0),
  status public.loan_status not null default 'active',
  sanctioned_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loans_borrower_idx on public.loans (borrower_id);
create index loans_status_idx on public.loans (status);

-- ---------- Disbursements ----------

create table public.loan_disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  amount numeric(16, 2) not null check (amount > 0),
  disbursed_at timestamptz not null default now(),
  reference_number text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index loan_disbursements_loan_idx on public.loan_disbursements (loan_id);

-- ---------- Repayments ----------

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  amount numeric(16, 2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  reference_number text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index loan_repayments_loan_idx on public.loan_repayments (loan_id);

-- ---------- Audit logs ----------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_user_idx on public.audit_logs (user_id);

-- ============================================================
-- Triggers: auto-create profile on signup, keep updated_at fresh
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.employee_role, 'executive')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.borrowers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.individual_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.corporate_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.corporate_associates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.other_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.loan_applications
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.loans
  for each row execute function public.set_updated_at();
