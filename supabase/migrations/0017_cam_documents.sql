-- ============================================================
-- Credit Appraisal Memo (CAM) data storage.
--
-- The CAM template mixes two kinds of content:
--  1. Data already captured elsewhere in the system (borrower profile,
--     loan terms, security/collateral, KYC) - pulled live at generation
--     time, not duplicated here.
--  2. Data with no source in the system today - CIBIL/credit bureau
--     figures, bank statement analysis, Google search checks, litigation,
--     underwriting judgment, risk & mitigation, verification remarks.
--     That's what these tables hold, entered manually by the credit team.
-- ============================================================

create table public.cam_documents (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,

  about_company_text text,
  promoter_profiles jsonb not null default '[]'::jsonb,   -- [{ name, din, text }]
  underwriting_justification text,
  risks jsonb not null default '[]'::jsonb,              -- [{ risk, mitigate }]
  google_search_results jsonb not null default '[]'::jsonb, -- [{ party_name, result }]
  verification jsonb not null default '[]'::jsonb,        -- [{ particular, remark }]

  prepared_by text,
  approved_by text,

  status text not null default 'draft' check (status in ('draft', 'finalized')),
  generated_storage_path text,
  generated_at timestamptz,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cam_documents_loan_application_idx
  on public.cam_documents (loan_application_id);

-- Per-party (borrower or guarantor) credit bureau / banking data. One row
-- per party per CAM - a party with no manually-entered data simply has no row.
create table public.cam_party_credit_data (
  id uuid primary key default gen_random_uuid(),
  cam_document_id uuid not null references public.cam_documents(id) on delete cascade,
  borrower_id uuid not null references public.borrowers(id) on delete cascade,

  cibil_score text,
  cibil_overdue text,
  cibil_dpd text,
  cibil_enquiries_3m text,
  cibil_loans_3m text,
  cibil_remarks text,

  banking_analysis jsonb not null default '[]'::jsonb,   -- [{ month, day5, day15, day25, monthEndBalance }]
  credit_facilities jsonb not null default '[]'::jsonb,  -- [{ type, ownership, date, sanction, pos, dpd }]
  itr_data jsonb not null default '[]'::jsonb,            -- [{ incomeHead, values: { year: amount } }]

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cam_party_credit_data_unique_idx
  on public.cam_party_credit_data (cam_document_id, borrower_id);

alter table public.cam_documents enable row level security;
alter table public.cam_party_credit_data enable row level security;

create policy "Authenticated users can select cam_documents"
  on public.cam_documents for select
  to authenticated
  using (true);

create policy "Authenticated users can insert cam_documents"
  on public.cam_documents for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update cam_documents"
  on public.cam_documents for update
  to authenticated
  using (true);

create policy "Authenticated users can delete cam_documents"
  on public.cam_documents for delete
  to authenticated
  using (true);

create policy "Authenticated users can select cam_party_credit_data"
  on public.cam_party_credit_data for select
  to authenticated
  using (true);

create policy "Authenticated users can insert cam_party_credit_data"
  on public.cam_party_credit_data for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update cam_party_credit_data"
  on public.cam_party_credit_data for update
  to authenticated
  using (true);

create policy "Authenticated users can delete cam_party_credit_data"
  on public.cam_party_credit_data for delete
  to authenticated
  using (true);
