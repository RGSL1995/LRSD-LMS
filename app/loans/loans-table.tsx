"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, unwrapRelation, type Relation } from "@/lib/utils";
import { Search, FileCheck2, ArrowRight, Eye, CheckCircle2, Clock, FileEdit, AlertCircle } from "lucide-react";
import { BorrowerAvatar } from "@/components/ui/borrower-avatar";
import { DeleteLoanDialog } from "./delete-loan-dialog";

export type EmbeddedBorrower = {
  id?: string;
  borrower_type?: string;
  avatar_url?: string | null;
  individual_profiles: Relation<{ full_name: string }>;
  corporate_profiles: Relation<{ legal_name: string }>;
  other_profiles: Relation<{ entity_name: string }>;
};

export type LoanRow = {
  id: string;
  application_code: string;
  requested_amount: number;
  status: string;
  created_at: string;
  facility_type?: string | null;
  tenure_months?: number | null;
  borrowers: Relation<EmbeddedBorrower>;
};

function getBorrowerName(borrowers: Relation<EmbeddedBorrower>) {
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

export function LoansTable({ loans }: { loans: LoanRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const underReviewCount = loans.filter((l) => l.status === "under_review" || l.status === "submitted").length;
  const approvedCount = loans.filter((l) => l.status === "approved" || l.status === "disbursed").length;
  const draftCount = loans.filter((l) => l.status === "draft").length;

  const filtered = loans.filter((loan) => {
    const name = getBorrowerName(loan.borrowers).toLowerCase();
    const code = (loan.application_code || "").toLowerCase();
    const query = search.toLowerCase();
    const matchesQuery = name.includes(query) || code.includes(query);

    let matchesStatus = true;
    if (statusFilter === "review") {
      matchesStatus = loan.status === "under_review" || loan.status === "submitted";
    } else if (statusFilter === "approved") {
      matchesStatus = loan.status === "approved" || loan.status === "disbursed";
    } else if (statusFilter === "draft") {
      matchesStatus = loan.status === "draft";
    } else if (statusFilter !== "all") {
      matchesStatus = loan.status === statusFilter;
    }

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-2xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            variant={statusFilter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("all")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            All <span className="opacity-70 text-[11px]">({loans.length})</span>
          </Button>
          <Button
            type="button"
            variant={statusFilter === "review" ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("review")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            <Clock className="size-3.5 text-amber-500" /> Underwriting
            <span className="opacity-70 text-[11px]">({underReviewCount})</span>
          </Button>
          <Button
            type="button"
            variant={statusFilter === "approved" ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("approved")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            <CheckCircle2 className="size-3.5 text-emerald-500" /> Approved
            <span className="opacity-70 text-[11px]">({approvedCount})</span>
          </Button>
          <Button
            type="button"
            variant={statusFilter === "draft" ? "default" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter("draft")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            <FileEdit className="size-3.5 text-slate-500" /> Draft
            <span className="opacity-70 text-[11px]">({draftCount})</span>
          </Button>
        </div>

        {/* Live Search */}
        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or borrower..."
            className="h-8 text-xs pl-8 bg-background"
          />
        </div>
      </div>

      {/* Loans Data Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {filtered.length > 0 ? (
          <Table>
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead className="w-[140px]">Application #</TableHead>
                <TableHead>Borrower Entity</TableHead>
                <TableHead className="text-right">Requested Facility</TableHead>
                <TableHead className="text-center">Approval Status</TableHead>
                <TableHead className="text-center">Origination Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((loan) => {
                const borrowerName = getBorrowerName(loan.borrowers);
                const isApproved = loan.status === "approved" || loan.status === "disbursed";
                const isReview = loan.status === "under_review" || loan.status === "submitted";

                return (
                  <TableRow key={loan.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      <Link href={`/loans/${loan.id}`} className="hover:underline">
                        {loan.application_code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <BorrowerAvatar
                          name={borrowerName}
                          type={unwrapRelation<EmbeddedBorrower>(loan.borrowers)?.borrower_type ?? "corporate"}
                          avatarUrl={unwrapRelation<EmbeddedBorrower>(loan.borrowers)?.avatar_url}
                          size="xs"
                        />
                        <span className="font-medium text-foreground text-xs sm:text-sm truncate max-w-[200px]">
                          {borrowerName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-bold text-foreground text-xs sm:text-sm">
                        {formatINR(Number(loan.requested_amount || 0))}
                      </div>
                      {(loan.facility_type || loan.tenure_months) && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {loan.facility_type || "Facility"}
                          {loan.tenure_months ? ` • ${loan.tenure_months}m` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-2.5 py-0.5 font-semibold capitalize inline-flex items-center gap-1",
                          isApproved
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : isReview
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
                        )}
                      >
                        {isApproved && <CheckCircle2 className="size-3 text-emerald-600" />}
                        {isReview && <Clock className="size-3 text-amber-600" />}
                        {loan.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {loan.created_at ? new Date(loan.created_at).toLocaleDateString("en-IN") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/loans/${loan.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                        >
                          Appraisal <ArrowRight className="size-3" />
                        </Link>
                        <DeleteLoanDialog
                          loanId={loan.id}
                          applicationCode={loan.application_code}
                          borrowerName={borrowerName}
                          triggerVariant="ghost"
                          triggerSize="xs"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-10 text-center text-muted-foreground">
            <FileCheck2 className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No applications found</p>
            <p className="text-xs mt-0.5">
              {search ? "No records matched your search query." : "No credit applications currently in this stage."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
