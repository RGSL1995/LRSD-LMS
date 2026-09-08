-- Canonical PAN on the common borrowers table so loan origination can
-- search a single indexed column regardless of borrower type. Type-specific
-- tables keep their own pan field too (kept in sync on create).

alter table public.borrowers add column pan text;

create unique index borrowers_pan_key on public.borrowers (pan) where pan is not null;
