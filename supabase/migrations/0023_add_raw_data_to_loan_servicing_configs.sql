-- Migration: 0023_add_raw_data_to_loan_servicing_configs.sql
-- Description: Adds raw_data jsonb column to loan_servicing_configs to store custom daily ledger segments and servicing metadata.

alter table if exists public.loan_servicing_configs 
add column if not exists raw_data jsonb default '{}'::jsonb;

-- Also ensure loan_repayments has target_due_date and dpd columns
alter table if exists public.loan_repayments
add column if not exists target_due_date date,
add column if not exists dpd integer default 0;

-- Refresh schema cache notification
comment on column public.loan_servicing_configs.raw_data is 'Stores JSON metadata and daily running interest ledger entries';
