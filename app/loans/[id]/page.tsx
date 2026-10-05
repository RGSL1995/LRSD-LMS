import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitLoanApplication, type BorrowerLookup } from "@/app/loans/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DeleteLoanDialog } from "@/app/loans/delete-loan-dialog";
import { ExpandableProfileCard } from "@/components/borrowers/expandable-profile-card";
import { unwrapRelation, type Relation } from "@/lib/utils";
import {
  Clock,
  ArrowLeft,
  Calendar,
  Pencil,
  Landmark,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { LASSecuritiesTable } from "@/app/loans/new/las-securities-table";
import { type LASSecurityItem, type SecurityProviderOption } from "@/app/loans/las-types";
import { SharePortalDialog } from "./share-portal-dialog";
import { BorrowerDocumentsCard, type BorrowerDocumentItem } from "./borrower-documents-card";

type EmbeddedBorrower = {
  id: string;
  borrower_code?: string;
  borrower_type: "individual" | "corporate" | "other";
  pan?: string | null;
  avatar_url?: string | null;
  individual_profiles: Relation<{
    full_name: string;
    phone?: string | null;
    email?: string | null;
    current_address_line?: string | null;
    current_city?: string | null;
    current_state?: string | null;
    current_pincode?: string | null;
    date_of_birth?: string | null;
    occupation?: string | null;
  }>;
  corporate_profiles: Relation<{
    legal_name: string;
    trade_name?: string | null;
    cin?: string | null;
    gstin?: string | null;
    business_type?: string | null;
    incorporation_date?: string | null;
    registered_office_address?: string | null;
    registered_office_city?: string | null;
    registered_office_state?: string | null;
    registered_office_pincode?: string | null;
    corporate_office_address?: string | null;
    contact_email?: string | null;
    contact_no?: string | null;
  }>;
  other_profiles: Relation<{
    entity_name: string;
    entity_category?: string | null;
    address?: string | null;
  }>;
};

function getPartyDetails(borrowers: Relation<EmbeddedBorrower>): BorrowerLookup {
  const b = unwrapRelation<EmbeddedBorrower>(borrowers);
  if (!b) {
    return {
      id: "",
      displayName: "—",
      borrower_code: "—",
      borrower_type: "corporate",
      pan: "—",
      avatar_url: null,
      address: null,
    };
  }
  const ind = unwrapRelation(b.individual_profiles);
  const corp = unwrapRelation(b.corporate_profiles);
  const oth = unwrapRelation(b.other_profiles);

  const displayName = ind?.full_name ?? corp?.legal_name ?? oth?.entity_name ?? b.borrower_code ?? "—";
  const address = ind?.current_address_line ?? corp?.registered_office_address ?? oth?.address ?? null;
  const city = ind?.current_city ?? corp?.registered_office_city ?? null;
  const state = ind?.current_state ?? corp?.registered_office_state ?? null;
  const pincode = ind?.current_pincode ?? corp?.registered_office_pincode ?? null;

  return {
    id: b.id,
    borrower_code: b.borrower_code ?? "—",
    borrower_type: b.borrower_type,
    displayName,
    pan: b.pan ?? "—",
    avatar_url: b.avatar_url ?? null,
    address,
    city,
    state,
    pincode,
    email: ind?.email || corp?.contact_email || null,
    phone: ind?.phone || corp?.contact_no || null,
    business_type: corp?.business_type || null,
    incorporation_date: corp?.incorporation_date || null,
    date_of_birth: ind?.date_of_birth || null,
    cin: corp?.cin || null,
    gstin: corp?.gstin || null,
    trade_name: corp?.trade_name || null,
    occupation: ind?.occupation || null,
    registered_address: corp?.registered_office_address || null,
    corporate_address: corp?.corporate_office_address || null,
    entity_category: oth?.entity_category || null,
  };
}

export default async function LoanApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch Loan Application
  // 1. Fetch Loan Application (safe fallback if migration 0011 columns not yet added)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let application: any = null;

  const { data: appData, error: appError } = await supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, purpose, status, submitted_at, created_at,
       tenure_months, facility_type,
       portal_token, portal_status, borrower_reviewed_at, borrower_review_notes,
       borrower_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, current_pincode, date_of_birth, occupation ),
         corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, incorporation_date, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode, corporate_office_address, contact_email, contact_no ),
         other_profiles ( entity_name, entity_category, address )
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (appData) {
    application = appData;
  } else if (appError) {
    const { data: fallbackApp } = await supabase
      .from("loan_applications")
      .select(
        `id, application_code, requested_amount, purpose, status, submitted_at, created_at,
         borrower_id,
         borrowers (
           id, borrower_code, borrower_type, pan,
           individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, current_pincode, date_of_birth, occupation ),
           corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, incorporation_date, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode, corporate_office_address, contact_email, contact_no ),
           other_profiles ( entity_name, entity_category, address )
         )`,
      )
      .eq("id", id)
      .maybeSingle();

    application = fallbackApp
      ? {
          ...fallbackApp,
          tenure_months: null,
          facility_type: null,
          portal_status: "pending",
          borrower_reviewed_at: null,
          borrower_review_notes: null,
        }
      : null;
  }

  if (!application) notFound();

  // 2. Safely Fetch Parties (Co-borrowers, Guarantors, Security Providers)
  let parties: Array<{
    id: string;
    party_role: "primary_borrower" | "co_borrower" | "guarantor" | "security_provider";
    guarantee_type: string | null;
    is_primary: boolean;
    is_guarantor?: boolean;
    is_security_provider?: boolean;
    borrower_id: string;
    borrowers: Relation<EmbeddedBorrower>;
  }> = [];

  try {
    const { data: partiesData } = await supabase
      .from("loan_application_parties")
      .select(
        `id, party_role, guarantee_type, is_primary, borrower_id,
         borrowers (
           id, borrower_code, borrower_type, pan,
           individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, current_pincode, date_of_birth, occupation ),
           corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, incorporation_date, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode, corporate_office_address, contact_email, contact_no ),
           other_profiles ( entity_name, entity_category, address )
         )`,
      )
      .eq("loan_application_id", id)
      .order("order_index", { ascending: true });

    if (partiesData) {
      parties = partiesData as unknown as typeof parties;
    }
  } catch {
    // If table not yet created
    parties = [];
  }

  // 3. Safely Fetch Collaterals
  let collaterals: Array<{
    id: string;
    collateral_type: string;
    charge_type: string | null;
    property_status: string | null;
    address: string | null;
    city: string | null;
    pincode: string | null;
    estimated_value: number | null;
    details: string | null;
  }> = [];

  try {
    const { data: collateralsData } = await supabase
      .from("loan_collaterals")
      .select("*")
      .eq("loan_application_id", id);

    if (collateralsData) {
      collaterals = collateralsData;
    }
  } catch {
    collaterals = [];
  }

  // 4. Safely Fetch Borrower & Application Documents
  let applicationDocuments: BorrowerDocumentItem[] = [];
  try {
    const { data: docsData } = await supabase
      .from("borrower_documents")
      .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at, uploaded_by_borrower")
      .or(`borrower_id.eq.${application.borrower_id},loan_application_id.eq.${id}`)
      .order("uploaded_at", { ascending: false });

    if (docsData) {
      applicationDocuments = docsData as BorrowerDocumentItem[];
    }
  } catch {
    try {
      const { data: fallbackDocs } = await supabase
        .from("borrower_documents")
        .select("id, borrower_id, stage, category, file_name, storage_path, file_size, uploaded_at")
        .eq("borrower_id", application.borrower_id)
        .order("uploaded_at", { ascending: false });
      if (fallbackDocs) {
        applicationDocuments = fallbackDocs as BorrowerDocumentItem[];
      }
    } catch {
      applicationDocuments = [];
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
        cmp: c.estimated_value || 0,
        market_value: c.estimated_value || 0,
        security_cover: 2.5,
        loan_value: Math.round((c.estimated_value || 0) / 2.5),
        pledgor_name: c.city || "Primary Obligor",
      });
      continue;
    }
    propertyCollaterals.push(c);
  }

  const primaryBorrower = getPartyDetails(application.borrowers);
  const coBorrowers = parties.filter((p) => p.party_role === "co_borrower");
  const guarantors = parties.filter((p) => p.party_role === "guarantor");
  const securityProviders = parties.filter((p) => p.party_role === "security_provider");

  // Every party this loan application is linked to - lets staff pick who a
  // document is for when uploading, and lets the documents list segregate by party.
  const seenPartyIds = new Set<string>([primaryBorrower.id]);
  const documentParties: Array<{ id: string; name: string; role: string }> = [
    { id: primaryBorrower.id, name: primaryBorrower.displayName, role: "Primary Borrower" },
  ];
  for (const p of [...coBorrowers, ...guarantors, ...securityProviders]) {
    if (seenPartyIds.has(p.borrower_id)) continue;
    seenPartyIds.add(p.borrower_id);
    const details = getPartyDetails(p.borrowers);
    const roleLabel =
      p.party_role === "co_borrower" ? "Co-Borrower" : p.party_role === "guarantor" ? "Guarantor" : "Security Provider";
    documentParties.push({ id: p.borrower_id, name: details.displayName, role: roleLabel });
  }

  // Build unified security providers list for LAS portfolio bifurcation
  // Only parties explicitly designated as security providers are included.
  const availableSecurityProviders: SecurityProviderOption[] = [];
  const primaryParty = getPartyDetails(application.borrowers);

  securityProviders.forEach((sp) => {
    const p = getPartyDetails(sp.borrowers);
    availableSecurityProviders.push({
      id: p.id,
      name: p.displayName,
      pan: p.pan,
      isSecurityProvider: true,
      isGuarantor: (sp as unknown as { is_guarantor?: boolean }).is_guarantor,
      guaranteeType: sp.guarantee_type as "personal" | "corporate" | undefined,
      isPrimary: primaryParty?.id === p.id,
    });
  });

  guarantors.forEach((g) => {
    const isSP = (g as unknown as { is_security_provider?: boolean }).is_security_provider;
    if (isSP) {
      const p = getPartyDetails(g.borrowers);
      const existing = availableSecurityProviders.find((x) => x.id === p.id);
      if (existing) {
        existing.isGuarantor = true;
        existing.guaranteeType = g.guarantee_type as "personal" | "corporate" | undefined;
        existing.isSecurityProvider = true;
      } else {
        availableSecurityProviders.push({
          id: p.id,
          name: p.displayName,
          pan: p.pan,
          isGuarantor: true,
          guaranteeType: g.guarantee_type as "personal" | "corporate" | undefined,
          isSecurityProvider: true,
          isPrimary: primaryParty?.id === p.id,
        });
      }
    }
  });

  // Check if linked to an active loan facility (LMS)
  const { data: linkedLoan } = await supabase
    .from("loans")
    .select("id, loan_code")
    .eq("loan_application_id", id)
    .maybeSingle();

  const submitAction = submitLoanApplication.bind(null, application.id);

  // Format currency
  const reqAmount = Number(application.requested_amount);
  const formattedAmount = () => {
    if (isNaN(reqAmount) || reqAmount <= 0) return "₹ 0";
    if (reqAmount >= 10000000) {
      return `₹ ${reqAmount.toLocaleString("en-IN")} (₹ ${(reqAmount / 10000000).toFixed(2)} Cr)`;
    }
    if (reqAmount >= 100000) {
      return `₹ ${reqAmount.toLocaleString("en-IN")} (₹ ${(reqAmount / 100000).toFixed(2)} Lakh)`;
    }
    return `₹ ${reqAmount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      {/* Top Header */}
      <header className="border-b bg-card px-6 py-4 sticky top-0 z-10 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/loans"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Loan Applications
            </Link>
            <span className="text-muted-foreground/40">|</span>
            <div className="flex items-center gap-2.5">
              <h1 className="font-mono text-base font-bold tracking-tight text-foreground">
                {application.application_code}
              </h1>
              <Badge variant="secondary" className="capitalize text-xs font-medium">
                {application.status.replace("_", " ")}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SharePortalDialog
              applicationId={application.id}
              applicationCode={application.application_code}
              borrowerName={primaryBorrower.displayName}
              portalStatus={application.portal_status || "pending"}
            />

            <Link
              href={`/loans/${application.id}/cam`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs" })}
            >
              <FileText className="size-3.5" />
              Credit Appraisal Memo
            </Link>

            <Link
              href={`/loans/${application.id}/sanction`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/60" })}
            >
              <ShieldCheck className="size-3.5" />
              Sanction Letter
            </Link>

            <Link
              href={`/loans/${application.id}/repayment`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60" })}
            >
              <Calendar className="size-3.5" />
              Repayment Schedule
            </Link>

            {!linkedLoan ? (
              <Link
                href={`/loans/${application.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm", className: "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs" })}
              >
                <Pencil className="size-3.5" />
                Edit Application
              </Link>
            ) : (
              <Link
                href={`/loans/active/${linkedLoan.id}`}
                className={buttonVariants({ size: "sm", className: "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white" })}
              >
                <Landmark className="size-3.5" />
                Active Facility #{linkedLoan.loan_code}
              </Link>
            )}

            {application.status === "draft" && !linkedLoan && (
              <form action={submitAction}>
                <Button type="submit" size="sm" className="h-8 px-4 font-medium shadow-xs">
                  Submit for Approval
                </Button>
              </form>
            )}
            <DeleteLoanDialog
              loanId={application.id}
              applicationCode={application.application_code}
              borrowerName={primaryBorrower.displayName}
              triggerVariant="outline"
              triggerSize="sm"
              showText={true}
              buttonText="Delete Application"
              redirectOnSuccess={true}
              className="h-8 text-xs border-destructive/30 hover:border-destructive/50"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Loan Facility Terms Card */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Facility Terms</span>
                <CardTitle className="text-lg mt-0.5">Wholesale Commercial Facility</CardTitle>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-1">
                {application.facility_type || "Commercial Loan"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Requested Loan Amount</span>
                <p className="text-base font-bold text-foreground font-mono">{formattedAmount()}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Repayment Tenure</span>
                <p className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="size-4 text-muted-foreground" />
                  {application.tenure_months ? `${application.tenure_months} Months` : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Loan Facility Type</span>
                <p className="text-sm font-semibold text-foreground">{application.facility_type || "—"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Origination Date</span>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  {new Date(application.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {application.purpose && (
              <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                <span className="font-semibold text-foreground mr-1.5">Purpose of Loan:</span>
                {application.purpose}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multi-Party Structure (Borrower, Co-Borrowers, Guarantors) */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3 border-b">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Multi-Party Structure</span>
            <CardTitle className="text-lg mt-0.5">Borrowers & Guarantors Directory</CardTitle>
            <CardDescription>All obligants and guarantors bound to this wholesale loan facility.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {/* Primary Borrower */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Primary Obligor / Borrower
              </Label>
              <ExpandableProfileCard
                borrower={primaryBorrower}
                role="Primary Borrower"
                isVerified
              />
            </div>

            {/* Co-Borrowers */}
            <div className="space-y-2.5 pt-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Co-Borrowers ({coBorrowers.length})
              </Label>
              {coBorrowers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed">
                  No co-borrowers assigned to this facility.
                </p>
              ) : (
                <div className="space-y-2">
                  {coBorrowers.map((cb, i) => {
                    const party = getPartyDetails(cb.borrowers);
                    return (
                      <ExpandableProfileCard
                        key={cb.id}
                        borrower={party}
                        role="Co-Borrower"
                        roleIndex={i + 1}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Guarantors & Security Providers */}
            <div className="space-y-2.5 pt-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Guarantors &amp; Security Providers ({guarantors.length + securityProviders.length})
              </Label>
              {guarantors.length === 0 && securityProviders.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed">
                  No guarantors or security providers attached to this facility.
                </p>
              ) : (
                <div className="space-y-2">
                  {guarantors.map((g, i) => {
                    const party = getPartyDetails(g.borrowers);
                    const isDual = (g as unknown as { is_security_provider?: boolean }).is_security_provider;
                    return (
                      <ExpandableProfileCard
                        key={g.id}
                        borrower={party}
                        role={isDual ? "Guarantor & Security Provider" : "Guarantor"}
                        roleIndex={i + 1}
                        guaranteeType={g.guarantee_type}
                      />
                    );
                  })}
                  {securityProviders
                    .filter((sp) => !guarantors.some((g) => g.borrower_id === sp.borrower_id))
                    .map((sp, i) => {
                      const party = getPartyDetails(sp.borrowers);
                      return (
                        <ExpandableProfileCard
                          key={sp.id}
                          borrower={party}
                          role="Security Provider"
                          roleIndex={guarantors.length + i + 1}
                          guaranteeType={sp.guarantee_type}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pledged Equity Securities (LAS Portfolio Table) */}
        {lasSecurities.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Pledged Equity Securities (LAS Portfolio Schedule)
            </h2>
            <LASSecuritiesTable
              securities={lasSecurities}
              requestedLoanAmount={reqAmount}
              providers={availableSecurityProviders}
              readOnly
            />
          </div>
        )}

        {/* Immovable Collaterals & Properties (if any) */}
        {propertyCollaterals.length > 0 && (
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Security & Collateral</span>
              <CardTitle className="text-lg mt-0.5">Pledged Collaterals ({propertyCollaterals.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="divide-y">
                {propertyCollaterals.map((c) => (
                  <div key={c.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{c.collateral_type}</span>
                        {c.charge_type && <Badge variant="secondary" className="text-[10px]">{c.charge_type}</Badge>}
                        {c.property_status && <Badge variant="outline" className="text-[10px]">{c.property_status}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">📍 {c.address} {c.city ? `, ${c.city}` : ""}</p>
                      {c.details && <p className="text-[11px] text-muted-foreground italic">{c.details}</p>}
                    </div>

                    {c.estimated_value && (
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Estimated Value</div>
                        <div className="text-sm font-bold font-mono text-primary">
                          ₹ {c.estimated_value.toLocaleString("en-IN")}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {/* Supported Documents & Borrower Portal Submissions */}
        <BorrowerDocumentsCard
          applicationId={application.id}
          applicationCode={application.application_code}
          borrowerName={primaryBorrower.displayName}
          portalStatus={application.portal_status || "pending"}
          borrowerReviewedAt={application.borrower_reviewed_at}
          borrowerReviewNotes={application.borrower_review_notes}
          documents={applicationDocuments}
          parties={documentParties}
          isCorporate={primaryBorrower.borrower_type === "corporate"}
        />
      </main>
    </div>
  );
}
