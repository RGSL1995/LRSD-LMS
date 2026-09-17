"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBorrower, type CreateBorrowerState } from "@/app/borrowers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WizardStepper, type WizardStepItem } from "@/components/ui/wizard-stepper";
import { ContactsAssociatesStep } from "@/app/borrowers/contacts-associates-step";
import { DocumentStageSection } from "@/app/borrowers/document-stage-section";
import { GovernanceStructureStep } from "@/app/borrowers/governance-structure-step";
import { FinancialsGstStep } from "@/app/borrowers/financials-gst-step";
import { ChargesLendersStep } from "@/app/borrowers/charges-lenders-step";
import { PeerComparisonStep } from "@/app/borrowers/peer-comparison-step";
import { ComplianceFinalizeStep } from "@/app/borrowers/compliance-finalize-step";
import { CorporateDataUploader } from "@/app/borrowers/corporate-data-uploader";
import type { ExtractedCorporateData } from "@/app/borrowers/corporate-types";
import type { BorrowerType } from "@/app/borrowers/document-categories";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  User,
  Users,
  Building2,
  FileSpreadsheet,
  FileCheck,
  ShieldCheck,
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
  { id: 4, title: "Step 4", description: "Financials & Review" },
];

const initialState: CreateBorrowerState = { error: null, borrowerId: null };

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export default function NewBorrowerPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createBorrower, initialState);
  const [borrowerType, setBorrowerType] = useState<BorrowerType>("individual");
  const [currentStep, setCurrentStep] = useState(1);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState(1);
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  const [profileSummary, setProfileSummary] = useState<string | null>(null);
  const [lastHandled, setLastHandled] = useState(state);
  const [corporateExtractedData, setCorporateExtractedData] = useState<ExtractedCorporateData | null>(null);
  const [step3Tab, setStep3Tab] = useState<"structure" | "charges">("structure");
  const [step4Tab, setStep4Tab] = useState<"financials" | "peers">("financials");

  const isCorporate = borrowerType === "corporate";
  const wizardSteps = isCorporate ? CORPORATE_WIZARD_STEPS : INDIVIDUAL_WIZARD_STEPS;
  const totalSteps = wizardSteps.length;

  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.borrowerId) {
      setBorrowerId(state.borrowerId);
      setCurrentStep(2);
      setMaxAccessibleStep(totalSteps);
    }
  }

  function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    const formData = new FormData(e.currentTarget);
    const name =
      borrowerType === "individual"
        ? formData.get("full_name")
        : borrowerType === "corporate"
          ? formData.get("legal_name")
          : formData.get("entity_name");
    setProfileSummary(typeof name === "string" && name ? name : null);
  }

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
            <h1 className="mt-1 text-xl font-bold tracking-tight">New Borrower Onboarding</h1>
          </div>
          {borrowerId && profileSummary && (
            <div className="hidden sm:flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold capitalize">{borrowerType}</span>
              <span className="text-muted-foreground">&middot;</span>
              <span className="truncate max-w-[150px] font-medium">{profileSummary}</span>
            </div>
          )}
        </div>
      </header>

      {/* Stepper Bar */}
      <div className="border-b bg-card/60 backdrop-blur-xs py-4 shadow-xs">
        <div className="mx-auto max-w-5xl px-4">
          <WizardStepper
            steps={wizardSteps}
            currentStep={currentStep}
            onStepClick={(step) => setCurrentStep(step)}
            maxAccessibleStep={maxAccessibleStep}
          />
        </div>
      </div>

      {/* Wizard Content */}
      <main className="mx-auto max-w-4xl px-4 pt-8">
        {/* STEP 1: Profile */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {borrowerType === "individual" ? (
                    <User className="size-5 text-primary" />
                  ) : (
                    <Building2 className="size-5 text-primary" />
                  )}
                  Step 1: {isCorporate ? "Company Profile" : "Borrower Profile"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCorporate
                    ? "Corporate identity, business activities, capital & regulatory highlights"
                    : "Basic entity classification and identification details"}
                </p>
              </div>

              {borrowerId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-muted-foreground gap-1"
                >
                  Skip to Next Step <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>

            <form action={formAction} onSubmit={handleProfileSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Entity Classification</CardTitle>
                  <CardDescription className="text-xs">
                    Choose the borrower type to display relevant governance, KYC, and financial fields
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ToggleGroup
                    value={[borrowerType]}
                    onValueChange={(values) => {
                      const value = values[0] as typeof borrowerType | undefined;
                      if (value) setBorrowerType(value);
                    }}
                    variant="outline"
                    className="justify-start"
                  >
                    <ToggleGroupItem value="individual" className="capitalize px-4 py-2">
                      Individual
                    </ToggleGroupItem>
                    <ToggleGroupItem value="corporate" className="capitalize px-4 py-2">
                      Corporate
                    </ToggleGroupItem>
                    <ToggleGroupItem value="other" className="capitalize px-4 py-2">
                      Other Entity
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <input type="hidden" name="borrower_type" value={borrowerType} />
                </CardContent>
              </Card>

              {borrowerType === "individual" && <IndividualFields />}
              {borrowerType === "corporate" && (
                <CorporateFields onExtractedDataChange={setCorporateExtractedData} />
              )}
              {borrowerType === "other" && <OtherFields />}

              {state.error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive font-medium">
                  {state.error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="submit" size="lg" disabled={pending} className="gap-2">
                  {pending
                    ? "Saving & Initializing..."
                    : `Save & Continue to Step 2 (${isCorporate ? "Key Contacts" : "Contacts"})`}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: Key Contacts */}
        {currentStep === 2 && borrowerId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="size-5 text-primary" /> Step 2: Key Contacts
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isCorporate
                    ? "Board of directors, KMP, DINs, and primary operational contact persons"
                    : "Add primary and secondary operational contact persons"}
                </p>
              </div>
            </div>

            <ContactsAssociatesStep
              borrowerId={borrowerId}
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
                <ArrowLeft className="size-4" /> Back to Step 1 ({isCorporate ? "Company Profile" : "Profile"})
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
        {isCorporate && currentStep === 3 && borrowerId && (
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
                borrowerId={borrowerId}
                extractedData={corporateExtractedData}
              />
            ) : (
              <ChargesLendersStep
                borrowerId={borrowerId}
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
                <ArrowLeft className="size-4" /> Back to Step 2 (Key Contacts)
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

        {/* CORPORATE STEP 4: Financials & GST */}
        {isCorporate && currentStep === 4 && borrowerId && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b gap-3">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary" /> Step 4: Financials &amp; GST
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Standalone &amp; consolidated statements, EBITDA, ratios, peer benchmarks, and GST reconciliation
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
                  Financial Statements &amp; GST
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
                borrowerId={borrowerId}
                borrowerType={borrowerType}
                extractedData={corporateExtractedData}
              />
            ) : (
              <PeerComparisonStep
                borrowerId={borrowerId}
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
                <ArrowLeft className="size-4" /> Back to Step 3 (Governance &amp; Structure)
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
        {isCorporate && currentStep === 5 && borrowerId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" /> Step 5: KYC &amp; Finalize
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ROC 248(5), BIFR, CDR, Bureau suit-filed checks, EPFO records, and statutory KYC verification
                </p>
              </div>
            </div>

            <ComplianceFinalizeStep
              borrowerId={borrowerId}
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
                <ArrowLeft className="size-4" /> Back to Step 4 (Financials &amp; GST)
              </Button>
              <Button
                type="button"
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md"
                onClick={() => router.push(`/borrowers/${borrowerId}`)}
              >
                Finish &amp; View Profile <CheckCircle2 className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* INDIVIDUAL STEP 3: KYC Documents */}
        {!isCorporate && currentStep === 3 && borrowerId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileCheck className="size-5 text-primary" /> Step 3: KYC Documents Upload
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload identity, address, and signature proofs
                </p>
              </div>
            </div>

            <DocumentStageSection
              borrowerId={borrowerId}
              borrowerType={borrowerType}
              stage="kyc"
              title="KYC Verification Checklist"
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

        {/* INDIVIDUAL STEP 4: Financials & Completion */}
        {!isCorporate && currentStep === 4 && borrowerId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary" /> Step 4: Income &amp; Financial Records
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload salary slips, bank statements, ITR, and finalize onboarding
                </p>
              </div>
            </div>

            <FinancialsGstStep borrowerId={borrowerId} borrowerType={borrowerType} />

            {/* Onboarding Complete Summary Card */}
            <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="flex items-start gap-4 p-4">
                <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Ready to Complete Onboarding
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    The borrower profile, contact details, KYC verification proofs, and financial records have been saved.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(3)}
                className="gap-1.5"
              >
                <ArrowLeft className="size-4" /> Back to KYC
              </Button>
              <Button
                type="button"
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md"
                onClick={() => router.push(`/borrowers/${borrowerId}`)}
              >
                Finish &amp; View Profile <CheckCircle2 className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function IndividualFields() {
  const [currentAddress, setCurrentAddress] = useState({
    line: "",
    city: "",
    state: "",
    pincode: "",
    years: "",
    type: "",
  });

  const [permanentAddress, setPermanentAddress] = useState({
    line: "",
    city: "",
    state: "",
    pincode: "",
    years: "",
    type: "",
  });

  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  function handleCurrentChange(field: string, value: string) {
    const updated = { ...currentAddress, [field]: value };
    setCurrentAddress(updated);
    if (sameAsCurrent) {
      setPermanentAddress(updated);
    }
  }

  function handleSameAsCurrentToggle(checked: boolean) {
    setSameAsCurrent(checked);
    if (checked) {
      setPermanentAddress({ ...currentAddress });
    }
  }

  function handlePermanentChange(field: string, value: string) {
    setPermanentAddress((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="full_name">Full Name *</Label>
            <Input id="full_name" name="full_name" placeholder="As per official ID" required />
          </Field>
          <Field>
            <Label htmlFor="father_or_husband_name">Father&apos;s / Husband&apos;s Name</Label>
            <Input id="father_or_husband_name" name="father_or_husband_name" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input id="date_of_birth" name="date_of_birth" type="date" />
            </Field>
            <Field>
              <Label htmlFor="gender">Gender</Label>
              <Select name="gender">
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="marital_status">Marital Status</Label>
              <Select name="marital_status">
                <SelectTrigger id="marital_status" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="qualification">Qualification</Label>
              <Select name="qualification">
                <SelectTrigger id="qualification" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_school">High School</SelectItem>
                  <SelectItem value="graduate">Graduate</SelectItem>
                  <SelectItem value="post_graduate">Post Graduate</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="occupation">Occupation</Label>
              <Select name="occupation">
                <SelectTrigger id="occupation" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="housewife">Housewife</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" name="pan" placeholder="ABCDE1234F" />
            </Field>
            <Field>
              <Label htmlFor="aadhaar_number">Aadhaar No.</Label>
              <Input id="aadhaar_number" name="aadhaar_number" placeholder="12-digit UID" />
            </Field>
            <Field>
              <Label htmlFor="passport_number">Passport No.</Label>
              <Input id="passport_number" name="passport_number" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="monthly_income">Monthly Income (₹)</Label>
              <Input id="monthly_income" name="monthly_income" type="number" step="0.01" placeholder="50000" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="borrower@example.com" />
          </Field>
          <Field>
            <Label htmlFor="phone">Mobile</Label>
            <Input id="phone" name="phone" placeholder="+91 9876543210" />
          </Field>
          <Field>
            <Label htmlFor="landline">Landline</Label>
            <Input id="landline" name="landline" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Residential Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="current_address_line">Street Address</Label>
            <Input
              id="current_address_line"
              name="current_address_line"
              placeholder="House/Flat No., Building, Area"
              value={currentAddress.line}
              onChange={(e) => handleCurrentChange("line", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field>
              <Label htmlFor="current_city">City</Label>
              <Input
                id="current_city"
                name="current_city"
                value={currentAddress.city}
                onChange={(e) => handleCurrentChange("city", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="current_state">State</Label>
              <Input
                id="current_state"
                name="current_state"
                value={currentAddress.state}
                onChange={(e) => handleCurrentChange("state", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="current_pincode">PIN Code</Label>
              <Input
                id="current_pincode"
                name="current_pincode"
                placeholder="6-digit PIN"
                value={currentAddress.pincode}
                onChange={(e) => handleCurrentChange("pincode", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="current_residence_years">Years at Residence</Label>
              <Input
                id="current_residence_years"
                name="current_residence_years"
                type="number"
                value={currentAddress.years}
                onChange={(e) => handleCurrentChange("years", e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <Label htmlFor="current_residence_type">Residence Type</Label>
            <Select
              name="current_residence_type"
              value={currentAddress.type}
              onValueChange={(val) => handleCurrentChange("type", val ?? "")}
            >
              <SelectTrigger id="current_residence_type" className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Permanent Address</CardTitle>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer rounded-md bg-muted/60 px-2.5 py-1.5 hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={sameAsCurrent}
              onChange={(e) => handleSameAsCurrentToggle(e.target.checked)}
              className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>Same as current address</span>
          </label>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="permanent_address_line">Street Address</Label>
            <Input
              id="permanent_address_line"
              name="permanent_address_line"
              value={permanentAddress.line}
              onChange={(e) => handlePermanentChange("line", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field>
              <Label htmlFor="permanent_city">City</Label>
              <Input
                id="permanent_city"
                name="permanent_city"
                value={permanentAddress.city}
                onChange={(e) => handlePermanentChange("city", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="permanent_state">State</Label>
              <Input
                id="permanent_state"
                name="permanent_state"
                value={permanentAddress.state}
                onChange={(e) => handlePermanentChange("state", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="permanent_pincode">PIN Code</Label>
              <Input
                id="permanent_pincode"
                name="permanent_pincode"
                value={permanentAddress.pincode}
                onChange={(e) => handlePermanentChange("pincode", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="permanent_residence_years">Years at Residence</Label>
              <Input
                id="permanent_residence_years"
                name="permanent_residence_years"
                type="number"
                value={permanentAddress.years}
                onChange={(e) => handlePermanentChange("years", e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <Label htmlFor="permanent_residence_type">Residence Type</Label>
            <Select
              name="permanent_residence_type"
              value={permanentAddress.type}
              onValueChange={(val) => handlePermanentChange("type", val ?? "")}
            >
              <SelectTrigger id="permanent_residence_type" className="w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment / Office Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="office_name">Employer / Business Name</Label>
            <Input id="office_name" name="office_name" />
          </Field>
          <Field>
            <Label htmlFor="office_address">Office Address</Label>
            <Input id="office_address" name="office_address" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="office_landmark">Landmark</Label>
              <Input id="office_landmark" name="office_landmark" />
            </Field>
            <Field>
              <Label htmlFor="office_city">City</Label>
              <Input id="office_city" name="office_city" />
            </Field>
            <Field>
              <Label htmlFor="office_pincode">PIN Code</Label>
              <Input id="office_pincode" name="office_pincode" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="office_landline">Office Contact No.</Label>
              <Input id="office_landline" name="office_landline" />
            </Field>
            <Field>
              <Label htmlFor="office_email">Official Email</Label>
              <Input id="office_email" name="office_email" type="email" />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CorporateFieldsProps {
  onExtractedDataChange?: (data: ExtractedCorporateData | null) => void;
}

function CorporateFields({ onExtractedDataChange }: CorporateFieldsProps) {
  const [extractedDataState, setExtractedDataState] = useState<ExtractedCorporateData | null>(null);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [businessType, setBusinessType] = useState("public");
  const [isRegistered, setIsRegistered] = useState(true);
  const [cin, setCin] = useState("");
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [ownershipType, setOwnershipType] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [landline, setLandline] = useState("");
  const [extractedJson, setExtractedJson] = useState("");

  const [corporateOffice, setCorporateOffice] = useState({
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [registeredOffice, setRegisteredOffice] = useState({
    address: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [sameAsCorporate, setSameAsCorporate] = useState(false);

  function handleCorporateChange(field: string, value: string) {
    const updated = { ...corporateOffice, [field]: value };
    setCorporateOffice(updated);
    if (sameAsCorporate) {
      setRegisteredOffice(updated);
    }
  }

  function handleSameAsCorporateToggle(checked: boolean) {
    setSameAsCorporate(checked);
    if (checked) {
      setRegisteredOffice({ ...corporateOffice });
    }
  }

  function handleRegisteredChange(field: string, value: string) {
    setRegisteredOffice((prev) => ({ ...prev, [field]: value }));
  }

  function handlePdfExtracted(data: ExtractedCorporateData) {
    setExtractedDataState(data);
    onExtractedDataChange?.(data);

    if (data.profile.legal_name) setLegalName(data.profile.legal_name);
    if (data.profile.trade_name) setTradeName(data.profile.trade_name);
    if (data.profile.business_type) setBusinessType(data.profile.business_type);
    if (data.profile.cin) setCin(data.profile.cin);
    if (data.profile.pan) setPan(data.profile.pan);
    if (data.profile.gstin) setGstin(data.profile.gstin);
    if (data.profile.incorporation_date) setIncorporationDate(data.profile.incorporation_date);
    if (data.profile.contact_no) setContactNo(data.profile.contact_no);
    if (data.profile.contact_email) setContactEmail(data.profile.contact_email);

    if (data.profile.corporate_office_address) {
      setCorporateOffice({
        address: data.profile.corporate_office_address || "",
        city: data.profile.corporate_office_city || "",
        state: data.profile.corporate_office_state || "",
        pincode: data.profile.corporate_office_pincode || "",
      });
    }

    if (data.profile.registered_office_address) {
      setRegisteredOffice({
        address: data.profile.registered_office_address || "",
        city: data.profile.registered_office_city || "",
        state: data.profile.registered_office_state || "",
        pincode: data.profile.registered_office_pincode || "",
      });
    }

    setExtractedJson(JSON.stringify(data));
  }

  function handleClearForm() {
    setExtractedDataState(null);
    onExtractedDataChange?.(null);
    setLegalName("");
    setTradeName("");
    setBusinessType("public");
    setIsRegistered(true);
    setCin("");
    setPan("");
    setGstin("");
    setIncorporationDate("");
    setOwnershipType("");
    setContactNo("");
    setContactEmail("");
    setLandline("");
    setCorporateOffice({ address: "", city: "", state: "", pincode: "" });
    setRegisteredOffice({ address: "", city: "", state: "", pincode: "" });
    setSameAsCorporate(false);
    setExtractedJson("");
  }

  return (
    <div className="space-y-6">
      {/* Quick Ingest Panel with PDF & Excel options and Erase Data */}
      <CorporateDataUploader
        onPdfExtracted={handlePdfExtracted}
        onClearForm={handleClearForm}
      />

      {/* Extracted Highlights Card */}
      {extractedDataState?.highlights && (
        <Card className="border-blue-500/20 bg-blue-50/10 dark:bg-blue-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
                Company Regulatory Highlights &amp; Capital Structure
              </span>
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                Official MCA / Regulatory Data
              </Badge>
            </CardTitle>
            {extractedDataState.profile.about && (
              <CardDescription className="text-xs text-foreground/80 mt-1 leading-relaxed">
                {extractedDataState.profile.about}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Authorized Capital</span>
                <span className="font-bold text-foreground text-sm">
                  {extractedDataState.highlights.authorized_capital || "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Paid-Up Capital</span>
                <span className="font-bold text-foreground text-sm">
                  {extractedDataState.highlights.paid_up_capital || "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Sum of Open Charges</span>
                <span className="font-bold text-foreground text-sm">
                  {extractedDataState.highlights.sum_of_charges || "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Listing Status</span>
                <span className="font-bold text-foreground text-sm">
                  {extractedDataState.highlights.listing_status || "—"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Compliance Status</span>
                <span className="font-bold text-emerald-600 text-sm">
                  {extractedDataState.highlights.active_compliance || "ACTIVE"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Last AGM Date</span>
                <span className="font-bold text-foreground text-sm">
                  {extractedDataState.highlights.last_agm_date || "—"}
                </span>
              </div>
              <div className="col-span-2 p-2.5 rounded-lg border bg-background">
                <span className="text-muted-foreground block text-[11px]">Legal Entity Identifier (LEI)</span>
                <span className="font-mono font-bold text-foreground text-xs">
                  {extractedDataState.highlights.lei || "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden input to pass extracted associates & financials to createBorrower */}
      <input type="hidden" name="extracted_json" value={extractedJson} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="legal_name">Legal Name *</Label>
            <Input
              id="legal_name"
              name="legal_name"
              placeholder="Registered Company Name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              required
            />
          </Field>
          <Field>
            <Label htmlFor="trade_name">Trade / Brand Name</Label>
            <Input
              id="trade_name"
              name="trade_name"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="business_type">Business Structure</Label>
              <Select name="business_type" value={businessType} onValueChange={(v) => v && setBusinessType(v)}>
                <SelectTrigger id="business_type" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public Limited</SelectItem>
                  <SelectItem value="private_limited">Private Limited</SelectItem>
                  <SelectItem value="partnership">Partnership Firm</SelectItem>
                  <SelectItem value="llp">LLP</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label className="flex items-center gap-2 pt-7 text-sm font-normal cursor-pointer">
                <input
                  type="checkbox"
                  name="is_registered"
                  className="size-4 rounded"
                  checked={isRegistered}
                  onChange={(e) => setIsRegistered(e.target.checked)}
                />
                Officially Registered Entity
              </Label>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="cin">CIN / LLPIN / Reg. No.</Label>
              <Input
                id="cin"
                name="cin"
                placeholder="U12345MH2020PTC123456"
                value={cin}
                onChange={(e) => setCin(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="pan">Company PAN</Label>
              <Input
                id="pan"
                name="pan"
                placeholder="AAACB1234C"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                name="gstin"
                placeholder="27AAACB1234C1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="incorporation_date">Date of Incorporation</Label>
              <Input
                id="incorporation_date"
                name="incorporation_date"
                type="date"
                value={incorporationDate}
                onChange={(e) => setIncorporationDate(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="ownership_type">Ownership Structure</Label>
              <Input
                id="ownership_type"
                name="ownership_type"
                placeholder="e.g. Domestic / Subsidiary"
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field>
            <Label htmlFor="contact_no">Primary Phone</Label>
            <Input
              id="contact_no"
              name="contact_no"
              placeholder="+91 9876543210"
              value={contactNo}
              onChange={(e) => setContactNo(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="contact_email">Official Email</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              placeholder="contact@company.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="landline">Landline</Label>
            <Input
              id="landline"
              name="landline"
              value={landline}
              onChange={(e) => setLandline(e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corporate Head Office</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="corporate_office_address">Address</Label>
            <Input
              id="corporate_office_address"
              name="corporate_office_address"
              value={corporateOffice.address}
              onChange={(e) => handleCorporateChange("address", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="corporate_office_city">City</Label>
              <Input
                id="corporate_office_city"
                name="corporate_office_city"
                value={corporateOffice.city}
                onChange={(e) => handleCorporateChange("city", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="corporate_office_state">State</Label>
              <Input
                id="corporate_office_state"
                name="corporate_office_state"
                value={corporateOffice.state}
                onChange={(e) => handleCorporateChange("state", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="corporate_office_pincode">PIN Code</Label>
              <Input
                id="corporate_office_pincode"
                name="corporate_office_pincode"
                value={corporateOffice.pincode}
                onChange={(e) => handleCorporateChange("pincode", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Registered Office Address</CardTitle>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer rounded-md bg-muted/60 px-2.5 py-1.5 hover:bg-muted transition-colors">
            <input
              type="checkbox"
              checked={sameAsCorporate}
              onChange={(e) => handleSameAsCorporateToggle(e.target.checked)}
              className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>Same as corporate head office</span>
          </label>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="registered_office_address">Address</Label>
            <Input
              id="registered_office_address"
              name="registered_office_address"
              value={registeredOffice.address}
              onChange={(e) => handleRegisteredChange("address", e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="registered_office_city">City</Label>
              <Input
                id="registered_office_city"
                name="registered_office_city"
                value={registeredOffice.city}
                onChange={(e) => handleRegisteredChange("city", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="registered_office_state">State</Label>
              <Input
                id="registered_office_state"
                name="registered_office_state"
                value={registeredOffice.state}
                onChange={(e) => handleRegisteredChange("state", e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="registered_office_pincode">PIN Code</Label>
              <Input
                id="registered_office_pincode"
                name="registered_office_pincode"
                value={registeredOffice.pincode}
                onChange={(e) => handleRegisteredChange("pincode", e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OtherFields() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Entity Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <Label htmlFor="entity_name">Entity Name *</Label>
          <Input id="entity_name" name="entity_name" placeholder="e.g. Trust / Society Name" required />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <Label htmlFor="entity_category">Entity Category</Label>
            <Input
              id="entity_category"
              name="entity_category"
              placeholder="e.g. Trust, Society, Association of Persons"
            />
          </Field>
          <Field>
            <Label htmlFor="registration_number">Registration / Trust Deed No.</Label>
            <Input id="registration_number" name="registration_number" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <Label htmlFor="pan">Entity PAN</Label>
            <Input id="pan" name="pan" placeholder="ABCDE1234F" />
          </Field>
          <Field>
            <Label htmlFor="address">Registered Address</Label>
            <Input id="address" name="address" />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
