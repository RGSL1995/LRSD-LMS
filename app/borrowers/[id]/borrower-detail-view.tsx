"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WizardStepper, type WizardStepItem } from "@/components/ui/wizard-stepper";
import { ContactsAssociatesStep } from "@/app/borrowers/contacts-associates-step";
import { DocumentStageSection } from "@/app/borrowers/document-stage-section";
import { GovernanceStructureStep } from "@/app/borrowers/governance-structure-step";
import { FinancialsGstStep } from "@/app/borrowers/financials-gst-step";
import {
  IndividualProfileEditor,
  CorporateProfileEditor,
  OtherProfileEditor,
  type IndividualProfile,
  type CorporateProfile,
  type OtherProfile,
} from "./profile-editor";
import { DeleteBorrowerButton } from "./delete-borrower-button";
import type { BorrowerType } from "@/app/borrowers/document-categories";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Users,
  Building2,
  FileCheck,
  FileSpreadsheet,
  LayoutGrid,
  ListOrdered,
} from "lucide-react";

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
}

export function BorrowerDetailView({
  borrower,
  individual,
  corporate,
  other,
}: BorrowerDetailViewProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState<"stepper" | "full">("stepper");

  const displayName =
    individual?.full_name ?? corporate?.legal_name ?? other?.entity_name ?? "Borrower Profile";

  const borrowerType = borrower.borrower_type as BorrowerType;
  const isCorporate = borrowerType === "corporate";
  const wizardSteps = isCorporate ? CORPORATE_WIZARD_STEPS : INDIVIDUAL_WIZARD_STEPS;
  const totalSteps = wizardSteps.length;

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 px-6 py-4 shadow-xs">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
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

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="hidden sm:flex items-center rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setViewMode("stepper")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  viewMode === "stepper"
                    ? "bg-background text-foreground shadow-xs"
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
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="size-3.5" /> Full View
              </button>
            </div>

            <DeleteBorrowerButton borrowerId={borrower.id} />
          </div>
        </div>
      </header>

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
      <main className="mx-auto max-w-3xl px-4 pt-8 space-y-8">
        {viewMode === "stepper" ? (
          /* STEPPER MODE */
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
                  <CorporateProfileEditor borrowerId={borrower.id} profile={corporate} />
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

                <ContactsAssociatesStep borrowerId={borrower.id} borrowerType={borrowerType} />

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
                    Continue to Step 3 ({isCorporate ? "Governance" : "KYC"}) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* CORPORATE STEP 3: Governance & Structure */}
            {isCorporate && currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Building2 className="size-5 text-primary" /> Step 3: Governance &amp; Corporate Structure
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Directors, Group / Subsidiary Structure, and Related Party Transactions (RPT)
                    </p>
                  </div>
                </div>

                <GovernanceStructureStep borrowerId={borrower.id} />

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
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="size-5 text-primary" /> Step 4: Financial Appraisal &amp; GST Analytics
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Consolidated &amp; standalone statements, Excel extraction, and GST returns reconciliation
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
                    <ArrowLeft className="size-4" /> Back to Governance
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setCurrentStep(5)}
                    className="gap-2"
                  >
                    Continue to Step 5 (KYC) <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* CORPORATE STEP 5: KYC Documents */}
            {isCorporate && currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileCheck className="size-5 text-primary" /> Step 5: KYC &amp; Statutory Documents
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Statutory incorporation proofs, PAN, GST certificates, and compliance files
                    </p>
                  </div>
                </div>

                <DocumentStageSection
                  borrowerId={borrower.id}
                  borrowerType={borrowerType}
                  stage="kyc"
                  title="Corporate KYC &amp; Statutory Documents"
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
                    <Button size="lg" className="gap-2 bg-primary font-semibold">
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
                      <FileSpreadsheet className="size-5 text-primary" /> Step 4: Income &amp; Financial Records
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Income statements, salary slips, and bank statements
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
                    <Button size="lg" className="gap-2 bg-primary font-semibold">
                      Create Loan Application <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* FULL OVERVIEW MODE */
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                <User className="size-4 text-primary" /> 1. Profile Information
              </h2>
              {individual && (
                <IndividualProfileEditor borrowerId={borrower.id} profile={individual} />
              )}
              {corporate && (
                <CorporateProfileEditor borrowerId={borrower.id} profile={corporate} />
              )}
              {other && <OtherProfileEditor borrowerId={borrower.id} profile={other} />}
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                <Users className="size-4 text-primary" /> 2. Key Contacts &amp; Associates
              </h2>
              <ContactsAssociatesStep borrowerId={borrower.id} borrowerType={borrowerType} />
            </section>

            {isCorporate ? (
              <>
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <Building2 className="size-4 text-primary" /> 3. Governance &amp; Corporate Structure
                  </h2>
                  <GovernanceStructureStep borrowerId={borrower.id} />
                </section>

                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileSpreadsheet className="size-4 text-primary" /> 4. Financial Appraisal &amp; GST Analytics
                  </h2>
                  <FinancialsGstStep borrowerId={borrower.id} borrowerType={borrowerType} />
                </section>

                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileCheck className="size-4 text-primary" /> 5. Corporate KYC Documents
                  </h2>
                  <DocumentStageSection
                    borrowerId={borrower.id}
                    borrowerType={borrowerType}
                    stage="kyc"
                    title="Corporate KYC Documents"
                  />
                </section>
              </>
            ) : (
              <>
                <section className="space-y-3">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground/90">
                    <FileCheck className="size-4 text-primary" /> 3. KYC Documents
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
                    <FileSpreadsheet className="size-4 text-primary" /> 4. Financial Records
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

