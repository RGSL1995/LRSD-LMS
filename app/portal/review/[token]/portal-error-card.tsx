"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldAlert, FileText, Database, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface PortalErrorCardProps {
  error?: string;
}

const MIGRATION_SQL = `-- 1. Ensure loan_applications has facility terms and portal columns
alter table public.loan_applications
  add column if not exists tenure_months integer,
  add column if not exists facility_type text,
  add column if not exists portal_token text unique,
  add column if not exists portal_status text not null default 'pending',
  add column if not exists borrower_reviewed_at timestamptz,
  add column if not exists borrower_review_notes text;

create index if not exists loan_applications_portal_token_idx
  on public.loan_applications (portal_token);

-- 2. Multi-Party Association Table
create table if not exists public.loan_application_parties (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  borrower_id uuid not null references public.borrowers(id) on delete cascade,
  party_role text not null default 'co_borrower',
  guarantee_type text,
  is_primary boolean not null default false,
  is_guarantor boolean not null default false,
  is_security_provider boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.loan_application_parties
  drop constraint if exists loan_application_parties_party_role_check;

alter table public.loan_application_parties
  add constraint loan_application_parties_party_role_check
  check (party_role in ('primary_borrower', 'co_borrower', 'guarantor', 'security_provider'));

-- 3. Collateral & Security Details Table
create table if not exists public.loan_collaterals (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  collateral_type text not null,
  charge_type text,
  property_status text,
  address text,
  city text,
  pincode text,
  estimated_value numeric(16, 2),
  details text,
  pledgor_borrower_id uuid references public.borrowers(id) on delete set null,
  pledgor_name text,
  pledgor_pan text,
  created_at timestamptz not null default now()
);

-- 4. Extend borrower_documents for portal uploads
alter table public.borrower_documents
  alter column uploaded_by drop not null;

alter table public.borrower_documents
  alter column category type text;

alter table public.borrower_documents
  add column if not exists loan_application_id uuid references public.loan_applications (id) on delete cascade,
  add column if not exists uploaded_by_borrower boolean not null default false;

-- 5. Enable Row-Level Security
alter table public.loan_applications enable row level security;
alter table public.loan_application_parties enable row level security;
alter table public.loan_collaterals enable row level security;
alter table public.borrowers enable row level security;
alter table public.individual_profiles enable row level security;
alter table public.corporate_profiles enable row level security;
alter table public.other_profiles enable row level security;
alter table public.borrower_documents enable row level security;

-- 6. Row-Level Security Policies for Authenticated Employees
drop policy if exists "employees can view loan applications" on public.loan_applications;
create policy "employees can view loan applications"
  on public.loan_applications for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can select loan_application_parties"
  on public.loan_application_parties for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can insert loan_application_parties"
  on public.loan_application_parties for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can update loan_application_parties"
  on public.loan_application_parties for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete loan_application_parties" on public.loan_application_parties;
create policy "Authenticated users can delete loan_application_parties"
  on public.loan_application_parties for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can select loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can select loan_collaterals"
  on public.loan_collaterals for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can insert loan_collaterals"
  on public.loan_collaterals for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can update loan_collaterals"
  on public.loan_collaterals for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete loan_collaterals" on public.loan_collaterals;
create policy "Authenticated users can delete loan_collaterals"
  on public.loan_collaterals for delete
  to authenticated
  using (true);

-- 7. Row-Level Security Policies for External/Anonymous Borrower Portal Review
drop policy if exists "allow public review of loan application via portal_token" on public.loan_applications;
create policy "allow public review of loan application via portal_token"
  on public.loan_applications for select
  to anon, authenticated
  using (portal_token is not null);

drop policy if exists "allow public update of loan application review status" on public.loan_applications;
create policy "allow public update of loan application review status"
  on public.loan_applications for update
  to anon, authenticated
  using (portal_token is not null)
  with check (portal_token is not null);

drop policy if exists "allow public read of borrowers for portal" on public.borrowers;
create policy "allow public read of borrowers for portal"
  on public.borrowers for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of individual profiles for portal" on public.individual_profiles;
create policy "allow public read of individual profiles for portal"
  on public.individual_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of corporate profiles for portal" on public.corporate_profiles;
create policy "allow public read of corporate profiles for portal"
  on public.corporate_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of other profiles for portal" on public.other_profiles;
create policy "allow public read of other profiles for portal"
  on public.other_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of loan application parties for portal" on public.loan_application_parties;
create policy "allow public read of loan application parties for portal"
  on public.loan_application_parties for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read of loan collaterals for portal" on public.loan_collaterals;
create policy "allow public read of loan collaterals for portal"
  on public.loan_collaterals for select
  to anon, authenticated
  using (true);

drop policy if exists "allow public read and insert of borrower documents for portal" on public.borrower_documents;
create policy "allow public read and insert of borrower documents for portal"
  on public.borrower_documents for all
  to anon, authenticated
  using (true)
  with check (true);

-- 8. Storage bucket policies for borrower-documents uploads
insert into storage.buckets (id, name, public)
values ('borrower-documents', 'borrower-documents', false)
on conflict (id) do nothing;

drop policy if exists "allow portal uploads to borrower documents" on storage.objects;
create policy "allow portal uploads to borrower documents"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'borrower-documents');

drop policy if exists "allow portal reads from borrower documents" on storage.objects;
create policy "allow portal reads from borrower documents"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'borrower-documents');

drop policy if exists "allow portal deletes from borrower documents" on storage.objects;
create policy "allow portal deletes from borrower documents"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'borrower-documents');`;

export function PortalErrorCard({ error }: PortalErrorCardProps) {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MIGRATION_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="max-w-lg w-full border-destructive/20 shadow-lg">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto size-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Access Link Invalid or Expired
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400 text-xs">
            {error || "The review link you opened is either invalid, tampered, or has expired."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 text-center text-xs text-muted-foreground">
          <p>
            Review links are protected with cryptographic tokens to ensure facility confidentiality and data security.
          </p>

          <div className="p-3 bg-muted/40 rounded-lg border text-left space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
              What can you do?
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground">
              <li>Check that you pasted the entire URL without missing characters.</li>
              <li>Contact your dedicated Relationship Manager to request an updated review link.</li>
              <li>If you are an internal lending officer, log in to the lending management console.</li>
            </ul>
          </div>

          {/* Database Setup Accordion for Admins / Developers */}
          <div className="pt-2 text-left">
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="flex items-center justify-between w-full p-2.5 rounded-lg border bg-card text-foreground font-semibold text-xs hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                <span>Administrator / Database Setup (Migration 0014)</span>
              </div>
              {showSql ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {showSql && (
              <div className="mt-2 p-3 rounded-lg border bg-muted/20 space-y-2 text-xs">
                <p className="text-muted-foreground text-[11px]">
                  If this is a new environment, execute migration <strong>0014</strong> in your Supabase SQL Editor to enable public review columns and Row-Level Security policies:
                </p>
                <div className="relative">
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto max-h-48">
                    {MIGRATION_SQL}
                  </pre>
                  <Button
                    size="xs"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 text-[10px] h-6 px-2 gap-1 bg-white/20 hover:bg-white/30 text-white border-0 shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        Copy SQL
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Alternatively, you can add <code>SUPABASE_SERVICE_ROLE_KEY=your-service-role-key</code> to <code>.env.local</code> to allow server-side bypass.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1"
            >
              <FileText className="size-3.5" />
              Lending Operations Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
