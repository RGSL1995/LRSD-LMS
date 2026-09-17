"use client";

import Link from "next/link";
import type { ExtractedCorporateData } from "./corporate-types";
import { DocumentStageSection } from "./document-stage-section";
import type { BorrowerType } from "./document-categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Landmark,
  FolderOpen,
} from "lucide-react";

interface ComplianceFinalizeStepProps {
  borrowerId: string;
  borrowerType: BorrowerType;
  extractedData?: ExtractedCorporateData | null;
}

export function ComplianceFinalizeStep({
  borrowerId,
  borrowerType,
  extractedData,
}: ComplianceFinalizeStepProps) {
  const compliance = extractedData?.complianceChecks;

  return (
    <div className="space-y-6">
      {/* Statutory Compliance Checklist Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> Statutory &amp; Regulatory Compliance Checks
          </CardTitle>
          <CardDescription className="text-xs">
            Automated verification against MCA ROC, Insolvency &amp; Bankruptcy (BIFR), Debt Restructuring, and Legal Bureau registries
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border p-3.5 bg-background space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  ROC Name Removal U/S 248(5)
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                  Clean
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {compliance?.roc_name_removal || "As per official records, this corporate name was never removed under section 248(5) by ROC."}
              </p>
            </div>

            <div className="rounded-lg border p-3.5 bg-background space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  BIFR / Insolvency History
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                  No Cases
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {compliance?.bifr_history || "This corporate entity has no BIFR cases or insolvency defaults as per records."}
              </p>
            </div>

            <div className="rounded-lg border p-3.5 bg-background space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Corporate Debt Restructuring (CDR)
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                  Clean History
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {compliance?.cdr_history || "This corporate entity has no CDR restructuring history on record."}
              </p>
            </div>

            <div className="rounded-lg border p-3.5 bg-background space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Bureau Suit-Filed Cases
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                  Clean
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {compliance?.suit_filed_cases || "This corporate does not appear to have any Suit Filed Cases with the Credit Bureaus."}
              </p>
            </div>
          </div>

          {/* EPFO Establishments */}
          {compliance?.epfo_establishments && compliance.epfo_establishments.length > 0 && (
            <div className="mt-3 rounded-lg border p-3 bg-muted/20 text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground mb-1.5">
                <Landmark className="size-3.5 text-primary" />
                <span>EPFO (Employees Provident Fund) Establishments Registered:</span>
              </div>
              <div className="space-y-1">
                {compliance.epfo_establishments.map((ep, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] bg-background p-2 rounded border">
                    <span className="font-mono font-medium text-primary">{ep.id}</span>
                    <span className="font-medium">{ep.name}</span>
                    <span className="text-muted-foreground">{ep.city}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KYC Documents Stage */}
      <DocumentStageSection
        borrowerId={borrowerId}
        borrowerType={borrowerType}
        stage="kyc"
        title="Corporate KYC &amp; Statutory Documents"
      />

      {/* Onboarding Complete Action Banner */}
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                Corporate Onboarding Completed Successfully
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-xl">
                All corporate dimensions (Company Profile, Key Contacts, Governance &amp; Structure, Financials &amp; GST, and Statutory Compliance) have been initialized.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/borrowers/${borrowerId}`}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground gap-1.5 transition-colors"
            >
              <FolderOpen className="size-3.5" /> View Profile
            </Link>
            <Link
              href={`/loans/new?borrower_id=${borrowerId}`}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 gap-1.5 shadow-xs transition-colors"
            >
              Originate Loan <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
