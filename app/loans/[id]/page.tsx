import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitLoanApplication, type BorrowerLookup } from "@/app/loans/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DeleteLoanDialog } from "@/app/loans/delete-loan-dialog";
import { ExpandableProfileCard } from "@/components/borrowers/expandable-profile-card";
import { unwrapRelation, type Relation } from "@/lib/utils";
import {
  Clock,
  ArrowLeft,
  Calendar,
} from "lucide-react";

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
  const { data: application } = await supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, purpose, status, submitted_at, created_at,
       tenure_months, facility_type,
       borrower_id,
       borrowers (
         id, borrower_code, borrower_type, pan,
         individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, current_pincode, date_of_birth, occupation ),
         corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, incorporation_date, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode, corporate_office_address, contact_email, contact_no ),
         other_profiles ( entity_name, entity_category, address )
       )`,
    )
    .eq("id", id)
    .single();

  if (!application) notFound();

  // 2. Safely Fetch Parties (Co-borrowers, Guarantors)
  let parties: Array<{
    id: string;
    party_role: "primary_borrower" | "co_borrower" | "guarantor";
    guarantee_type: string | null;
    is_primary: boolean;
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

  const primaryBorrower = getPartyDetails(application.borrowers);
  const coBorrowers = parties.filter((p) => p.party_role === "co_borrower");
  const guarantors = parties.filter((p) => p.party_role === "guarantor");

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
            {application.status === "draft" && (
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

            {/* Guarantors */}
            <div className="space-y-2.5 pt-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Guarantors ({guarantors.length})
              </Label>
              {guarantors.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed">
                  No guarantors attached to this facility.
                </p>
              ) : (
                <div className="space-y-2">
                  {guarantors.map((g, i) => {
                    const party = getPartyDetails(g.borrowers);
                    return (
                      <ExpandableProfileCard
                        key={g.id}
                        borrower={party}
                        role="Guarantor"
                        roleIndex={i + 1}
                        guaranteeType={g.guarantee_type}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Collaterals & Securities (if any) */}
        {collaterals.length > 0 && (
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Security & Collateral</span>
              <CardTitle className="text-lg mt-0.5">Pledged Collaterals ({collaterals.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="divide-y">
                {collaterals.map((c) => (
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
      </main>
    </div>
  );
}
