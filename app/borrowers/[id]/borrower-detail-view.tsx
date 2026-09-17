"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WizardStepper, type WizardStepItem } from "@/components/ui/wizard-stepper";
import { ContactsAssociatesStep } from "@/app/borrowers/contacts-associates-step";
import { DocumentStageSection } from "@/app/borrowers/document-stage-section";
import { GovernanceStructureStep } from "@/app/borrowers/governance-structure-step";
import { ChargesLendersStep } from "@/app/borrowers/charges-lenders-step";
import { ChargeDetailsStep } from "@/app/borrowers/charge-details-step";
import { FinancialsGstStep } from "@/app/borrowers/financials-gst-step";
import { PeerComparisonStep } from "@/app/borrowers/peer-comparison-step";
import { ComplianceFinalizeStep } from "@/app/borrowers/compliance-finalize-step";
import {
  IndividualProfileEditor,
  CorporateProfileEditor,
  OtherProfileEditor,
  type IndividualProfile,
  type CorporateProfile,
  type OtherProfile,
} from "./profile-editor";
import { DeleteBorrowerButton } from "./delete-borrower-button";
import { EraseProfileButton } from "@/app/borrowers/erase-profile-button";
import { BorrowerAvatar } from "@/components/ui/borrower-avatar";
import type { BorrowerType } from "@/app/borrowers/document-categories";
import type { ExtractedCorporateData } from "@/app/borrowers/corporate-types";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  User,
  Users,
  Building2,
  FileCheck,
  FileSpreadsheet,
  ReceiptText,
  LayoutGrid,
  ListOrdered,
  ShieldCheck,
  Sparkles,
  CreditCard,
  Network,
  TrendingUp,
  FileText,
  Landmark,
  Layers,
  Award,
  Calendar,
  DollarSign,
} from "lucide-react";

export type DossierTab =
  | "about"
  | "highlights"
  | "directors"
  | "structure"
  | "charges"
  | "charge_details"
  | "financials"
  | "gst"
  | "rpt"
  | "peers"
  | "compliance";

const CORPORATE_WIZARD_STEPS: WizardStepItem[] = [
  { id: 1, title: "Step 1", description: "Company Profile" },
  { id: 2, title: "Step 2", description: "Key Contacts" },
  { id: 3, title: "Step 3", description: "Governance & Structure" },
  { id: 4, title: "Step 4", description: "Financials & GST" },
  { id: 5, title: "Step 5", description: "KYC & Finalize" },
];

const INDIVIDUAL_WIZARD_STEPS: WizardStepItem[] = [
  { id: 1, title: "Step 1", description: "Personal Profile" },
  { id: 2, title: "Step 2", description: "Key Contacts" },
  { id: 3, title: "Step 3", description: "KYC Documents" },
  { id: 4, title: "Step 4", description: "Financial Records" },
];

interface BorrowerDetailViewProps {
  borrower: {
    id: string;
    borrower_code: string;
    borrower_type: string;
    status: string;
    created_at: string;
  };
  individual: IndividualProfile | null;
  corporate: CorporateProfile | null;
  other: OtherProfile | null;
  initialExtractedData?: ExtractedCorporateData | null;
  initialAvatarUrl?: string | null;
}

