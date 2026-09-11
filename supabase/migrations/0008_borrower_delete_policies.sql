-- ============================================================
-- Add missing delete policies for borrowers and profiles
-- ============================================================

create policy "employees can delete borrowers"
  on public.borrowers for delete
  using (public.is_active_employee());

create policy "employees can delete individual profiles"
  on public.individual_profiles for delete
  using (public.is_active_employee());

create policy "employees can delete corporate profiles"
  on public.corporate_profiles for delete
  using (public.is_active_employee());

create policy "employees can delete other profiles"
  on public.other_profiles for delete
  using (public.is_active_employee());
