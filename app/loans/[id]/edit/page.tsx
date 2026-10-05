import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unwrapRelation, type Relation } from "@/lib/utils";
import { type BorrowerLookup } from "@/app/loans/actions";
import { type LASSecurityItem } from "@/app/loans/las-types";
import { type CollateralItem } from "@/app/loans/new/collateral-dialog";
import {
  NewWholesaleLoanPage,
  type WholesaleLoanInitialData,
} from "@/app/loans/new/new-loan-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, Landmark, AlertTriangle, ExternalLink } from "lucide-react";

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

export default async function EditLoanApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Fetch Loan Application
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let application: any = null;

  const { data: appData, error: appError } = await supabase
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
       )`
    )
    .eq("id", id)
    .maybeSingle();

  if (appData) {
    application = appData;
  } else if (appError?.message?.includes("facility_type") || appError?.code === "42703") {
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
         )`
      )
      .eq("id", id)
      .maybeSingle();

    application = fallbackApp;
  }

  if (!application) {
    notFound();
  }

  // 2. Check if linked to an active loan facility (locked)
  const { data: linkedLoan } = await supabase
    .from("loans")
    .select("id, loan_code, sanctioned_amount, status")
    .eq("loan_application_id", id)
    .maybeSingle();

  if (linkedLoan) {
    return (
      <div className="min-h-screen bg-muted/20 p-6 flex items-center justify-center">
        <Card className="max-w-xl w-full border-amber-500/30 shadow-md">
          <CardHeader className="pb-3 border-b bg-amber-500/5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Lock className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Application Locked from Editing
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  This origination dossier has transitioned into an active credit facility.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Application <span className="font-mono font-bold text-foreground">{application.application_code}</span> has already been sanctioned and booked as Active Credit Facility{" "}
              <span className="font-mono font-bold text-emerald-600">{linkedLoan.loan_code}</span>.
            </p>
            <div className="rounded-lg bg-muted p-3 border text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block">Regulatory &amp; Credit Governance Rule:</span>
              <p>
                To maintain committee sanction integrity and financial audit trails, sanctioned terms cannot be directly modified. To adjust terms, an Underwriting Restructuring Memo must be issued.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <Link
                href={`/loans/${id}`}
                className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5 text-xs" })}
              >
                <ArrowLeft className="size-3.5" />
                View Read-Only Dossier
              </Link>
              <Link
                href={`/loans/active/${linkedLoan.id}`}
                className={buttonVariants({ size: "sm", className: "gap-1.5 text-xs font-semibold" })}
              >
                <Landmark className="size-3.5" />
                Go to Facility Console
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Fetch Multi-Party Structure (Co-Borrowers & Guarantors)
  let parties: Array<{
    id: string;
    party_role: string;
    guarantee_type: "personal" | "corporate" | null;
    is_primary: boolean;
    order_index: number;
    borrowers: Relation<EmbeddedBorrower>;
  }> = [];

  try {
    const { data: partiesData } = await supabase
      .from("loan_application_parties")
      .select(
        `id, party_role, guarantee_type, is_primary, order_index,
         borrowers (
           id, borrower_code, borrower_type, pan,
           individual_profiles ( full_name, phone, email, current_address_line, current_city, current_state, current_pincode, date_of_birth, occupation ),
           corporate_profiles ( legal_name, trade_name, cin, gstin, business_type, incorporation_date, registered_office_address, registered_office_city, registered_office_state, registered_office_pincode, corporate_office_address, contact_email, contact_no ),
           other_profiles ( entity_name, entity_category, address )
         )`
      )
      .eq("loan_application_id", id)
      .order("order_index", { ascending: true });

    if (partiesData) {
      parties = partiesData as unknown as typeof parties;
    }
  } catch {
    parties = [];
  }

  // 4. Fetch Collaterals & Pledged Securities
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
    const { data: cols } = await supabase
      .from("loan_collaterals")
      .select("*")
      .eq("loan_application_id", id);
    if (cols) collaterals = cols;
  } catch {
    collaterals = [];
  }

  const lasSecurities: LASSecurityItem[] = [];
  const propertyCollaterals: CollateralItem[] = [];

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
        pledgor_name: c.city || "Primary Obligor",
      });
      continue;
    }
    propertyCollaterals.push({
      id: c.id,
      collateral_type: c.collateral_type,
      charge_type: c.charge_type || "Exclusive",
      property_status: c.property_status || "Freehold",
      address: c.address || "",
      city: c.city || "",
      pincode: c.pincode || "",
      estimated_value: c.estimated_value || 0,
      details: c.details || "",
    });
  }

  const primaryBorrower = getPartyDetails(application.borrowers);
  const coBorrowers = parties
    .filter((p) => p.party_role === "co_borrower")
    .map((p) => getPartyDetails(p.borrowers));
  const guarantors = parties
    .filter((p) => p.party_role === "guarantor")
    .map((p) => ({
      borrower: getPartyDetails(p.borrowers),
      guaranteeType: (p.guarantee_type === "corporate" ? "corporate" : "personal") as "personal" | "corporate",
      isSecurityProvider: (p as unknown as { is_security_provider?: boolean }).is_security_provider,
    }));
  const securityProviders = parties
    .filter((p) => p.party_role === "security_provider")
    .map((p) => ({
      borrower: getPartyDetails(p.borrowers),
      isGuarantor: (p as unknown as { is_guarantor?: boolean }).is_guarantor,
      guaranteeType: p.guarantee_type ? ((p.guarantee_type === "corporate" ? "corporate" : "personal") as "personal" | "corporate") : undefined,
    }));

  const initialData: WholesaleLoanInitialData = {
    applicationCode: application.application_code,
    primaryBorrower,
    loanType: lasSecurities.length > 0
      ? "LAS (Loan Against Securities)"
      : (application.facility_type as "LAS (Loan Against Securities)" | "LAP" | "Project Finance" | "Others") || "LAP",
    requestedAmount: application.requested_amount,
    tenureMonths: application.tenure_months || 72,
    purpose: application.purpose || "",
    coBorrowers,
    guarantors,
    securityProviders,
    collaterals: propertyCollaterals,
    lasSecurities,
    status: application.status,
  };

  return (
    <NewWholesaleLoanPage
      mode="edit"
      applicationId={application.id}
      initialData={initialData}
    />
  );
}
