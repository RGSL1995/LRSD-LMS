-- ============================================================
-- Corporate Governance, Group Structure, Related Party Transactions (RPT)
-- and GST Analytics & Returns for Corporate Borrowers
-- ============================================================

-- ---------- Group / Subsidiary Structure ----------
create type public.group_relationship_type as enum (
  'holding_company',
  'subsidiary',
  'joint_venture',
  'associate_entity',
  'sister_concern'
);

create table public.corporate_group_structure (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  entity_name text not null,
  relationship_type public.group_relationship_type not null,
  percentage_holding numeric(5, 2),
  country_of_incorporation text default 'India',
  cin_or_registration text,
  business_nature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index corporate_group_structure_borrower_idx on public.corporate_group_structure (borrower_id);

alter table public.corporate_group_structure enable row level security;

create policy "employees can view corporate group structure"
  on public.corporate_group_structure for select
  using (public.is_active_employee());

create policy "employees can insert corporate group structure"
  on public.corporate_group_structure for insert
  with check (public.is_active_employee());

create policy "employees can update corporate group structure"
  on public.corporate_group_structure for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

create policy "employees can delete corporate group structure"
  on public.corporate_group_structure for delete
  using (public.is_active_employee());


-- ---------- Related Party Transactions (RPT) ----------
create type public.rpt_transaction_type as enum (
  'loan_given',
  'loan_taken',
  'sales_of_goods_services',
  'purchase_of_goods_services',
  'corporate_guarantee',
  'director_remuneration',
  'advances_given',
  'advances_received',
  'other'
);

create table public.related_party_transactions (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  related_party_name text not null,
  relationship_nature text not null, -- e.g. "Director", "Subsidiary", "Key Management"
  transaction_type public.rpt_transaction_type not null,
  amount numeric(18, 2) not null,
  financial_year text not null, -- e.g. "FY 2024-25"
  description text,
  is_material boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index related_party_transactions_borrower_idx on public.related_party_transactions (borrower_id);

alter table public.related_party_transactions enable row level security;

create policy "employees can view related party transactions"
  on public.related_party_transactions for select
  using (public.is_active_employee());

create policy "employees can insert related party transactions"
  on public.related_party_transactions for insert
  with check (public.is_active_employee());

create policy "employees can update related party transactions"
  on public.related_party_transactions for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

create policy "employees can delete related party transactions"
  on public.related_party_transactions for delete
  using (public.is_active_employee());


-- ---------- Corporate GST Returns & Analytics ----------
create type public.gst_return_type as enum (
  'gstr_1',
  'gstr_3b',
  'gstr_9',
  'annual_aggregate'
);

create table public.corporate_gst_records (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  gstin text not null,
  financial_year text not null, -- e.g. "FY 2024-25"
  return_type public.gst_return_type not null default 'gstr_3b',
  period_month text not null, -- e.g. "April", "Q1", "Annual"
  taxable_turnover numeric(18, 2) not null default 0,
  igst_amount numeric(18, 2) default 0,
  cgst_amount numeric(18, 2) default 0,
  sgst_amount numeric(18, 2) default 0,
  total_tax_paid numeric(18, 2) default 0,
  filing_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index corporate_gst_records_borrower_idx on public.corporate_gst_records (borrower_id);

alter table public.corporate_gst_records enable row level security;

create policy "employees can view corporate gst records"
  on public.corporate_gst_records for select
  using (public.is_active_employee());

create policy "employees can insert corporate gst records"
  on public.corporate_gst_records for insert
  with check (public.is_active_employee());

create policy "employees can update corporate gst records"
  on public.corporate_gst_records for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

create policy "employees can delete corporate gst records"
  on public.corporate_gst_records for delete
  using (public.is_active_employee());
