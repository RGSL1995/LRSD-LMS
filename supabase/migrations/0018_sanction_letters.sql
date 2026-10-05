-- ============================================================
-- Sanction Letter data storage (LRSD Securities Pvt Ltd format).
--
-- Stores customized facility terms, conditions precedent (CPs),
-- conditions subsequent (CSs), interest rates, legal fees,
-- margin call triggers, cash top-up tiers, repayment schedule,
-- and authorized signatory details for official Sanction Letters.
-- ============================================================

create table if not exists public.sanction_documents (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,

  sanction_letter_ref text,
  sanction_date date default current_date,
  validity_days integer default 30,

  sanctioned_amount numeric(16, 2),
  interest_rate_text text,
  processing_fee_text text,
  penal_interest_text text,
  tenure_months integer,
  repayment_terms text,

  security_cover_text text,
  margin_call_text text,
  liquidation_text text,

  pre_disbursement_conditions jsonb not null default '[]'::jsonb,  -- [string]
  post_disbursement_conditions jsonb not null default '[]'::jsonb, -- [string]
  special_conditions jsonb not null default '[]'::jsonb,           -- [string]

  authorized_signatory_1 text,
  authorized_signatory_2 text,

  raw_data jsonb not null default '{}'::jsonb, -- stores all rich sanction parameters & custom clauses

  status text not null default 'draft' check (status in ('draft', 'issued', 'accepted')),
  generated_storage_path text,
  generated_at timestamptz,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sanction_documents_loan_application_idx
  on public.sanction_documents (loan_application_id);

alter table public.sanction_documents enable row level security;

create policy "Authenticated users can select sanction_documents"
  on public.sanction_documents for select
  to authenticated
  using (true);

create policy "Authenticated users can insert sanction_documents"
  on public.sanction_documents for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update sanction_documents"
  on public.sanction_documents for update
  to authenticated
  using (true);

create policy "Authenticated users can delete sanction_documents"
  on public.sanction_documents for delete
  to authenticated
  using (true);
