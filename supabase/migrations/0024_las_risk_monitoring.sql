-- Persist LAS market observations so staff can review price freshness and
-- security-cover movements over time.
alter table public.loans
  add column if not exists loan_application_id uuid references public.loan_applications(id);

create index if not exists loans_application_idx
  on public.loans (loan_application_id);

-- Backfill only when exactly one unlinked LAS application belongs to a loan's
-- borrower. Ambiguous historical links are left for an operator to resolve.
with possible_links as (
  select l.id as loan_id,
         la.id as application_id,
         count(*) over (partition by l.id) as candidate_count
  from public.loans l
  join public.loan_applications la on la.borrower_id = l.borrower_id
  where l.loan_application_id is null
    and la.facility_type ilike '%LAS%'
    and not exists (
      select 1 from public.loans linked
      where linked.loan_application_id = la.id
    )
), unambiguous_links as (
  select loan_id, application_id
  from possible_links
  where candidate_count = 1
)
update public.loans l
set loan_application_id = links.application_id
from unambiguous_links links
where l.id = links.loan_id;

create table if not exists public.las_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  collateral_id uuid not null references public.loan_collaterals(id) on delete cascade,
  loan_code text not null,
  security_name text not null,
  isin text,
  symbol text,
  quantity numeric(20, 4) not null default 0,
  cmp numeric(16, 4) not null default 0,
  previous_cmp numeric(16, 4),
  market_value numeric(18, 2) not null default 0,
  outstanding_principal numeric(18, 2) not null default 0,
  coverage_ratio numeric(10, 4) not null default 0,
  ltv_percent numeric(10, 4) not null default 0,
  risk_status text not null check (risk_status in ('critical', 'margin_call', 'watch', 'healthy', 'no_exposure')),
  price_is_stale boolean not null default false,
  price_observed_at timestamptz,
  quote_source text not null default 'Yahoo Finance',
  observed_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null
);

create index if not exists las_risk_snapshots_loan_observed_idx
  on public.las_risk_snapshots (loan_id, observed_at desc);
create index if not exists las_risk_snapshots_collateral_observed_idx
  on public.las_risk_snapshots (collateral_id, observed_at desc);

alter table public.las_risk_snapshots enable row level security;

create policy "active employees can view LAS risk snapshots"
  on public.las_risk_snapshots for select
  using (public.is_active_employee());
create policy "active employees can record LAS risk snapshots"
  on public.las_risk_snapshots for insert
  with check (public.is_active_employee() and recorded_by = auth.uid());
