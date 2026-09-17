-- ============================================================
-- 0012: Add missing DELETE policies for loan_applications and approval_history
-- ============================================================

-- 1. Enable deletion on loan_applications for authenticated staff
drop policy if exists "employees can delete loan applications" on public.loan_applications;
drop policy if exists "Authenticated users can delete loan applications" on public.loan_applications;

create policy "Authenticated users can delete loan applications"
  on public.loan_applications for delete
  to authenticated
  using (true);

-- 2. Enable deletion on approval_history for authenticated staff
drop policy if exists "employees can delete approval history" on public.approval_history;
drop policy if exists "Authenticated users can delete approval history" on public.approval_history;

create policy "Authenticated users can delete approval history"
  on public.approval_history for delete
  to authenticated
  using (true);
