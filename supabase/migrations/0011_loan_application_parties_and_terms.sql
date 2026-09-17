-- ============================================================
-- 0011_loan_application_parties_and_terms.sql
-- Add loan facility terms (tenure, facility_type),
-- multi-party structure (co-borrowers, guarantors),
-- and collateral / security details to loan applications.
-- ============================================================

-- 1. Extend loan_applications with tenure and facility type
alter table public.loan_applications
  add column if not exists tenure_months integer check (tenure_months > 0),
  add column if not exists facility_type text;

-- 2. Multi-Party Association Table (Primary Borrower, Co-Borrowers, Guarantors)
create table if not exists public.loan_application_parties (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  borrower_id uuid not null references public.borrowers(id) on delete cascade,
  party_role text not null check (party_role in ('primary_borrower', 'co_borrower', 'guarantor')),
  guarantee_type text check (guarantee_type in ('personal', 'corporate', 'unconditional', 'limited', null)),
  is_primary boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists loan_application_parties_app_idx
  on public.loan_application_parties (loan_application_id);

create index if not exists loan_application_parties_borrower_idx
  on public.loan_application_parties (borrower_id);

-- 3. Collateral & Security Details Table
create table if not exists public.loan_collaterals (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  collateral_type text not null, -- Plot, Flat, Land, Project, Builder Floor, Commercial Unit, Others
  charge_type text,              -- Mortgage, Charge, Hypothecation, Pledge, Others
  property_status text,          -- Ready, Under-Construction, Vacant, Others
  address text,
  city text,
  pincode text,
  estimated_value numeric(16, 2),
  details text,
  created_at timestamptz not null default now()
);

create index if not exists loan_collaterals_app_idx
  on public.loan_collaterals (loan_application_id);

-- 4. Enable Row Level Security
alter table public.loan_application_parties enable row level security;
alter table public.loan_collaterals enable row level security;

-- 5. RLS Policies for authenticated employees
create policy "Authenticated users can select loan_application_parties"
  on public.loan_application_parties for select
  to authenticated
  using (true);

create policy "Authenticated users can insert loan_application_parties"
  on public.loan_application_parties for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update loan_application_parties"
  on public.loan_application_parties for update
  to authenticated
  using (true);

create policy "Authenticated users can delete loan_application_parties"
  on public.loan_application_parties for delete
  to authenticated
  using (true);

create policy "Authenticated users can select loan_collaterals"
  on public.loan_collaterals for select
  to authenticated
  using (true);

create policy "Authenticated users can insert loan_collaterals"
  on public.loan_collaterals for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update loan_collaterals"
  on public.loan_collaterals for update
  to authenticated
  using (true);

create policy "Authenticated users can delete loan_collaterals"
  on public.loan_collaterals for delete
  to authenticated
  using (true);
