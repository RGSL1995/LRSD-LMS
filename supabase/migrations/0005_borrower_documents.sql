-- ============================================================
-- Borrower documents: KYC and Financial document uploads,
-- captured as Step 2 / Step 3 of the borrower profiling wizard.
-- Files live in Supabase Storage; this table holds metadata.
-- ============================================================

create type public.document_stage as enum ('kyc', 'financial');

create type public.document_category as enum (
  'pan_card',
  'identity_proof',
  'address_proof',
  'photograph',
  'company_incorporation_docs',
  'gst_certificate',
  'shareholder_director_list',
  'itr_or_form16',
  'salary_slips',
  'bank_statement',
  'balance_sheet_pl',
  'net_worth_certificate',
  'other'
);

create table public.borrower_documents (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.borrowers (id) on delete cascade,
  stage public.document_stage not null,
  category public.document_category not null,
  file_name text not null,
  storage_path text not null,
  content_type text,
  file_size bigint,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

create index borrower_documents_borrower_idx on public.borrower_documents (borrower_id);
create index borrower_documents_stage_idx on public.borrower_documents (borrower_id, stage);

alter table public.borrower_documents enable row level security;

create policy "employees can view borrower documents"
  on public.borrower_documents for select
  using (public.is_active_employee());

create policy "employees can upload borrower documents"
  on public.borrower_documents for insert
  with check (public.is_active_employee() and uploaded_by = auth.uid());

create policy "employees can delete borrower documents"
  on public.borrower_documents for delete
  using (public.is_active_employee());

-- ---------- Storage bucket ----------

insert into storage.buckets (id, name, public)
values ('borrower-documents', 'borrower-documents', false)
on conflict (id) do nothing;

create policy "employees can read borrower document files"
  on storage.objects for select
  using (bucket_id = 'borrower-documents' and public.is_active_employee());

create policy "employees can upload borrower document files"
  on storage.objects for insert
  with check (bucket_id = 'borrower-documents' and public.is_active_employee());

create policy "employees can delete borrower document files"
  on storage.objects for delete
  using (bucket_id = 'borrower-documents' and public.is_active_employee());
