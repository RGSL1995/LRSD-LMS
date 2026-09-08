-- ============================================================
-- Loan Management System — Row Level Security
-- Internal tool: every active employee (Executive or Approver)
-- can read all records. Writes are scoped by role where the
-- workflow requires it (e.g. only Approver records an approval
-- decision). Refine further as more roles/workflows are added.
-- ============================================================

-- ---------- Helper functions (security definer to avoid RLS recursion) ----------

create or replace function public.is_active_employee()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

create or replace function public.current_employee_role()
returns public.employee_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- Enable RLS ----------

alter table public.profiles enable row level security;
alter table public.borrowers enable row level security;
alter table public.individual_profiles enable row level security;
alter table public.corporate_profiles enable row level security;
alter table public.corporate_associates enable row level security;
alter table public.other_profiles enable row level security;
alter table public.borrower_contacts enable row level security;
alter table public.loan_products enable row level security;
alter table public.loan_applications enable row level security;
alter table public.approval_history enable row level security;
alter table public.loans enable row level security;
alter table public.loan_disbursements enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.audit_logs enable row level security;

-- ---------- profiles ----------

create policy "employees can view all profiles"
  on public.profiles for select
  using (public.is_active_employee());

create policy "employees can update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert/delete policy for regular employees: profile rows are
-- created by the on_auth_user_created trigger (security definer).

-- ---------- borrowers ----------

create policy "employees can view borrowers"
  on public.borrowers for select
  using (public.is_active_employee());

create policy "employees can create borrowers"
  on public.borrowers for insert
  with check (public.is_active_employee() and created_by = auth.uid());

create policy "employees can update borrowers"
  on public.borrowers for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

-- ---------- individual_profiles / corporate_profiles / other_profiles ----------

create policy "employees can view individual profiles"
  on public.individual_profiles for select
  using (public.is_active_employee());
create policy "employees can manage individual profiles"
  on public.individual_profiles for insert
  with check (public.is_active_employee());
create policy "employees can update individual profiles"
  on public.individual_profiles for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

create policy "employees can view corporate profiles"
  on public.corporate_profiles for select
  using (public.is_active_employee());
create policy "employees can insert corporate profiles"
  on public.corporate_profiles for insert
  with check (public.is_active_employee());
create policy "employees can update corporate profiles"
  on public.corporate_profiles for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

create policy "employees can view other profiles"
  on public.other_profiles for select
  using (public.is_active_employee());
create policy "employees can insert other profiles"
  on public.other_profiles for insert
  with check (public.is_active_employee());
create policy "employees can update other profiles"
  on public.other_profiles for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

-- ---------- corporate_associates ----------

create policy "employees can view corporate associates"
  on public.corporate_associates for select
  using (public.is_active_employee());
create policy "employees can insert corporate associates"
  on public.corporate_associates for insert
  with check (public.is_active_employee());
create policy "employees can update corporate associates"
  on public.corporate_associates for update
  using (public.is_active_employee())
  with check (public.is_active_employee());
create policy "employees can delete corporate associates"
  on public.corporate_associates for delete
  using (public.is_active_employee());

-- ---------- borrower_contacts ----------

create policy "employees can view borrower contacts"
  on public.borrower_contacts for select
  using (public.is_active_employee());
create policy "employees can insert borrower contacts"
  on public.borrower_contacts for insert
  with check (public.is_active_employee());
create policy "employees can update borrower contacts"
  on public.borrower_contacts for update
  using (public.is_active_employee())
  with check (public.is_active_employee());
create policy "employees can delete borrower contacts"
  on public.borrower_contacts for delete
  using (public.is_active_employee());

-- ---------- loan_products ----------

create policy "employees can view loan products"
  on public.loan_products for select
  using (public.is_active_employee());

-- Loan products are managed manually (SQL editor / future admin role)
-- for now; no insert/update/delete policy for regular employees.

-- ---------- loan_applications ----------

create policy "employees can view loan applications"
  on public.loan_applications for select
  using (public.is_active_employee());

create policy "employees can create loan applications"
  on public.loan_applications for insert
  with check (public.is_active_employee() and created_by = auth.uid());

create policy "employees can update loan applications"
  on public.loan_applications for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

-- ---------- approval_history ----------

create policy "employees can view approval history"
  on public.approval_history for select
  using (public.is_active_employee());

create policy "approvers can record approval decisions"
  on public.approval_history for insert
  with check (
    public.current_employee_role() = 'approver'
    and approver_id = auth.uid()
  );

-- ---------- loans ----------

create policy "employees can view loans"
  on public.loans for select
  using (public.is_active_employee());

create policy "employees can create loans"
  on public.loans for insert
  with check (public.is_active_employee() and created_by = auth.uid());

create policy "employees can update loans"
  on public.loans for update
  using (public.is_active_employee())
  with check (public.is_active_employee());

-- ---------- loan_disbursements ----------

create policy "employees can view disbursements"
  on public.loan_disbursements for select
  using (public.is_active_employee());

create policy "employees can record disbursements"
  on public.loan_disbursements for insert
  with check (public.is_active_employee() and created_by = auth.uid());

-- ---------- loan_repayments ----------

create policy "employees can view repayments"
  on public.loan_repayments for select
  using (public.is_active_employee());

create policy "employees can record repayments"
  on public.loan_repayments for insert
  with check (public.is_active_employee() and created_by = auth.uid());

-- ---------- audit_logs ----------

create policy "employees can view audit logs"
  on public.audit_logs for select
  using (public.is_active_employee());

create policy "employees can write audit logs"
  on public.audit_logs for insert
  with check (public.is_active_employee() and user_id = auth.uid());

-- No update/delete policy on audit_logs for anyone: audit trail is
-- append-only at the application layer.
