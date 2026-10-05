-- ============================================================
-- Repayment Schedule & Loan Servicing System
--
-- Stores installment amortization schedules, actual payment
-- receipts, transaction allocations (principal, interest, penal,
-- charges), and loan ledger state.
-- ============================================================

-- 1. Installment Schedules Table
create table if not exists public.loan_schedules (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,

  installment_number integer not null, -- 0 for broken period, 1..N for months
  due_date date not null,
  period_label text, -- e.g. "Broken Period", "May 2026"

  opening_principal numeric(16, 2) not null default 0,
  principal_due numeric(16, 2) not null default 0,
  interest_due numeric(16, 2) not null default 0,
  total_due numeric(16, 2) not null default 0,
  closing_principal numeric(16, 2) not null default 0,

  principal_paid numeric(16, 2) not null default 0,
  interest_paid numeric(16, 2) not null default 0,
  penal_interest_due numeric(16, 2) not null default 0,
  penal_interest_paid numeric(16, 2) not null default 0,
  bouncing_charges_due numeric(16, 2) not null default 0,
  bouncing_charges_paid numeric(16, 2) not null default 0,

  status text not null default 'scheduled' check (
    status in ('scheduled', 'due', 'partially_paid', 'paid', 'overdue', 'waived')
  ),
  paid_date date,
  payment_mode text,
  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loan_schedules_loan_app_idx
  on public.loan_schedules (loan_application_id, installment_number);

create index if not exists loan_schedules_due_date_status_idx
  on public.loan_schedules (due_date, status);

-- 2. Repayment Payments / Receipts Table
create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,

  receipt_number text not null,
  payment_date date not null default current_date,
  amount numeric(16, 2) not null,

  allocated_principal numeric(16, 2) not null default 0,
  allocated_interest numeric(16, 2) not null default 0,
  allocated_penal numeric(16, 2) not null default 0,
  allocated_charges numeric(16, 2) not null default 0,

  payment_mode text not null default 'NEFT' check (
    payment_mode in ('NACH', 'PDC', 'NEFT', 'RTGS', 'Cheque', 'UPI', 'Cash', 'Internal Transfer')
  ),
  reference_number text, -- UTR, Cheque No, NACH UMRN
  bank_name text,
  payment_type text not null default 'regular_installment' check (
    payment_type in ('regular_installment', 'part_prepayment', 'foreclosure', 'penal_settlement', 'cash_top_up', 'charge_fee')
  ),

  status text not null default 'cleared' check (
    status in ('cleared', 'bounced', 'pending', 'reversed')
  ),
  bounced_date date,
  bounce_reason text,

  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loan_repayments_loan_app_idx
  on public.loan_repayments (loan_application_id, payment_date);

create index if not exists loan_repayments_receipt_no_idx
  on public.loan_repayments (receipt_number);

-- 3. Loan Servicing Config & Summary Snapshot (optional overrides per loan)
create table if not exists public.loan_servicing_configs (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade unique,

  disbursement_date date not null default current_date,
  disbursed_amount numeric(16, 2) not null default 0,
  repayment_mode text not null default 'bullet' check (repayment_mode in ('bullet', 'emi')),
  roi_percent numeric(6, 2) not null default 16.00,
  tenure_months integer not null default 12,
  tenure_days integer not null default 365,
  day_count_convention text not null default 'actual_365' check (day_count_convention in ('actual_365', '30_360')),

  penal_interest_rate numeric(6, 2) not null default 2.00, -- 2% p.a. / p.m.
  bouncing_charge_amount numeric(10, 2) not null default 1000.00,

  schedule_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.loan_schedules enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.loan_servicing_configs enable row level security;

-- Policies for loan_schedules
create policy "Authenticated users can select loan_schedules"
  on public.loan_schedules for select to authenticated using (true);

create policy "Authenticated users can insert loan_schedules"
  on public.loan_schedules for insert to authenticated with check (true);

create policy "Authenticated users can update loan_schedules"
  on public.loan_schedules for update to authenticated using (true);

create policy "Authenticated users can delete loan_schedules"
  on public.loan_schedules for delete to authenticated using (true);

-- Policies for loan_repayments
create policy "Authenticated users can select loan_repayments"
  on public.loan_repayments for select to authenticated using (true);

create policy "Authenticated users can insert loan_repayments"
  on public.loan_repayments for insert to authenticated with check (true);

create policy "Authenticated users can update loan_repayments"
  on public.loan_repayments for update to authenticated using (true);

create policy "Authenticated users can delete loan_repayments"
  on public.loan_repayments for delete to authenticated using (true);

-- Policies for loan_servicing_configs
create policy "Authenticated users can select loan_servicing_configs"
  on public.loan_servicing_configs for select to authenticated using (true);

create policy "Authenticated users can insert loan_servicing_configs"
  on public.loan_servicing_configs for insert to authenticated with check (true);

create policy "Authenticated users can update loan_servicing_configs"
  on public.loan_servicing_configs for update to authenticated using (true);

create policy "Authenticated users can delete loan_servicing_configs"
  on public.loan_servicing_configs for delete to authenticated using (true);
