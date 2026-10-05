-- Migration 0025: Create manual_las_risk_positions table for manual entry & monitoring
create table if not exists public.manual_las_risk_positions (
  id uuid primary key default gen_random_uuid(),
  borrower_name text not null,
  loan_code text,
  security_name text not null,
  isin text,
  symbol text,
  shares_pledged numeric(20, 4) not null default 0,
  price_at_disbursement numeric(16, 4) not null default 0,
  current_price numeric(16, 4) not null default 0,
  disbursement_date date not null default current_date,
  disbursed_amount numeric(18, 2) not null default 0,
  required_cover numeric(10, 4) not null default 2.00,
  pledgor_name text,
  remarks text,
  last_price_updated_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manual_las_risk_positions enable row level security;

create policy "Allow authenticated full access to manual_las_risk_positions"
  on public.manual_las_risk_positions
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Allow anon full access to manual_las_risk_positions"
  on public.manual_las_risk_positions
  for all
  to anon
  using (true)
  with check (true);
