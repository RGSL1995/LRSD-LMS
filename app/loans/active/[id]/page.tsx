import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/layout/nav-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { unwrapRelation, type Relation } from "@/lib/utils";
import {
  ArrowLeft,
  Landmark,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  TrendingUp,
  Percent,
  ShieldCheck,
  FileText,
  AlertCircle,
  Plus,
  Layers,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LASSecuritiesTable } from "@/app/loans/new/las-securities-table";
import {
  type LASSecurityItem,
  calculateCoverageRatio,
  getCoverageStatus,
} from "@/app/loans/las-types";

type EmbeddedBorrower = {
  id: string;
  borrower_code?: string;
  borrower_type: string;
  pan?: string | null;
  individual_profiles: Relation<{ full_name: string; phone?: string | null; email?: string | null }>;
  corporate_profiles: Relation<{ legal_name: string; trade_name?: string | null; pan?: string | null; cin?: string | null; gstin?: string | null; registered_office_address?: string | null }>;
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

export default async function LoanServicingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch Loan with borrower, application, disbursements, and repayments
  const { data: loan, error } = await supabase
    .from("loans")
    .select(
      `id, loan_code, sanctioned_amount, interest_rate, tenure_months, status, sanctioned_at, created_at,
       borrower_id, loan_application_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name, phone, email ),
         corporate_profiles ( legal_name, trade_name, pan, cin, gstin, registered_office_address ),
         other_profiles ( entity_name )
       ),
       loan_applications (
         id, application_code, purpose, requested_amount
       ),
       loan_disbursements (
         id, amount, disbursed_at, reference_number
       )`
    )
    .eq("id", id)
    .single();

  if (error || !loan) {
    notFound();
  }

  type RepaymentRow = { id: string; amount: number; paid_at: string; reference_number?: string | null };
  let repayments: RepaymentRow[] = [];
  if (loan.loan_application_id) {
    const byApplication = await supabase
      .from("loan_repayments")
      .select("id, amount, payment_date, reference_number")
      .eq("loan_application_id", loan.loan_application_id);
    if (!byApplication.error) {
      repayments = (byApplication.data || []).map((row) => ({
        id: row.id,
        amount: Number(row.amount || 0),
        paid_at: row.payment_date,
        reference_number: row.reference_number,
      }));
    }
  }
  if (repayments.length === 0) {
    const byLoan = await supabase
      .from("loan_repayments")
      .select("id, amount, paid_at, reference_number")
      .eq("loan_id", loan.id);
    if (!byLoan.error) {
      repayments = (byLoan.data || []).map((row) => ({
        id: row.id,
        amount: Number(row.amount || 0),
        paid_at: row.paid_at,
        reference_number: row.reference_number,
      }));
    }
  }
  repayments.sort((a, b) => String(b.paid_at || "").localeCompare(String(a.paid_at || "")));

  const rawBorrower = unwrapRelation<EmbeddedBorrower>(loan.borrowers as unknown as Relation<EmbeddedBorrower>);
  const ind = unwrapRelation<{ full_name: string; phone?: string | null; email?: string | null }>(rawBorrower?.individual_profiles);
  const corp = unwrapRelation<{ legal_name: string; trade_name?: string | null; pan?: string | null; cin?: string | null; gstin?: string | null; registered_office_address?: string | null }>(rawBorrower?.corporate_profiles);
  const oth = unwrapRelation<{ entity_name: string }>(rawBorrower?.other_profiles);
  const borrowerName = ind?.full_name ?? corp?.legal_name ?? oth?.entity_name ?? rawBorrower?.borrower_code ?? "—";

  const app = unwrapRelation<{ id: string; application_code: string; facility_type?: string | null; purpose?: string | null; requested_amount?: number }>(
    loan.loan_applications as unknown as Relation<{ id: string; application_code: string; facility_type?: string | null; purpose?: string | null; requested_amount?: number }>
  );

  // Safely fetch collaterals attached to the original loan application
  let collaterals: Array<{
    id: string;
    collateral_type: string;
    charge_type: string | null;
    estimated_value: number | null;
    address: string | null;
    city: string | null;
    details: string | null;
  }> = [];

  if (app?.id) {
    try {
      const { data: cols } = await supabase
        .from("loan_collaterals")
        .select("id, collateral_type, charge_type, estimated_value, address, city, details")
        .eq("loan_application_id", app.id);
      if (cols) collaterals = cols;
    } catch {
      collaterals = [];
    }
  }

  // Parse LAS Equity Securities vs Immovable Property Collaterals
  const lasSecurities: LASSecurityItem[] = [];
  const propertyCollaterals: typeof collaterals = [];

  for (const c of collaterals) {
    if (c.collateral_type === "Equity Shares" && c.details) {
      try {
        const parsed = JSON.parse(c.details);
        if (parsed && typeof parsed === "object" && parsed.security_name) {
          lasSecurities.push(parsed as LASSecurityItem);
          continue;
        }
      } catch {
        // details was not JSON
      }
    }
    if (c.collateral_type === "Equity Shares") {
      lasSecurities.push({
        id: c.id,
        security_name: c.address ? c.address.replace(/\s*\(ISIN:.*\)$/, "") : "Pledged Equity Shares",
        isin: c.address && c.address.includes("ISIN:") ? c.address.split("ISIN:")[1].replace(")", "").trim() : "INE000000000",
        quantity: 1,
        cmp: Number(c.estimated_value || 0),
        market_value: Number(c.estimated_value || 0),
        security_cover: 2.5,
        loan_value: Math.round(Number(c.estimated_value || 0) / 2.5),
        pledgor_name: c.city || borrowerName,
      });
      continue;
    }
    propertyCollaterals.push(c);
  }

  const isLasFacility = lasSecurities.length > 0;
  const sanctionedAmount = Number(loan.sanctioned_amount || 0);
  const totalLasMarketValue = lasSecurities.reduce((sum, s) => sum + s.market_value, 0);
  const overallCoverage = calculateCoverageRatio(totalLasMarketValue, sanctionedAmount);
  const coverStatus = getCoverageStatus(overallCoverage);

  const disbursements = (loan.loan_disbursements as Array<{ id: string; amount: number; disbursed_at: string; reference_number?: string | null }>) || [];
  const totalDisbursed = disbursements.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalRepaid = repayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const outstandingPrincipal = Math.max(0, totalDisbursed - totalRepaid);
  const remainingCommitment = Math.max(0, sanctionedAmount - totalDisbursed);
  const totalCollateralVal = collaterals.reduce((sum, c) => sum + Number(c.estimated_value || 0), 0);
  const ltvRatio = totalCollateralVal > 0 ? ((outstandingPrincipal / totalCollateralVal) * 100).toFixed(1) : "—";

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
        {/* Header Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/loans/active"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="size-3" /> Active Facilities
              </Link>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Facility Console
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
                {loan.loan_code}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2.5 py-0.5 font-semibold capitalize",
                  loan.status === "active"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                    : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30"
                )}
              >
                {loan.status}
              </Badge>
              {app?.application_code && (
                <Link
                  href={`/loans/${loan.loan_application_id}`}
                  className="text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md border"
                >
                  <FileText className="size-3" /> App #{app.application_code}
                </Link>
              )}
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Borrower: <span className="font-semibold text-foreground">{borrowerName}</span>{" "}
              {rawBorrower?.pan && <span className="font-mono">({rawBorrower.pan})</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/borrowers/${loan.borrower_id}`}
              className="text-xs font-medium text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 flex items-center gap-1.5"
            >
              <Building2 className="size-3.5 text-primary" /> Borrower Profile
            </Link>
          </div>
        </div>

        {/* Executive Facility Financial Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sanctioned Limit */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Sanctioned Limit</span>
                <Landmark className="size-4 text-primary" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono text-foreground block">
                  {formatINR(sanctionedAmount)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {app?.facility_type || "Commercial Loan"} &middot; {loan.tenure_months || "—"} Mo
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Disbursed Draw */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Disbursed Draw</span>
                <CreditCard className="size-4 text-emerald-600" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono text-foreground block">
                  {formatINR(totalDisbursed)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {sanctionedAmount > 0
                    ? `${Math.round((totalDisbursed / sanctionedAmount) * 100)}% of limit drawn (${formatINR(remainingCommitment)} remaining)`
                    : "No drawdowns"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Principal Outstanding */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Principal Outstanding</span>
                <TrendingUp className="size-4 text-amber-600" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono text-foreground block">
                  {formatINR(outstandingPrincipal)}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {totalRepaid > 0 ? `Principal Paid: ${formatINR(totalRepaid)}` : "No repayments logged"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Pricing & Security Cover */}
          <Card className="border-border/80 shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>{isLasFacility ? "LAS Security Cover" : "Interest & LTV Cover"}</span>
                {isLasFacility ? (
                  <Landmark className="size-4 text-primary" />
                ) : (
                  <Percent className="size-4 text-indigo-600" />
                )}
              </div>
              <div className="mt-3">
                {isLasFacility ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold font-mono text-foreground">
                        {overallCoverage}x
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", coverStatus.colorClass)}>
                        {coverStatus.label}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      Target: 2.5x to 5.0x ({lasSecurities.length} scrips pledged)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold font-mono text-foreground block">
                      {loan.interest_rate ? `${loan.interest_rate}%` : "—"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      LTV: <span className="font-semibold text-foreground">{ltvRatio}%</span> &middot;{" "}
                      {collaterals.length} Collateral(s)
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LAS Pledged Securities Portfolio Table (if LAS facility) */}
        {isLasFacility && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-primary" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Pledged Equity Securities (LAS Portfolio)
                </h2>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                Policy Cover: 2.5x to 5.0x
              </span>
            </div>
            <LASSecuritiesTable
              securities={lasSecurities}
              onChange={() => {}}
              requestedLoanAmount={sanctionedAmount}
              readOnly
            />
          </div>
        )}

        {/* Facility Ledger & Servicing Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main 2 Columns: Cash Flows / Ledger */}
          <div className="lg:col-span-2 space-y-6">
            {/* Disbursements Ledger Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Capital Deployment
                    </span>
                    <CardTitle className="text-base mt-0.5">Tranche Disbursements</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {disbursements.length} Tranche(s)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {disbursements.length > 0 ? (
                  <div className="divide-y text-xs">
                    {disbursements.map((d, i) => (
                      <div key={d.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div>
                          <span className="font-semibold text-foreground block">
                            Tranche #{i + 1}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {d.reference_number ? `UTR: ${d.reference_number}` : "Disbursed"} &middot;{" "}
                            {new Date(d.disbursed_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-foreground text-sm">
                            {formatINR(Number(d.amount))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs space-y-1">
                    <CreditCard className="size-7 mx-auto mb-1 opacity-40" />
                    <p className="font-medium text-foreground">No disbursements recorded yet</p>
                    <p className="text-[11px]">
                      When tranches are released against this facility, they will appear in this ledger.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Repayments & Collections Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      Collections &amp; Recovery
                    </span>
                    <CardTitle className="text-base mt-0.5">Repayment Receipts</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {repayments.length} Payment(s)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {repayments.length > 0 ? (
                  <div className="divide-y text-xs">
                    {repayments.map((r, i) => (
                      <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div>
                          <span className="font-semibold text-foreground block">
                            Payment #{i + 1}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {r.reference_number ? `Ref: ${r.reference_number}` : "Payment Received"} &middot;{" "}
                            {new Date(r.paid_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            + {formatINR(Number(r.amount))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs space-y-1">
                    <TrendingUp className="size-7 mx-auto mb-1 opacity-40" />
                    <p className="font-medium text-foreground">No repayments recorded yet</p>
                    <p className="text-[11px]">
                      Payments logged against this facility will credit the loan ledger and reduce outstanding balance.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Facility Terms & Collateral */}
          <div className="space-y-6">
            {/* Facility Terms Summary */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold">Sanction Terms</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Sanction Date</span>
                  <span className="font-medium font-mono text-foreground">
                    {new Date(loan.sanctioned_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Interest Rate</span>
                  <span className="font-medium font-mono text-foreground">
                    {loan.interest_rate ? `${loan.interest_rate}% p.a.` : "—"}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Facility Tenure</span>
                  <span className="font-medium text-foreground">
                    {loan.tenure_months ? `${loan.tenure_months} Months` : "—"}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Product Type</span>
                  <span className="font-medium text-foreground">
                    {isLasFacility ? "LAS (Loan Against Securities)" : (app?.facility_type || "Commercial Loan")}
                  </span>
                </div>

                {app?.purpose && (
                  <div className="pt-2">
                    <span className="text-muted-foreground block text-[11px]">Facility Purpose:</span>
                    <p className="text-foreground mt-0.5 leading-relaxed">{app.purpose}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collaterals Summary */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">Pledged Security</CardTitle>
                  <span className="text-xs font-mono font-bold text-primary">
                    {formatINR(totalCollateralVal)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {collaterals.length > 0 ? (
                  <div className="divide-y">
                    {collaterals.map((c) => (
                      <div key={c.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{c.collateral_type}</span>
                          {c.charge_type && (
                            <Badge variant="outline" className="text-[10px]">
                              {c.charge_type}
                            </Badge>
                          )}
                        </div>
                        {c.address && (
                          <p className="text-muted-foreground text-[11px] truncate">
                            📍 {c.address} {c.city ? `, ${c.city}` : ""}
                          </p>
                        )}
                        {c.estimated_value && (
                          <span className="font-mono font-semibold text-primary block text-[11px]">
                            Valuation: {formatINR(Number(c.estimated_value))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs italic">
                    No collateral records attached to this facility.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
