import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/layout/nav-bar";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, unwrapRelation, type Relation } from "@/lib/utils";
import {
  Users,
  Building2,
  FileCheck2,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  PlusCircle,
  FolderOpen,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

type EmbeddedBorrower = {
  borrower_type?: string;
  individual_profiles: Relation<{ full_name: string }>;
  corporate_profiles: Relation<{ legal_name: string }>;
  other_profiles: Relation<{ entity_name: string }>;
};

function getBorrowerName(borrowers: Relation<EmbeddedBorrower> | null | undefined) {
  if (!borrowers) return "—";
  const borrower = unwrapRelation<EmbeddedBorrower>(borrowers);
  if (!borrower) return "—";
  const ind = unwrapRelation<{ full_name: string }>(borrower.individual_profiles);
  const corp = unwrapRelation<{ legal_name: string }>(borrower.corporate_profiles);
  const oth = unwrapRelation<{ entity_name: string }>(borrower.other_profiles);
  return ind?.full_name ?? corp?.legal_name ?? oth?.entity_name ?? "—";
}

function formatINR(amount: number) {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch employee profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  // Fetch borrowers summary
  const { data: borrowers } = await supabase
    .from("borrowers")
    .select(
      `id, borrower_code, borrower_type, status, created_at,
       individual_profiles ( full_name ),
       corporate_profiles ( legal_name ),
       other_profiles ( entity_name )`,
    )
    .order("created_at", { ascending: false });

  // Fetch loan applications
  const { data: loans } = await supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, status, created_at,
       borrowers (
         borrower_type,
         individual_profiles ( full_name ),
         corporate_profiles ( legal_name ),
         other_profiles ( entity_name )
       )`,
    )
    .order("created_at", { ascending: false });

  const totalBorrowers = borrowers?.length ?? 0;
  const corporateCount = borrowers?.filter((b) => b.borrower_type === "corporate").length ?? 0;
  const individualCount = borrowers?.filter((b) => b.borrower_type === "individual").length ?? 0;

  const totalLoans = loans?.length ?? 0;
  const totalVolume = loans?.reduce((sum, l) => sum + Number(l.requested_amount || 0), 0) ?? 0;
  const pendingLoans = loans?.filter((l) => l.status === "under_review" || l.status === "submitted").length ?? 0;
  const approvedLoans = loans?.filter((l) => l.status === "approved" || l.status === "disbursed").length ?? 0;

  const recentLoans = loans?.slice(0, 5) ?? [];
  const recentBorrowers = borrowers?.slice(0, 5) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Welcome & Quick Action Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Financial Operations Console
              </p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Officer"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Portfolio summary, active pipeline underwriting, and recent credit originations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/borrowers/new"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 h-9 text-xs font-semibold shadow-2xs hover:bg-muted/80",
              )}
            >
              <Building2 className="size-3.5 text-primary" />
              <span>New Borrower</span>
            </Link>
            <Link
              href="/loans/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 h-9 text-xs font-semibold shadow-xs",
              )}
            >
              <PlusCircle className="size-3.5" />
              <span>Originate Loan</span>
            </Link>
          </div>
        </div>

        {/* 4 Primary KPI Executive Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Portfolio Volume */}
          <Card className="card-hover border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Loan Pipeline Volume
                </span>
                <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block">
                  {formatINR(totalVolume)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 font-medium">
                  Across {totalLoans} total applications
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Registered Borrowers */}
          <Card className="card-hover border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-primary/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Borrowers
                </span>
                <div className="size-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block">
                  {totalBorrowers}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 font-medium">
                  <span>{corporateCount} Corporate</span>
                  <span>&middot;</span>
                  <span>{individualCount} Individual</span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Pending Appraisals */}
          <Card className="card-hover border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Pending Underwriting
                </span>
                <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Clock className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block">
                  {pendingLoans}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
                  Awaiting credit committee review
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Approvals & Disbursed */}
          <Card className="card-hover border-border/80 shadow-xs relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 size-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Approved &amp; Disbursed
                </span>
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="size-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold tracking-tight text-foreground block">
                  {approvedLoans}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
                  Sanctioned facilities
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Callout: Deterministic Corporate Intelligence Report Ingest */}
        <Card className="bg-gradient-to-r from-blue-900/10 via-primary/5 to-background border-primary/20 shadow-xs">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm shrink-0">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Fast Corporate Appraisal &amp; Intelligence Dossier Parser
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                  Extract legal entity profile, 12 directors, 87 open charges, 80 subsidiaries, financial statements, peer comparisons, and compliance checks in under 400ms.
                </p>
              </div>
            </div>
            <Link
              href="/borrowers/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 text-xs font-semibold shrink-0 shadow-xs",
              )}
            >
              Start Corporate Onboarding <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Live Feeds: Recent Loan Applications & Recent Borrowers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Loan Applications Table (2 Columns on Large Screens) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileCheck2 className="size-4 text-primary" /> Active Loan Pipeline
                </h2>
                <p className="text-xs text-muted-foreground">
                  Latest credit facility applications and underwriting statuses
                </p>
              </div>
              <Link
                href="/loans"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                View all loans <ArrowUpRight className="size-3" />
              </Link>
            </div>

            <Card className="border-border/80 shadow-xs overflow-hidden">
              {recentLoans.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                      <tr>
                        <th className="px-4 py-2.5 text-left">App #</th>
                        <th className="px-4 py-2.5 text-left">Borrower Entity</th>
                        <th className="px-4 py-2.5 text-right">Requested Amount</th>
                        <th className="px-4 py-2.5 text-center">Stage</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recentLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-primary">
                            <Link href={`/loans/${loan.id}`} className="hover:underline">
                              {loan.application_code}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {getBorrowerName(loan.borrowers)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            {formatINR(Number(loan.requested_amount || 0))}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0.5 font-semibold capitalize",
                                loan.status === "approved" || loan.status === "disbursed"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : loan.status === "under_review" || loan.status === "submitted"
                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                    : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
                              )}
                            >
                              {loan.status.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/loans/${loan.id}`}
                              className="text-muted-foreground hover:text-foreground font-medium text-[11px] inline-flex items-center gap-1"
                            >
                              Details <ArrowRight className="size-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <FileCheck2 className="size-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No loan applications yet</p>
                  <p className="text-xs mt-0.5">Originate your first credit application to start tracking underwriting.</p>
                  <Link
                    href="/loans/new"
                    className={cn(buttonVariants({ size: "sm" }), "mt-3 gap-1.5 text-xs")}
                  >
                    <PlusCircle className="size-3.5" /> New Origination
                  </Link>
                </div>
              )}
            </Card>
          </div>

          {/* Recent Borrowers Stream (1 Column) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Recent Borrowers
                </h2>
                <p className="text-xs text-muted-foreground">
                  Latest onboarded customer dossiers
                </p>
              </div>
              <Link
                href="/borrowers"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                All borrowers <ArrowUpRight className="size-3" />
              </Link>
            </div>

            <Card className="border-border/80 shadow-xs divide-y">
              {recentBorrowers.length > 0 ? (
                recentBorrowers.map((borrower) => {
                  const name =
                    borrower.borrower_type === "individual"
                      ? unwrapRelation(borrower.individual_profiles)?.full_name
                      : borrower.borrower_type === "corporate"
                        ? unwrapRelation(borrower.corporate_profiles)?.legal_name
                        : unwrapRelation(borrower.other_profiles)?.entity_name;

                  return (
                    <Link
                      key={borrower.id}
                      href={`/borrowers/${borrower.id}`}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors group block"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                          {borrower.borrower_type === "corporate" ? (
                            <Building2 className="size-4" />
                          ) : (
                            <Users className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate max-w-[160px] group-hover:text-primary transition-colors">
                            {name || "Untitled Borrower"}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            {borrower.borrower_code} &middot;{" "}
                            <span className="capitalize">{borrower.borrower_type}</span>
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0 h-4">
                        {borrower.status}
                      </Badge>
                    </Link>
                  );
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="size-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No registered borrowers</p>
                  <p className="text-xs mt-0.5">Add a new borrower to start creating loan files.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
