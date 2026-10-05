-- ============================================================
-- 0013_security_providers_and_pledgor_link.sql
-- Add 'security_provider' to loan_application_parties,
-- add dual-role obligation flags (is_guarantor, is_security_provider),
-- and link loan_collaterals to pledgor/borrower entity.
-- ============================================================

-- 1. Update party_role check constraint on public.loan_application_parties
alter table public.loan_application_parties
  drop constraint if exists loan_application_parties_party_role_check;

alter table public.loan_application_parties
  add constraint loan_application_parties_party_role_check
  check (party_role in ('primary_borrower', 'co_borrower', 'guarantor', 'security_provider'));

-- 2. Add dual-role capability flags to loan_application_parties
alter table public.loan_application_parties
  add column if not exists is_guarantor boolean not null default false,
  add column if not exists is_security_provider boolean not null default false;

-- Populate default flags for existing records
update public.loan_application_parties
  set is_guarantor = true
  where party_role = 'guarantor' and is_guarantor = false;

-- 3. Extend public.loan_collaterals with pledgor borrower reference
alter table public.loan_collaterals
  add column if not exists pledgor_borrower_id uuid references public.borrowers(id) on delete set null,
  add column if not exists pledgor_name text,
  add column if not exists pledgor_pan text;

create index if not exists loan_collaterals_pledgor_idx
  on public.loan_collaterals (pledgor_borrower_id);
