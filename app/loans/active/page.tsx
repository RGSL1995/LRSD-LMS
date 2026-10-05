import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/layout/nav-bar";
import { LoanSubNav } from "@/components/loans/loan-subnav";
import { BookFacilityDialog } from "./book-facility-dialog";
import { ActiveLoansTable, type ActiveLoanRow } from "./active-loans-table";
import { Card, CardContent } from "@/components/ui/card";
import { unwrapRelation, type Relation } from "@/lib/utils";
import {
  Landmark,
  TrendingUp,
  CreditCard,
  Building2,
  Clock,
  ArrowLeft,
  Percent,
} from "lucide-react";

type EmbeddedBorrower = {
  id: string;
  borrower_code?: string;
  borrower_type: string;
  pan?: string | null;
  avatar_url?: string | null;
  individual_profiles: Relation<{ full_name: string }>;
  corporate_profiles: Relation<{ legal_name: string }>;
  other_profiles: Relation<{ entity_name: string }>;
};

function formatINR(amount: number) {
  if (isNaN(amount) || amount <= 0) return "₹ 0";
  if (amount >= 10000000) {
    return `₹ ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹ ${(amount / 100000).toFixed(2)} L`;
  }
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

export default async function ActiveLoansPage() {
  const supabase = await createClient();

  // 1. Fetch count of pipeline applications for subnav badge
  const { count: pipelineCount } = await supabase
    .from("loan_applications")
    .select("*", { count: "exact", head: true });

  // 2. Fetch all loans with borrowers, applications, disbursements, and repayments
  const { data: loansData, error } = await supabase
    .from("loans")
    .select(
      `id, loan_code, sanctioned_amount, interest_rate, tenure_months, status, sanctioned_at,
       borrower_id, loan_application_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name ),
         corporate_profiles ( legal_name ),
         other_profiles ( entity_name )
       ),
       loan_applications (
         application_code, purpose
       ),
       loan_disbursements (
         id, amount
       ),
       loan_repayments (
         id, amount
       )`
    )
    .order("created_at", { ascending: false });

  // Map into ActiveLoanRow objects
  const loans: ActiveLoanRow[] = (loansData || []).map((l) => {
    const rawBorrower = unwrapRelation<EmbeddedBorrower>(l.borrowers as unknown as Relation<EmbeddedBorrower>);
    const ind = unwrapRelation<{ full_name: string }>(rawBorrower?.individual_profiles);
    const corp = unwrapRelation<{ legal_name: string }>(rawBorrower?.corporate_profiles);
    const oth = unwrapRelation<{ entity_name: string }>(rawBorrower?.other_profiles);
    const borrowerName = ind?.full_name ?? corp?.legal_name ?? oth?.entity_name ?? rawBorrower?.borrower_code ?? "—";

    const app = unwrapRelation<{ application_code: string; facility_type?: string | null }>(
      l.loan_applications as unknown as Relation<{ application_code: string; facility_type?: string | null }>
    );

    const disbursements = (l.loan_disbursements as Array<{ id: string; amount: number }>) || [];
    const repayments = (l.loan_repayments as Array<{ id: string; amount: number }>) || [];

    const totalDisbursed = disbursements.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalRepaid = repayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const outstanding = Math.max(0, totalDisbursed - totalRepaid);

    return {
      id: l.id,
      loan_code: l.loan_code,
      loan_application_id: l.loan_application_id,
      application_code: app?.application_code || "—",
      borrower_id: l.borrower_id,
      borrower_name: borrowerName,
      borrower_code: rawBorrower?.borrower_code ?? "—",
      borrower_type: rawBorrower?.borrower_type ?? "corporate",
      pan: rawBorrower?.pan ?? null,
      sanctioned_amount: Number(l.sanctioned_amount || 0),
      interest_rate: l.interest_rate ? Number(l.interest_rate) : null,
      tenure_months: l.tenure_months,
      status: l.status,
      sanctioned_at: l.sanctioned_at,
      facility_type: app?.facility_type,
      total_disbursed: totalDisbursed,
      total_repaid: totalRepaid,
      outstanding_principal: outstanding,
      disbursements_count: disbursements.length,
      repayments_count: repayments.length,
    };
  });

  // KPI Calculations
  const activeLoans = loans.filter((l) => l.status === "active");
  const totalSanctioned = activeLoans.reduce((sum, l) => sum + l.sanctioned_amount, 0);
  const totalDisbursed = activeLoans.reduce((sum, l) => sum + l.total_disbursed, 0);
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + l.outstanding_principal, 0);

  // Weighted average interest rate
  const weightedRateSum = activeLoans.reduce((sum, l) => sum + (l.interest_rate || 0) * l.sanctioned_amount, 0);
  const weightedRate = totalSanctioned > 0 ? (weightedRateSum / totalSanctioned).toFixed(2) : "—";

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="size-3" /> Dashboard
              </Link>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Loan Management (LMS)
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              Active Loan Facilities
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Live facility ledger, tranche drawdowns, portfolio principal recovery, and servicing status.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <BookFacilityDialog />
          </div>
        </div>

        {/* Sub-Navigation Pill Switcher */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <LoanSubNav
            pipelineCount={pipelineCount ?? 0}
            activeCount={loans.length}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium">
            {error.message}
          </div>
        )}

        {/* Portfolio KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Sanctioned Book (AUM) */}
          <Card className="border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Active Sanctioned Book (AUM)
                </span>
                <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block font-mono">
                  {formatINR(totalSanctioned)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 font-medium">
                  Across {activeLoans.length} active facilities
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Total Disbursed Capital */}
          <Card className="border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Disbursed Capital
                </span>
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block font-mono">
                  {formatINR(totalDisbursed)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                  {totalSanctioned > 0
                    ? `${Math.round((totalDisbursed / totalSanctioned) * 100)}% of total sanctioned book drawn`
                    : "Awaiting first disbursement"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Principal Outstanding at Risk */}
          <Card className="border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Principal Outstanding
                </span>
                <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Landmark className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block font-mono">
                  {formatINR(totalOutstanding)}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                  Current net credit risk exposure
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Weighted Yield */}
          <Card className="border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Portfolio Yield (W.Avg)
                </span>
                <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <Percent className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block font-mono">
                  {weightedRate !== "—" ? `${weightedRate}%` : "—"}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                  Annualized effective portfolio yield
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Facilities Table */}
        <ActiveLoansTable loans={loans} />
      </main>
    </div>
  );
}
