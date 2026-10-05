import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/layout/nav-bar";
import { buttonVariants } from "@/components/ui/button";
import { LoanSubNav } from "@/components/loans/loan-subnav";
import { LoansTable, type LoanRow } from "./loans-table";
import { cn } from "@/lib/utils";
import { PlusCircle, ArrowLeft } from "lucide-react";

export default async function LoanApplicationsPage() {
  const supabase = await createClient();

  // Fetch count of active facilities for subnav badge
  const { count: activeCount } = await supabase
    .from("loans")
    .select("*", { count: "exact", head: true });

  const { data: applications, error } = await supabase
    .from("loan_applications")
    .select(
      `*,
       borrowers (
         borrower_type,
         individual_profiles ( full_name ),
         corporate_profiles ( legal_name ),
         other_profiles ( entity_name )
       )`,
    )
    .order("created_at", { ascending: false });

  const pipelineCount = applications?.length ?? 0;

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
              <span className="text-xs font-semibold text-primary">Originations</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              Loan Applications Pipeline
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Track multi-stage credit underwriting, credit committee approvals, and disbursement status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/loans/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 h-9 text-xs font-semibold shadow-xs",
              )}
            >
              <PlusCircle className="size-3.5" />
              <span>New Origination</span>
            </Link>
          </div>
        </div>

        {/* Sub-Navigation Pill Switcher */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <LoanSubNav
            pipelineCount={pipelineCount}
            activeCount={activeCount ?? 0}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium">
            {error.message}
          </div>
        )}

        {/* Loans Table */}
        <LoansTable loans={(applications as unknown as LoanRow[]) || []} />
      </main>
    </div>
  );
}

