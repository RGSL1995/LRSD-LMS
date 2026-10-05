-- ============================================================
-- Migration 0014: Borrower Review Portal & Supporting Documents (Consolidated)
-- Ensures facility terms, parties, collaterals, and portal review
-- metadata are set up along with Row-Level Security (RLS) policies
-- for external borrower access.
-- ============================================================

-- 1. Ensure loan_applications has facility terms and portal columns
alter table public.loan_applications
  add column if not exists tenure_months integer,
  add column if not exists facility_type text,
  add column if not exists portal_token text unique,
  add column if not exists portal_status text not null default 'pending',
  add column if not exists borrower_reviewed_at timestamptz,
  add column if not exists borrower_review_notes text;

create index if not exists loan_applications_portal_token_idx
  on public.loan_applications (portal_token);

-- 2. Multi-Party Association Table (Primary, Co-Borrowers, Guarantors, Security Providers)
create table if not exists public.loan_application_parties (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  borrower_id uuid not null references public.borrowers(id) on delete cascade,
  party_role text not null default 'co_borrower',
  guarantee_type text,
  is_primary boolean not null default false,
  is_guarantor boolean not null default false,
  is_security_provider boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.loan_application_parties
  drop constraint if exists loan_application_parties_party_role_check;

alter table public.loan_application_parties
  add constraint loan_application_parties_party_role_check
  check (party_role in ('primary_borrower', 'co_borrower', 'guarantor', 'security_provider'));

create index if not exists loan_application_parties_app_idx
  on public.loan_application_parties (loan_application_id);

create index if not exists loan_application_parties_borrower_idx
  on public.loan_application_parties (borrower_id);

-- 3. Collateral & Security Details Table
create table if not exists public.loan_collaterals (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  collateral_type text not null,
  charge_type text,
  property_status text,
  address text,
  city text,
  pincode text,
  estimated_value numeric(16, 2),
  details text,
  pledgor_borrower_id uuid references public.borrowers(id) on delete set null,
  pledgor_name text,
  pledgor_pan text,
  created_at timestamptz not null default now()
);

create index if not exists loan_collaterals_app_idx
  on public.loan_collaterals (loan_application_id);

-- 4. Extend borrower_documents for portal uploads
alter table public.borrower_documents
  alter column uploaded_by drop not null;

alter table public.borrower_documents
  alter column category type text;

alter table public.borrower_documents
  add column if not exists loan_application_id uuid references public.loan_applications (id) on delete cascade,
  add column if not exists uploaded_by_borrower boolean not null default false;

create index if not exists borrower_documents_loan_app_idx
  on public.borrower_documents (loan_application_id);

-- 5. Enable Row-Level Security
alter table public.loan_applications enable row level security;
alter table public.loan_application_parties enable row level security;
alter table public.loan_collaterals enable row level security;
alter table public.borrowers enable row level security;
alter table public.individual_profiles enable row level security;
alter table public.corporate_profiles enable row level security;
alter table public.other_profiles enable row level security;
alter table public.borrower_documents enable row level security;

-- 6. Row-Level Security Policies for Authenticated Employees
drop policy if exists "employees can view loan applications" on public.loan_applications;
create policy "employees can view loan applications"
  on public.loan_applications for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can select loan_application_parties"
  on public.loan_application_parties for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can insert loan_application_parties"
  on public.loan_application_parties for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can update loan_application_parties"
  on public.loan_application_parties for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can delete loan_application_parties"
  on public.loan_application_parties for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can select loan_collaterals"
  on public.loan_collaterals for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can insert loan_collaterals"
  on public.loan_collaterals for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can update loan_collaterals"
  on public.loan_collaterals for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can delete loan_collaterals"
  on public.loan_collaterals for delete
  to authenticated
  using (true);

-- 7. Row-Level Security Policies for External/Anonymous Borrower Portal Review
drop policy if exists "allow public review of loan application via portal_token" on public.loan_applications;
create policy "allow public review of loan application via portal_token"
  on public.loan_applications for select
  to anon, authenticated
  using (portal_token is not null);

drop policy if exists "allow public update of loan application review status" on public.loan_applications;
create policy "allow public update of loan application review status"
  on public.loan_applications for update
  to anon, authenticated
  using (portal_token is not null)
  with check (portal_token is not null);

drop policy if exists "allow public read of borrowers for portal" on public.borrowers;
create policy "allow public read of borrowers for portal"
  on public.borrowers for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of individual profiles for portal" on public.individual_profiles;
create policy "allow public read of individual profiles for portal"
  on public.individual_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of corporate profiles for portal" on public.corporate_profiles;
create policy "allow public read of corporate profiles for portal"
  on public.corporate_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of other profiles for portal" on public.other_profiles;
create policy "allow public read of other profiles for portal"
  on public.other_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of loan application parties for portal" on public.loan_application_parties;
create policy "allow public read of loan application parties for portal"
  on public.loan_application_parties for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of loan collaterals for portal" on public.loan_collaterals;
create policy "allow public read of loan collaterals for portal"
  on public.loan_collaterals for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read and insert of borrower documents for portal" on public.borrower_documents;
create policy "allow public read and insert of borrower documents for portal"
  on public.borrower_documents for all
  to anon, authenticated
  using (true)
  with check (true);

-- 8. Storage bucket policies for borrower-documents uploads
insert into storage.buckets (id, name, public)
values ('borrower-documents', 'borrower-documents', false)
on conflict (id) do nothing;

drop policy if exists "allow portal uploads to borrower documents" on storage.objects;
create policy "allow portal uploads to borrower documents"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'borrower-documents');

drop policy if exists "allow portal reads from borrower documents" on storage.objects;
create policy "allow portal reads from borrower documents"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'borrower-documents');

drop policy if exists "allow portal deletes from borrower documents" on storage.objects;
create policy "allow portal deletes from borrower documents"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'borrower-documents');
