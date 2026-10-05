-- ============================================================
-- Support for Principal Moratorium & Advanced Repayment Modes
--
-- Adds moratorium_months and expands repayment_mode to support:
-- - 'bullet' (Interest only for 1..N-1 months, Bullet in month N)
-- - 'moratorium_emi' (Interest only for M months, then Reducing Balance EMI)
-- - 'moratorium_equal_principal' (Interest only for M months, then Equal Principal installments)
-- - 'emi' (Standard Reducing Balance EMI)
-- ============================================================

alter table public.loan_servicing_configs
  add column if not exists moratorium_months integer not null default 0;

-- Update repayment_mode check constraint
alter table public.loan_servicing_configs
  drop constraint if exists loan_servicing_configs_repayment_mode_check;

alter table public.loan_servicing_configs
  add constraint loan_servicing_configs_repayment_mode_check
  check (repayment_mode in ('bullet', 'emi', 'moratorium_emi', 'moratorium_equal_principal'));
