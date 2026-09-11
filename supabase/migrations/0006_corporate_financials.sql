-- ============================================================
-- Structured financial data extracted from an uploaded company
-- financial report (e.g. a Balance Sheet / P&L Excel export).
-- One row per borrower + statement type + financial year.
-- ============================================================

create type public.financial_statement_type as enum ('standalone', 'consolidated');

create table public.corporate_financials (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  statement_type public.financial_statement_type not null,
  financial_year_ending date not null,
  source_document_id uuid references public.borrower_documents (id) on delete set null,

  -- Balance sheet
  share_capital numeric(18, 2),
  reserves_and_surplus numeric(18, 2),
  total_equity numeric(18, 2),
  long_term_borrowings numeric(18, 2),
  short_term_borrowings numeric(18, 2),
  trade_payables numeric(18, 2),
  total_liabilities numeric(18, 2),
  trade_receivables numeric(18, 2),
  inventories numeric(18, 2),
  cash_and_bank_balances numeric(18, 2),
  total_assets numeric(18, 2),

  -- Profit & loss
  net_revenue numeric(18, 2),
  total_operating_cost numeric(18, 2),
  ebitda numeric(18, 2),
  depreciation_and_amortization numeric(18, 2),
  finance_costs numeric(18, 2),
  profit_before_tax numeric(18, 2),
  income_tax numeric(18, 2),
  profit_after_tax numeric(18, 2),

  -- Key ratios (%, x)
  ebitda_margin_percent numeric(7, 2),
  net_margin_percent numeric(7, 2),
  return_on_equity_percent numeric(7, 2),
  debt_to_equity numeric(7, 2),
  current_ratio numeric(7, 2),
  interest_coverage_ratio numeric(7, 2),

  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),

  unique (borrower_id, statement_type, financial_year_ending)
);

create index corporate_financials_borrower_idx on public.corporate_financials (borrower_id);

alter table public.corporate_financials enable row level security;

create policy "employees can view corporate financials"
  on public.corporate_financials for select
  using (public.is_active_employee());

create policy "employees can insert corporate financials"
  on public.corporate_financials for insert
  with check (public.is_active_employee() and created_by = auth.uid());

create policy "employees can delete corporate financials"
  on public.corporate_financials for delete
  using (public.is_active_employee());
