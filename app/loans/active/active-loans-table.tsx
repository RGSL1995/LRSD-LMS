"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookFacilityDialog } from "./book-facility-dialog";
import {
  Search,
  Building2,
  Landmark,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BorrowerAvatar } from "@/components/ui/borrower-avatar";

export type ActiveLoanRow = {
  id: string;
  loan_code: string;
  loan_application_id: string;
  application_code: string;
  borrower_id: string;
  borrower_name: string;
  borrower_code: string;
  borrower_type: string;
  pan: string | null;
  avatar_url?: string | null;
  sanctioned_amount: number;
  interest_rate: number | null;
  tenure_months: number | null;
  status: "active" | "closed" | "defaulted" | "written_off";
  sanctioned_at: string;
  facility_type?: string | null;
  total_disbursed: number;
  total_repaid: number;
  outstanding_principal: number;
  disbursements_count: number;
  repayments_count: number;
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

export function ActiveLoansTable({ loans }: { loans: ActiveLoanRow[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed" | "defaulted">("all");

  const filteredLoans = loans.filter((loan) => {
    // Status Filter
    if (statusFilter !== "all" && loan.status !== statusFilter) {
      return false;
    }

    // Text Search
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();

    return (
      loan.loan_code.toLowerCase().includes(term) ||
      loan.application_code.toLowerCase().includes(term) ||
      loan.borrower_name.toLowerCase().includes(term) ||
      (loan.pan && loan.pan.toLowerCase().includes(term)) ||
      loan.borrower_code.toLowerCase().includes(term)
    );
  });

  const activeCount = loans.filter((l) => l.status === "active").length;
  const closedCount = loans.filter((l) => l.status === "closed").length;
  const defaultedCount = loans.filter((l) => l.status === "defaulted" || l.status === "written_off").length;

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by Facility Code, Application #, Borrower, or PAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs h-9"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-lg border border-border/80 self-start sm:self-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
              statusFilter === "all"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Facilities ({loans.length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
              statusFilter === "active"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("closed")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
              statusFilter === "closed"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Closed ({closedCount})
          </button>
          {defaultedCount > 0 && (
            <button
              onClick={() => setStatusFilter("defaulted")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap text-destructive",
                statusFilter === "defaulted"
                  ? "bg-background shadow-2xs"
                  : "opacity-80 hover:opacity-100"
              )}
            >
              NPA / Default ({defaultedCount})
            </button>
          )}
        </div>
      </div>

      {/* Facilities Table Card */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        {filteredLoans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Facility Code</th>
                  <th className="px-4 py-3 text-left">Borrower Obligor</th>
                  <th className="px-4 py-3 text-right">Sanctioned Limit</th>
                  <th className="px-4 py-3 text-left min-w-[150px]">Disbursement Draw</th>
                  <th className="px-4 py-3 text-right">Outstanding Principal</th>
                  <th className="px-4 py-3 text-center">Interest / Tenure</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLoans.map((loan) => {
                  const disbPercent = loan.sanctioned_amount > 0
                    ? Math.min(100, Math.round((loan.total_disbursed / loan.sanctioned_amount) * 100))
                    : 0;

                  return (
                    <tr key={loan.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Facility Code & App Reference */}
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <Link
                            href={`/loans/active/${loan.id}`}
                            className="font-mono font-bold text-primary hover:underline flex items-center gap-1 text-sm"
                          >
                            {loan.loan_code}
                          </Link>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-mono">{loan.application_code}</span>
                            <span>&middot;</span>
                            <span>{new Date(loan.sanctioned_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}</span>
                          </div>
                        </div>
                      </td>

                      {/* Borrower Entity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <BorrowerAvatar
                            avatarUrl={loan.avatar_url}
                            name={loan.borrower_name}
                            type={loan.borrower_type}
                            className="size-7 shrink-0 text-[10px]"
                          />
                          <div className="min-w-0 max-w-[200px]">
                            <Link
                              href={`/borrowers/${loan.borrower_id}`}
                              className="font-semibold text-foreground hover:text-primary transition-colors block truncate"
                            >
                              {loan.borrower_name}
                            </Link>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                              {loan.pan && <span className="bg-muted px-1 rounded text-[9px]">{loan.pan}</span>}
                              <span className="capitalize">{loan.borrower_type}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sanctioned Limit */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-foreground block text-sm">
                          {formatINR(loan.sanctioned_amount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {loan.facility_type || "Commercial Loan"}
                        </span>
                      </td>

                      {/* Disbursement Drawdown */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-semibold text-foreground">
                              {formatINR(loan.total_disbursed)}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {disbPercent}%
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                disbPercent >= 100
                                  ? "bg-emerald-500"
                                  : disbPercent > 0
                                    ? "bg-primary"
                                    : "bg-transparent"
                              )}
                              style={{ width: `${disbPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground block">
                            {loan.disbursements_count > 0
                              ? `${loan.disbursements_count} Tranche(s)`
                              : "Undisbursed"}
                          </span>
                        </div>
                      </td>

                      {/* Principal Outstanding */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-foreground block text-sm">
                          {formatINR(loan.outstanding_principal)}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {loan.total_repaid > 0 ? `Recovered: ${formatINR(loan.total_repaid)}` : "No Repayments Yet"}
                        </span>
                      </td>

                      {/* Interest Rate & Tenure */}
                      <td className="px-4 py-3 text-center">
                        <div className="space-y-0.5">
                          <span className="font-mono font-semibold text-foreground block">
                            {loan.interest_rate ? `${loan.interest_rate}%` : "—"} p.a.
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                            <Clock className="size-3" />
                            {loan.tenure_months ? `${loan.tenure_months} Mo` : "—"}
                          </span>
                        </div>
                      </td>

                      {/* Facility Health Status */}
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-2 py-0.5 font-semibold capitalize",
                            loan.status === "active"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : loan.status === "closed"
                                ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30"
                                : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {loan.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/loans/active/${loan.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                          Servicing <ChevronRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Landmark className="size-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-sm font-bold text-foreground">No active loan facilities</h3>
              <p className="text-xs text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "No active facilities match your search criteria. Try resetting the filters."
                  : "Book your first active loan facility by converting an approved loan application."}
              </p>
            </div>

            {!searchTerm && statusFilter === "all" && (
              <div className="pt-2">
                <BookFacilityDialog />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
