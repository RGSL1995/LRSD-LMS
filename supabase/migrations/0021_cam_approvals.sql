-- ============================================================
-- Migration 0021: Credit Appraisal Memo (CAM) Approvals & Sign-off Workflow
-- ============================================================

create table if not exists public.cam_approvals (
  id uuid primary key default gen_random_uuid(),
  cam_document_id uuid references public.cam_documents(id) on delete cascade,
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  approver_name text not null,
  approver_email text not null,
  approver_role text default 'Credit Committee Member',
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected', 'approved_with_conditions')),
  approval_token text not null unique,
  token_expires_at timestamptz,
  sent_at timestamptz,
  decision_at timestamptz,
  comments text,
  conditions text,
  digital_signature text,
  ip_address text,
  user_agent text,
  order_index integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cam_approvals_loan_app_idx on public.cam_approvals(loan_application_id);
create index if not exists cam_approvals_token_idx on public.cam_approvals(approval_token);
create index if not exists cam_approvals_email_idx on public.cam_approvals(approver_email);

alter table public.cam_approvals enable row level security;

-- Policies for authenticated staff
create policy "Authenticated users can select cam_approvals"
  on public.cam_approvals for select
  to authenticated
  using (true);

create policy "Authenticated users can insert cam_approvals"
  on public.cam_approvals for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update cam_approvals"
  on public.cam_approvals for update
  to authenticated
  using (true);

create policy "Authenticated users can delete cam_approvals"
  on public.cam_approvals for delete
  to authenticated
  using (true);

-- Policies for external committee reviewers (via token)
create policy "Anon users can select cam_approvals"
  on public.cam_approvals for select
  to anon
  using (true);

create policy "Anon users can update cam_approvals"
  on public.cam_approvals for update
  to anon
  using (true);