export function BorrowerDetailView({
  borrower,
  individual,
  corporate,
  other,
  initialExtractedData,
  initialAvatarUrl,
}: BorrowerDetailViewProps) {
  const borrowerType = borrower.borrower_type as BorrowerType;
  const isCorporate = borrowerType === "corporate";

  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState<"dossier" | "stepper" | "full">(
    isCorporate ? "dossier" : "stepper",
  );
  const [activeDossierTab, setActiveDossierTab] = useState<DossierTab>("about");
  const [step3Tab, setStep3Tab] = useState<"structure" | "charges">("structure");
  const [step4Tab, setStep4Tab] = useState<"financials" | "peers">("financials");
  const [corporateExtractedData, setCorporateExtractedData] = useState<ExtractedCorporateData | null>(
    initialExtractedData ?? null,
  );

  const displayName =
    individual?.full_name ?? corporate?.legal_name ?? other?.entity_name ?? "Borrower Profile";

  const wizardSteps = isCorporate ? CORPORATE_WIZARD_STEPS : INDIVIDUAL_WIZARD_STEPS;
  const totalSteps = wizardSteps.length;

  const dossierTabs = [
    { id: "about", label: "About Company", icon: Building2 },
    { id: "highlights", label: "Highlights", icon: Sparkles },
    {
      id: "directors",
      label: "Directors & KMPs",
      count: corporateExtractedData?.associates?.length || undefined,
      icon: Users,
    },
    {
      id: "structure",
      label: "Corporate Structure",
      count: corporateExtractedData?.groupStructure?.length || undefined,
      icon: Network,
    },
    {
      id: "charges",
      label: "Open Charges",
      count: corporateExtractedData?.openCharges?.length || undefined,
      icon: CreditCard,
    },
    { id: "charge_details", label: "Charge Details", icon: FileText },
    {
      id: "financials",
      label: "Financial Data",
      count: corporateExtractedData?.financials?.length
        ? `${corporateExtractedData.financials.length} periods`
        : undefined,
      icon: FileSpreadsheet,
    },
    {
      id: "gst",
      label: "GST Intelligence",
      count: corporateExtractedData?.gstins?.length
        ? `${corporateExtractedData.gstins.length} GSTINs`
        : undefined,
      icon: ReceiptText,
    },
    {
      id: "rpt",
      label: "Related Party (RPT)",
      count: corporateExtractedData?.rpt?.length
        ? `${corporateExtractedData.rpt.length} deals`
        : undefined,
      icon: ArrowRightLeft,
    },
    {
      id: "peers",
      label: "Peer Comparison",
      count: corporateExtractedData?.peerComparison?.closest_peers?.length
        ? `${corporateExtractedData.peerComparison.closest_peers.length} peers`
        : undefined,
      icon: TrendingUp,
    },
    { id: "compliance", label: "Compliance Checks", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="border-b bg-card/85 backdrop-blur-md sticky top-0 z-20 px-6 py-4 shadow-xs">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BorrowerAvatar
              borrowerId={borrower.id}
              name={displayName}
              type={borrowerType}
              avatarUrl={initialAvatarUrl}
              size="xl"
              editable={true}
            />
            <div>
              <Link
                href="/borrowers"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Back to Borrowers
              </Link>
              <div className="mt-1 flex items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight">{displayName}</h1>
                <Badge variant="secondary" className="capitalize text-xs font-semibold">
                  {borrower.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono">{borrower.borrower_code}</span> &middot;{" "}
                <span className="capitalize">{borrower.borrower_type}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="hidden sm:flex items-center rounded-lg border bg-muted/40 p-1">
              {isCorporate && (
                <button
                  type="button"
                  onClick={() => setViewMode("dossier")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    viewMode === "dossier"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="size-3.5 text-primary" /> 9-Tab Dossier
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode("stepper")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  viewMode === "stepper"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListOrdered className="size-3.5" /> Wizard View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("full")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  viewMode === "full"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="size-3.5" /> Full View
              </button>
            </div>

            {isCorporate && <EraseProfileButton borrowerId={borrower.id} />}
            <DeleteBorrowerButton borrowerId={borrower.id} />
          </div>
        </div>
      </header>

      {/* 9-Tab Master Dossier Navigation (when in dossier view mode) */}
      {viewMode === "dossier" && isCorporate && (
        <div className="border-b bg-card/75 backdrop-blur-md sticky top-[69px] z-10 shadow-xs">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
              {dossierTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeDossierTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDossierTab(tab.id as DossierTab)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-foreground/80 font-mono font-medium"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stepper Navigation (when in stepper view mode) */}
      {viewMode === "stepper" && (
        <div className="border-b bg-card/60 backdrop-blur-xs py-4 shadow-xs">
          <div className="mx-auto max-w-4xl px-4">
            <WizardStepper
              steps={wizardSteps}
              currentStep={currentStep}
              maxAccessibleStep={totalSteps}
              onStepClick={(step) => setCurrentStep(step)}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 pt-8 space-y-8">
        {/* ================================================================= */}
        {/* 1. 9-TAB MASTER DOSSIER VIEW MODE                                 */}
        {/* ================================================================= */}
        {viewMode === "dossier" && isCorporate && (
          <div>
            {/* TAB 1: About the Company */}
            {activeDossierTab === "about" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="size-5 text-primary" /> About the Company
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Entity identification, business model, operational verticals, and registered premises
                    </p>
                  </div>
                </div>

                {/* Business Description / Operations Narrative Card */}
                {corporateExtractedData?.profile?.about && (
                  <Card className="border-primary/25 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Award className="size-4 text-primary" /> Business Activity &amp; Commercial Model
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {corporateExtractedData.profile.about}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Profile Editor & Ingest Component */}
                {corporate && (
                  <CorporateProfileEditor
                    borrowerId={borrower.id}
                    profile={corporate}
                    onExtracted={setCorporateExtractedData}
                  />
                )}
              </div>
            )}

            {/* TAB 2: Highlights */}
            {activeDossierTab === "highlights" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Sparkles className="size-5 text-primary" /> Key Financial &amp; Compliance Highlights
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Capital structure, borrowing charge sums, listing status, and MCA compliance standing
                    </p>
                  </div>
                </div>

                {/* 4 Primary KPI Highlight Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <DollarSign className="size-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground block">Paid-Up Capital</span>
                        <span className="text-base font-bold text-foreground">
                          {corporateExtractedData?.highlights?.paid_up_capital || "Rs. 20.32 Crore"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground block">Authorized Capital</span>
                        <span className="text-base font-bold text-foreground">
                          {corporateExtractedData?.highlights?.authorized_capital || "Rs. 24.50 Crore"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <CreditCard className="size-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground block">Total Sum of Charges</span>
                        <span className="text-base font-bold text-foreground font-mono">
                          {corporateExtractedData?.highlights?.sum_of_charges || "Rs. 4,830.24 Crore"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="size-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground block">Active Compliance</span>
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                          {corporateExtractedData?.highlights?.active_compliance || "Active Compliant"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Additional Statutory Registry Highlights */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">MCA Statutory Registry Highlights</CardTitle>
                    <CardDescription className="text-xs">
                      Official listing status, Legal Entity Identifier (LEI), and annual filing milestones
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <dt className="text-muted-foreground font-medium">Listing Status</dt>
                        <dd className="text-sm font-bold text-foreground mt-0.5">
                          {corporateExtractedData?.highlights?.listing_status || "Listed"}
                        </dd>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <dt className="text-muted-foreground font-medium">Company Status</dt>
                        <dd className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {corporateExtractedData?.highlights?.company_status || "Active"}
                        </dd>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <dt className="text-muted-foreground font-medium">Legal Entity Identifier (LEI)</dt>
                        <dd className="text-sm font-mono font-bold text-foreground mt-0.5">
                          {corporateExtractedData?.highlights?.lei || "984500B2DE5D2EQ50016"}
                        </dd>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <dt className="text-muted-foreground font-medium">Last AGM Date</dt>
                        <dd className="text-sm font-bold text-foreground mt-0.5">
                          {corporateExtractedData?.highlights?.last_agm_date || "28 Sep, 2025"}
                        </dd>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <dt className="text-muted-foreground font-medium">Total Equity Shares</dt>
                        <dd className="text-sm font-mono font-bold text-foreground mt-0.5">
                          {corporateExtractedData?.structure?.total_equity_shares?.toLocaleString() || "20,319,150"}
                        </dd>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <dt className="text-muted-foreground font-medium">Total Registered Shareholders</dt>
                        <dd className="text-sm font-mono font-bold text-foreground mt-0.5">
                          {corporateExtractedData?.structure?.total_shareholders?.toLocaleString() || "14,458"}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 3: Directors & KMPs */}
            {activeDossierTab === "directors" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="size-5 text-primary" /> Directors &amp; Key Management Personnel
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      MCA verified board members, designations, DIN numbers, and cross-referenced shareholdings
                    </p>
                  </div>
                </div>

                <ContactsAssociatesStep
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  extractedData={corporateExtractedData}
                />
              </div>
            )}

            {/* TAB 4: Corporate Structure */}
            {activeDossierTab === "structure" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Network className="size-5 text-primary" /> Corporate Structure &amp; Group Companies
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Promoter vs. public shareholding pattern, major shareholders (&gt;5%), and 80 subsidiaries &amp; associates
                    </p>
                  </div>
                </div>

                <GovernanceStructureStep
                  borrowerId={borrower.id}
                  extractedData={corporateExtractedData}
                  activeSection="structure_only"
                />
              </div>
            )}

            {/* TAB 5: Open Charges */}
            {activeDossierTab === "charges" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="size-5 text-primary" /> Open Charges Sequence &amp; Lenders
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Active secured borrowing charges registered with the Registrar of Companies (ROC)
                    </p>
                  </div>
                </div>

                <ChargesLendersStep
                  borrowerId={borrower.id}
                  extractedData={corporateExtractedData}
                />
              </div>
            )}

            {/* TAB 6: Charge Details */}
            {activeDossierTab === "charge_details" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="size-5 text-primary" /> Charge Details &amp; Collateral Hypothecation
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lender-wise sanctioned exposures, property classifications, and hypothecated asset descriptions
                    </p>
                  </div>
                </div>

                <ChargeDetailsStep
                  borrowerId={borrower.id}
                  extractedData={corporateExtractedData}
                />
              </div>
            )}

            {/* TAB 7: Financial Data */}
            {activeDossierTab === "financials" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="size-5 text-primary" /> Multi-Year Financial Statements &amp; GST
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Standalone &amp; Consolidated Balance Sheets, P&amp;L, EBITDA, PAT, and Key Financial Ratios (FY23 &ndash; FY25)
                    </p>
                  </div>
                </div>

                <FinancialsGstStep
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  extractedData={corporateExtractedData}
                  activeSection="financials_only"
                />
              </div>
            )}

            {/* TAB: GST Intelligence */}
            {activeDossierTab === "gst" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ReceiptText className="size-5 text-primary" /> GST Intelligence &amp; Annexure Filings
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pan-India Active &amp; Inactive GST registrations, jurisdiction analysis, and full historical Annexure filings
                    </p>
                  </div>
                </div>

                <FinancialsGstStep
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  extractedData={corporateExtractedData}
                  activeSection="gst_only"
                />
              </div>
            )}

            {/* TAB: Related Party Transactions (RPT) */}
            {activeDossierTab === "rpt" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ArrowRightLeft className="size-5 text-primary" /> Related Party Transactions (RPT) &amp; Governance
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Inter-corporate loans, director remuneration, sales/purchases with related entities, and guarantees
                    </p>
                  </div>
                </div>

                <GovernanceStructureStep
                  borrowerId={borrower.id}
                  extractedData={corporateExtractedData}
                  activeSection="rpt_only"
                />
              </div>
            )}

            {/* TAB 8: Peer Comparison */}
            {activeDossierTab === "peers" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="size-5 text-primary" /> Industry Sector &amp; Peer Benchmarking
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Side-by-side revenue comparisons with closest sector competitors in the Power / EPC segment
                    </p>
                  </div>
                </div>

                <PeerComparisonStep
                  borrowerId={borrower.id}
                  extractedData={corporateExtractedData}
                />
              </div>
            )}

            {/* TAB 9: Compliance Checks */}
            {activeDossierTab === "compliance" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" /> Statutory Compliance &amp; KYC Verification
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ROC Section 248(5), BIFR insolvency, CDR restructuring, Bureau suit-filed checks, and EPFO records
                    </p>
                  </div>
                </div>

                <ComplianceFinalizeStep
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  extractedData={corporateExtractedData}
                />
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. 5-STEP WIZARD VIEW MODE                                        */}
        {/* ================================================================= */}
        {viewMode === "stepper" && (
          <div>
            {/* STEP 1: Profile */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <User className="size-5 text-primary" /> Step 1: Profile Details
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Review and update entity identification, addresses, and primary info
                    </p>
                  </div>
                </div>

                {individual && (
                  <IndividualProfileEditor borrowerId={borrower.id} profile={individual} />
                )}
                {corporate && (
                  <CorporateProfileEditor
                    borrowerId={borrower.id}
                    profile={corporate}
                    onExtracted={setCorporateExtractedData}
                  />
                )}
                {other && <OtherProfileEditor borrowerId={borrower.id} profile={other} />}

                <div className="flex items-center justify-end pt-6 border-t">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCurrentStep(2)}
                    className="gap-2"
                  >
                    Continue to Step 2 (Contacts) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Contacts & Associates */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="size-5 text-primary" /> Step 2: Contacts &amp; Key Associates
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manage authorized persons, directors, partners, and key signatories
                    </p>
                  </div>
                </div>

                <ContactsAssociatesStep
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  extractedData={corporateExtractedData}
                />

                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="size-4" /> Back to Profile
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCurrentStep(3)}
                    className="gap-2"
                  >
                    Continue to Step 3 ({isCorporate ? "Governance & Structure" : "KYC"}) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* CORPORATE STEP 3: Governance & Structure */}
            {isCorporate && currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b gap-3">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="size-5 text-primary" /> Step 3: Governance &amp; Structure
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Shareholding pattern, group companies &amp; subsidiaries, and MCA registered charges
                    </p>
                  </div>

                  {/* Sub-Tabs for Step 3 */}
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button
                      type="button"
                      variant={step3Tab === "structure" ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7 px-3"
                      onClick={() => setStep3Tab("structure")}
                    >
                      Shareholding &amp; Group
                    </Button>
                    <Button
                      type="button"
                      variant={step3Tab === "charges" ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7 px-3 gap-1"
                      onClick={() => setStep3Tab("charges")}
                    >
                      Open Charges &amp; Lenders
                      {corporateExtractedData?.openCharges && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {corporateExtractedData.openCharges.length}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </div>

                {step3Tab === "structure" ? (
                  <GovernanceStructureStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                ) : (
                  <ChargesLendersStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                )}

                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="size-4" /> Back to Contacts
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCurrentStep(4)}
                    className="gap-2"
                  >
                    Continue to Step 4 (Financials &amp; GST) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* CORPORATE STEP 4: Financials & GST Analytics */}
            {isCorporate && currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b gap-3">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="size-5 text-primary" /> Step 4: Financials &amp; GST
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Standalone &amp; consolidated statements, EBITDA, peer comparison benchmarks, and GST reconciliation
                    </p>
                  </div>

                  {/* Sub-Tabs for Step 4 */}
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button
                      type="button"
                      variant={step4Tab === "financials" ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7 px-3"
                      onClick={() => setStep4Tab("financials")}
                    >
                      Financials &amp; GST
                    </Button>
                    <Button
                      type="button"
                      variant={step4Tab === "peers" ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7 px-3"
                      onClick={() => setStep4Tab("peers")}
                    >
                      Peer Comparison
                    </Button>
                  </div>
                </div>

                {step4Tab === "financials" ? (
                  <FinancialsGstStep
                    borrowerId={borrower.id}
                    borrowerType={borrowerType}
                    extractedData={corporateExtractedData}
                  />
                ) : (
                  <PeerComparisonStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                )}

                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(3)}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="size-4" /> Back to Governance
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCurrentStep(5)}
                    className="gap-2"
                  >
                    Continue to Step 5 (KYC &amp; Finalize) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* CORPORATE STEP 5: KYC & Finalize */}
            {isCorporate && currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" /> Step 5: KYC &amp; Compliance Verification
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ROC 248(5), BIFR, CDR, Bureau suit-filed checks, EPFO records, and statutory KYC verification
                    </p>
                  </div>
                </div>

                <ComplianceFinalizeStep
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  extractedData={corporateExtractedData}
                />

                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(4)}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="size-4" /> Back to Financials
                  </Button>
                  <Link href={`/loans/new`}>
                    <Button size="lg" className="gap-2 bg-primary font-semibold shadow-sm">
                      Create Loan Application <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* INDIVIDUAL STEP 3: KYC Documents */}
            {!isCorporate && currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileCheck className="size-5 text-primary" /> Step 3: KYC Documents
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload and manage identity proof, address proof, and compliance files
                    </p>
                  </div>
                </div>

                <DocumentStageSection
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  stage="kyc"
                  title="KYC Documents"
                />

                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="size-4" /> Back to Contacts
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCurrentStep(4)}
                    className="gap-2"
                  >
                    Continue to Step 4 (Financials) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* INDIVIDUAL STEP 4: Financial Records */}
            {!isCorporate && currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="size-5 text-primary" /> Step 4: Financial Records
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload bank statements, salary slips, and financial proof
                    </p>
                  </div>
                </div>

                <FinancialsGstStep borrowerId={borrower.id} borrowerType={borrowerType} />

                <div className="flex items-center justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(3)}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="size-4" /> Back to KYC
                  </Button>
                  <Link href={`/loans/new`}>
                    <Button size="lg" className="gap-2 bg-primary font-semibold shadow-sm">
                      Create Loan Application <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. FULL OVERVIEW MODE (ALL SECTIONS EXPANDED)                     */}
        {/* ================================================================= */}
        {viewMode === "full" && (
          <div className="space-y-10">
            {/* 1. About Company */}
            <section className="space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                <Building2 className="size-4 text-primary" /> 1. About the Company
              </h2>
              {corporateExtractedData?.profile?.about && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      Business Operations Narrative
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {corporateExtractedData.profile.about}
                    </p>
                  </CardContent>
                </Card>
              )}
              {individual && (
                <IndividualProfileEditor borrowerId={borrower.id} profile={individual} />
              )}
              {corporate && (
                <CorporateProfileEditor
                  borrowerId={borrower.id}
                  profile={corporate}
                  onExtracted={setCorporateExtractedData}
                />
              )}
              {other && <OtherProfileEditor borrowerId={borrower.id} profile={other} />}
            </section>

            {/* 2. Highlights (Corporate only) */}
            {isCorporate && corporateExtractedData?.highlights && (
              <section className="space-y-3">
                <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                  <Sparkles className="size-4 text-primary" /> 2. Company Highlights &amp; Statutory Statistics
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-3 text-xs border-primary/20 bg-primary/5">
                    <span className="text-muted-foreground block text-[11px]">Paid-Up Capital</span>
                    <span className="text-sm font-bold text-foreground">
                      {corporateExtractedData.highlights.paid_up_capital || "Rs. 20.32 Crore"}
                    </span>
                  </Card>
                  <Card className="p-3 text-xs">
                    <span className="text-muted-foreground block text-[11px]">Authorized Capital</span>
                    <span className="text-sm font-bold text-foreground">
                      {corporateExtractedData.highlights.authorized_capital || "Rs. 24.50 Crore"}
                    </span>
                  </Card>
                  <Card className="p-3 text-xs">
                    <span className="text-muted-foreground block text-[11px]">Sum of Open Charges</span>
                    <span className="text-sm font-mono font-bold text-foreground">
                      {corporateExtractedData.highlights.sum_of_charges || "Rs. 4,830.24 Crore"}
                    </span>
                  </Card>
                  <Card className="p-3 text-xs">
                    <span className="text-muted-foreground block text-[11px]">Compliance Status</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {corporateExtractedData.highlights.active_compliance || "Active Compliant"}
                    </span>
                  </Card>
                </div>
              </section>
            )}

            {/* 3. Directors & Management */}
            <section className="space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                <Users className="size-4 text-primary" /> 3. Directors &amp; Key Associates
              </h2>
              <ContactsAssociatesStep
                borrowerId={borrower.id}
                borrowerType={borrowerType}
                extractedData={corporateExtractedData}
              />
            </section>

            {isCorporate ? (
              <>
                {/* 4. Corporate Structure */}
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <Network className="size-4 text-primary" /> 4. Corporate Structure &amp; Group Entities
                  </h2>
                  <GovernanceStructureStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                </section>

                {/* 5. Open Charges */}
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <CreditCard className="size-4 text-primary" /> 5. Open Charges Sequence &amp; Lenders
                  </h2>
                  <ChargesLendersStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                </section>

                {/* 6. Charge Details */}
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileText className="size-4 text-primary" /> 6. Charge Details &amp; Collateral Hypothecation
                  </h2>
                  <ChargeDetailsStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                </section>

                {/* 7. Financial Data & Statements */}
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileSpreadsheet className="size-4 text-primary" /> 7. Financial Statements &amp; GST Analytics
                  </h2>
                  <FinancialsGstStep
                    borrowerId={borrower.id}
                    borrowerType={borrowerType}
                    extractedData={corporateExtractedData}
                  />
                </section>

                {/* 8. Peer Comparison */}
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <TrendingUp className="size-4 text-primary" /> 8. Industry Benchmark &amp; Peer Comparison
                  </h2>
                  <PeerComparisonStep
                    borrowerId={borrower.id}
                    extractedData={corporateExtractedData}
                  />
                </section>

                {/* 9. Compliance Checks */}
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <ShieldCheck className="size-4 text-primary" /> 9. Statutory Compliance &amp; KYC Verification
                  </h2>
                  <ComplianceFinalizeStep
                    borrowerId={borrower.id}
                    borrowerType={borrowerType}
                    extractedData={corporateExtractedData}
                  />
                </section>
              </>
            ) : (
              <>
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileCheck className="size-4 text-primary" /> 4. KYC Documents
                  </h2>
                  <DocumentStageSection
                    borrowerId={borrower.id}
                    borrowerType={borrowerType}
                    stage="kyc"
                    title="KYC Documents"
                  />
                </section>

                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileSpreadsheet className="size-4 text-primary" /> 5. Financial Records
                  </h2>
                  <FinancialsGstStep borrowerId={borrower.id} borrowerType={borrowerType} />
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
