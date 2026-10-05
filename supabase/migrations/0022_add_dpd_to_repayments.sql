-- ============================================================
-- Migration 0022: Add DPD & Target Due Date to Repayments & Schedules
-- ============================================================

alter table if exists public.loan_repayments
  add column if not exists target_due_date date,
  add column if not exists dpd integer default 0;

alter table if exists public.loan_schedules
  add column if not exists dpd integer default 0;
