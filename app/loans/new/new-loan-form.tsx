"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  findBorrowerByPan,
  createWholesaleLoanApplication,
  updateWholesaleLoanApplication,
  type BorrowerLookup,
  type CreateWholesaleLoanPayload,
  type UpdateWholesaleLoanPayload,
} from "@/app/loans/actions";
import { InlineBorrowerDialog } from "./inline-borrower-dialog";
import { CollateralDialog, type CollateralItem } from "./collateral-dialog";
import { LASSecuritiesTable } from "./las-securities-table";
import {
  type LASSecurityItem,
  type SecurityProviderOption,
  calculateCoverageRatio,
  getCoverageStatus,
} from "../las-types";
import { ExpandableProfileCard } from "@/components/borrowers/expandable-profile-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Clock,
  Sparkles,
  ShieldCheck,
  Check,
  Building2,
  CreditCard,
  Users,
  Layers,
  ArrowLeft,
  Landmark,
  UserCheck,
} from "lucide-react";

type LoanTypeOption = "LAS (Loan Against Securities)" | "LAP" | "Project Finance" | "Others";

const LOAN_TYPE_OPTIONS: LoanTypeOption[] = [
  "LAS (Loan Against Securities)",
  "LAP",
  "Project Finance",
  "Others",
];

export type WholesaleLoanInitialData = {
  applicationCode?: string;
  primaryBorrower?: BorrowerLookup | null;
  loanType?: LoanTypeOption;
  loanTypeOther?: string;
  requestedAmount?: string | number;
  tenureMonths?: string | number;
  purpose?: string;
  coBorrowers?: BorrowerLookup[];
  guarantors?: Array<{
    borrower: BorrowerLookup;
    guaranteeType: "personal" | "corporate";
    isSecurityProvider?: boolean;
  }>;
  securityProviders?: Array<{
    borrower: BorrowerLookup;
    isGuarantor?: boolean;
    guaranteeType?: "personal" | "corporate";
  }>;
  collaterals?: CollateralItem[];
  lasSecurities?: LASSecurityItem[];
  status?: string;
};

export interface NewWholesaleLoanPageProps {
  initialApplicationCode?: string;
  mode?: "create" | "edit";
  applicationId?: string;
  initialData?: WholesaleLoanInitialData;
}

export function NewWholesaleLoanPage({
  initialApplicationCode = "",
  mode = "create",
  applicationId,
  initialData,
}: NewWholesaleLoanPageProps) {
  const router = useRouter();
  const [isSubmitting, startSubmitting] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 1. Application Code
  const [applicationCode, setApplicationCode] = useState(
    initialData?.applicationCode || initialApplicationCode
  );

  // 2. Primary Borrower Lookup & Verification
  const [primaryPanInput, setPrimaryPanInput] = useState(
    initialData?.primaryBorrower?.pan || ""
  );
  const [isSearchingPrimary, startSearchingPrimary] = useTransition();
  const [primarySearchError, setPrimarySearchError] = useState<string | null>(null);
  const [primaryBorrower, setPrimaryBorrower] = useState<BorrowerLookup | null>(
    initialData?.primaryBorrower || null
  );
  const [primaryNotFound, setPrimaryNotFound] = useState(false);

  // 3. Facility Terms
  const [loanType, setLoanType] = useState<LoanTypeOption>(
    initialData?.loanType ||
      (initialData?.lasSecurities && initialData.lasSecurities.length > 0
        ? "LAS (Loan Against Securities)"
        : "LAP")
  );
  const [loanTypeOther, setLoanTypeOther] = useState(initialData?.loanTypeOther || "");
  const [requestedAmount, setRequestedAmount] = useState<string>(
    initialData?.requestedAmount !== undefined
      ? String(initialData.requestedAmount)
      : "800000000"
  );
  const [tenureMonths, setTenureMonths] = useState<string>(
    initialData?.tenureMonths !== undefined ? String(initialData.tenureMonths) : "72"
  );
  const [purpose, setPurpose] = useState<string>(
    initialData?.purpose !== undefined
      ? initialData.purpose
      : "Business Expansion, Growth Working Capital need and Completion of project"
  );

  // 4. Multi-Party Structure (Co-Borrowers, Guarantors & Security Providers)
  const [coBorrowers, setCoBorrowers] = useState<BorrowerLookup[]>(
    initialData?.coBorrowers || []
  );
  const [guarantors, setGuarantors] = useState<
    Array<{ borrower: BorrowerLookup; guaranteeType: "personal" | "corporate"; isSecurityProvider?: boolean }>
  >(initialData?.guarantors || []);
  const [securityProviders, setSecurityProviders] = useState<
    Array<{ borrower: BorrowerLookup; isGuarantor?: boolean; guaranteeType?: "personal" | "corporate" }>
  >(initialData?.securityProviders || []);

  // 5. Collaterals
  const [collaterals, setCollaterals] = useState<CollateralItem[]>(
    initialData?.collaterals || []
  );
  const [lasSecurities, setLasSecurities] = useState<LASSecurityItem[]>(
    initialData?.lasSecurities || []
  );

  // Dialog states
  const [primaryDialogOpen, setPrimaryDialogOpen] = useState(false);
  const [coBorrowerDialogOpen, setCoBorrowerDialogOpen] = useState(false);
  const [guarantorDialogOpen, setGuarantorDialogOpen] = useState(false);
  const [securityProviderDialogOpen, setSecurityProviderDialogOpen] = useState(false);
  const [collateralDialogOpen, setCollateralDialogOpen] = useState(false);

  // Primary PAN lookup handler
  function handleSearchPrimaryPan() {
    const cleanPan = primaryPanInput.trim().toUpperCase();
    setPrimarySearchError(null);
    setPrimaryNotFound(false);

    if (!cleanPan) {
      setPrimarySearchError("Please enter a valid PAN.");
      return;
    }

    startSearchingPrimary(async () => {
      const res = await findBorrowerByPan(cleanPan);
      if (res) {
        setPrimaryBorrower(res);
        setPrimaryNotFound(false);
      } else {
        setPrimaryNotFound(true);
      }
    });
  }

  // Format currency display
  const amountNum = Number(requestedAmount) || 0;
  const formattedAmount = () => {
    if (amountNum <= 0) return "";
    if (amountNum >= 10000000) {
      const cr = (amountNum / 10000000).toFixed(2);
      return `₹ ${amountNum.toLocaleString("en-IN")} (${cr} Crore)`;
    }
    if (amountNum >= 100000) {
      const lk = (amountNum / 100000).toFixed(2);
      return `₹ ${amountNum.toLocaleString("en-IN")} (${lk} Lakh)`;
    }
    return `₹ ${amountNum.toLocaleString("en-IN")}`;
  };

  // Submit loan origination
  function handleSubmitApplication() {
    setSubmitError(null);

    if (!applicationCode.trim()) {
      setSubmitError("Loan application number is required.");
      return;
    }
    if (!primaryBorrower) {
      setSubmitError("Primary borrower profile is required. Please search PAN or register one inline.");
      return;
    }
    if (amountNum <= 0) {
      setSubmitError("Please enter a valid loan requested amount.");
      return;
    }
    if (!tenureMonths || Number(tenureMonths) <= 0) {
      setSubmitError("Please enter a valid loan repayment tenure.");
      return;
    }
    if (loanType === "Others" && !loanTypeOther.trim()) {
      setSubmitError("Please specify the custom facility type.");
      return;
    }

    if (mode === "edit" && applicationId) {
      const updatePayload: UpdateWholesaleLoanPayload = {
        applicationId,
        application_code: applicationCode.trim(),
        primary_borrower_id: primaryBorrower.id,
        requested_amount: amountNum,
        purpose: purpose.trim(),
        tenure_months: Number(tenureMonths) || 12,
        facility_type: loanType,
        facility_type_other: loanType === "Others" ? loanTypeOther.trim() : undefined,
        co_borrowers: coBorrowers.map((cb, i) => ({
          borrower_id: cb.id,
          order_index: i + 1,
        })),
        guarantors: guarantors.map((g, i) => ({
          borrower_id: g.borrower.id,
          guarantee_type: g.guaranteeType,
          is_security_provider: g.isSecurityProvider,
          order_index: i + 1,
        })),
        security_providers: securityProviders.map((sp, i) => ({
          borrower_id: sp.borrower.id,
          is_guarantor: sp.isGuarantor,
          guarantee_type: sp.guaranteeType,
          order_index: i + 1,
        })),
        collaterals: collaterals.map((c) => ({
          collateral_type: c.collateral_type,
          charge_type: c.charge_type,
          property_status: c.property_status,
          address: c.address,
          city: c.city,
          pincode: c.pincode,
          estimated_value: c.estimated_value,
          details: c.details,
        })),
        las_securities: loanType === "LAS (Loan Against Securities)" ? lasSecurities : undefined,
      };

      startSubmitting(async () => {
        const res = await updateWholesaleLoanApplication(updatePayload);
        if (res.success) {
          router.push(`/loans/${applicationId}`);
        } else {
          setSubmitError(res.error || "Failed to update loan application.");
        }
      });
      return;
    }

    const payload: CreateWholesaleLoanPayload = {
      application_code: applicationCode.trim(),
      primary_borrower_id: primaryBorrower.id,
      requested_amount: amountNum,
      purpose: purpose.trim(),
      tenure_months: Number(tenureMonths) || 12,
      facility_type: loanType,
      facility_type_other: loanType === "Others" ? loanTypeOther.trim() : undefined,
      co_borrowers: coBorrowers.map((cb, i) => ({
        borrower_id: cb.id,
        order_index: i + 1,
      })),
      guarantors: guarantors.map((g, i) => ({
        borrower_id: g.borrower.id,
        guarantee_type: g.guaranteeType,
        is_security_provider: g.isSecurityProvider,
        order_index: i + 1,
      })),
      security_providers: securityProviders.map((sp, i) => ({
        borrower_id: sp.borrower.id,
        is_guarantor: sp.isGuarantor,
        guarantee_type: sp.guaranteeType,
        order_index: i + 1,
      })),
      collaterals: collaterals.map((c) => ({
        collateral_type: c.collateral_type,
        charge_type: c.charge_type,
        property_status: c.property_status,
        address: c.address,
        city: c.city,
        pincode: c.pincode,
        estimated_value: c.estimated_value,
        details: c.details,
      })),
      las_securities: loanType === "LAS (Loan Against Securities)" ? lasSecurities : undefined,
    };

    startSubmitting(async () => {
      const res = await createWholesaleLoanApplication(payload);
      if (res.success && res.applicationId) {
        router.push(`/loans/${res.applicationId}`);
      } else {
        setSubmitError(res.error || "Failed to create loan application.");
      }
    });
  }

  const isLasLoan = loanType === "LAS (Loan Against Securities)";
  const totalLasMarketValue = lasSecurities.reduce((sum, s) => sum + s.market_value, 0);
  const totalLasLoanValue = lasSecurities.reduce((sum, s) => sum + (s.loan_value || 0), 0);
  const effectiveLasBase = amountNum > 0 ? amountNum : totalLasLoanValue;
  const overallLasCoverage = calculateCoverageRatio(totalLasMarketValue, effectiveLasBase);
  const lasCoverStatus = getCoverageStatus(overallLasCoverage);

  // Calculate total collateral value
  const totalCollateralValue = isLasLoan
    ? totalLasMarketValue
    : collaterals.reduce((sum, c) => sum + (c.estimated_value || 0), 0);

  // Available Security Providers pool (Only explicitly registered Security Providers or Guarantors with SP role)
  // NOTE: Primary Borrower and Co-Borrowers are NOT automatically added as Security Providers.
  const availableSecurityProviders = useMemo<SecurityProviderOption[]>(() => {
    const list: SecurityProviderOption[] = [];
    const addedIds = new Set<string>();

    securityProviders.forEach((sp) => {
      if (!addedIds.has(sp.borrower.id)) {
        addedIds.add(sp.borrower.id);
        list.push({
          id: sp.borrower.id,
          name: sp.borrower.displayName,
          pan: sp.borrower.pan,
          isSecurityProvider: true,
          isGuarantor: sp.isGuarantor,
          guaranteeType: sp.guaranteeType,
          isPrimary: primaryBorrower?.id === sp.borrower.id,
        });
      }
    });

    guarantors.forEach((g) => {
      if (g.isSecurityProvider) {
        if (!addedIds.has(g.borrower.id)) {
          addedIds.add(g.borrower.id);
          list.push({
            id: g.borrower.id,
            name: g.borrower.displayName,
            pan: g.borrower.pan,
            isGuarantor: true,
            guaranteeType: g.guaranteeType,
            isSecurityProvider: true,
            isPrimary: primaryBorrower?.id === g.borrower.id,
          });
        } else {
          const item = list.find((x) => x.id === g.borrower.id);
          if (item) {
            item.isGuarantor = true;
            item.guaranteeType = g.guaranteeType;
            item.isSecurityProvider = true;
          }
        }
      }
    });

    return list;
  }, [primaryBorrower, securityProviders, guarantors]);

  // Unified list of all parties attached in Section 3 (Guarantors & Security Providers)
  const attachedObligors = useMemo(() => {
    const map = new Map<
      string,
      {
        borrower: BorrowerLookup;
        isGuarantor: boolean;
        guaranteeType?: "personal" | "corporate";
        isSecurityProvider: boolean;
      }
    >();

    guarantors.forEach((g) => {
      map.set(g.borrower.id, {
        borrower: g.borrower,
        isGuarantor: true,
        guaranteeType: g.guaranteeType,
        isSecurityProvider: Boolean(g.isSecurityProvider),
      });
    });

    securityProviders.forEach((sp) => {
      const existing = map.get(sp.borrower.id);
      if (existing) {
        existing.isSecurityProvider = true;
        if (sp.isGuarantor) existing.isGuarantor = true;
        if (sp.guaranteeType) existing.guaranteeType = sp.guaranteeType;
      } else {
        map.set(sp.borrower.id, {
          borrower: sp.borrower,
          isGuarantor: Boolean(sp.isGuarantor),
          guaranteeType: sp.guaranteeType,
          isSecurityProvider: true,
        });
      }
    });

    return Array.from(map.values());
  }, [guarantors, securityProviders]);

  const suggestedPledgorNames = availableSecurityProviders.map((p) => p.name);

  function handleLasSecuritiesChange(items: LASSecurityItem[]) {
    setLasSecurities(items);
    // If a security is added for the primary borrower, ensure they are registered as a Security Provider
    if (primaryBorrower && items.some((s) => s.pledgor_borrower_id === primaryBorrower.id)) {
      setSecurityProviders((prev) => {
        if (prev.some((sp) => sp.borrower.id === primaryBorrower.id)) return prev;
        return [
          ...prev,
          {
            borrower: primaryBorrower,
            isGuarantor: false,
          },
        ];
      });
    }
  }

  const isFormReady =
    !!primaryBorrower &&
    amountNum > 0 &&
    Number(tenureMonths) > 0;

  return (
    <div className="min-h-screen bg-muted/20 pb-28">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur px-4 sm:px-6 py-3 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={mode === "edit" && applicationId ? `/loans/${applicationId}` : "/loans"}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">
                {mode === "edit" ? "Back to Dossier" : "Pipeline"}
              </span>
            </Link>
            <span className="text-muted-foreground/40">|</span>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                {mode === "edit" ? "Edit Loan Application" : "New Loan Origination"}
                <Badge variant="outline" className="font-mono text-[10px]">
                  {applicationCode || "Draft"}
                </Badge>
                {mode === "edit" && initialData?.status && (
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {initialData.status.replace(/_/g, " ")}
                  </Badge>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleSubmitApplication}
              disabled={isSubmitting || !isFormReady}
              size="sm"
              className="gap-1.5 text-xs font-semibold h-8 px-3.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {mode === "edit" ? "Saving..." : "Submitting..."}
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  {mode === "edit" ? "Save Changes" : "Submit Application"}
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
        {submitError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs sm:text-sm text-destructive flex items-center gap-2.5 animate-in fade-in-50">
            <AlertCircle className="size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 1: Primary Borrower & Application Code */}
        {/* ========================================================= */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">1. Borrowers & Facility Code</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Assign the facility application code and attach the principal borrower and any joint co-borrowers.
                  </CardDescription>
                </div>
              </div>
              {primaryBorrower && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] gap-1 shrink-0 font-medium">
                  <CheckCircle2 className="size-3" /> Borrower Linked
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Application Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="app_code_input" className="text-xs font-semibold">
                    Application Code *
                  </Label>
                  {mode !== "edit" && (
                    <button
                      type="button"
                      onClick={() => {
                        const rand = Math.floor(1000 + Math.random() * 9000);
                        setApplicationCode(`LA-${new Date().getFullYear()}-${rand}`);
                      }}
                      className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <Sparkles className="size-3" /> Auto-generate
                    </button>
                  )}
                </div>
                <Input
                  id="app_code_input"
                  value={applicationCode}
                  onChange={(e) => setApplicationCode(e.target.value)}
                  placeholder="e.g. LA-2026-0001"
                  className="font-mono h-9 text-xs sm:text-sm"
                  disabled={mode === "edit"}
                  required
                />
              </div>

              {/* Primary Applicant Lookup (Application #, PAN, or Borrower Code) */}
              <div className="space-y-1.5">
                <Label htmlFor="primary_pan_input" className="text-xs font-semibold">
                  Primary Applicant (Application #, PAN, or Borrower ID) *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_pan_input"
                    value={primaryPanInput}
                    onChange={(e) => {
                      setPrimaryPanInput(e.target.value.toUpperCase());
                      setPrimarySearchError(null);
                      setPrimaryNotFound(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchPrimaryPan();
                      }
                    }}
                    placeholder="e.g. LA-2026-0001, ACDFA1362N, or BRW-..."
                    className="font-mono uppercase tracking-wider h-9 text-xs sm:text-sm"
                    maxLength={35}
                    disabled={!!primaryBorrower}
                  />
                  {!primaryBorrower ? (
                    <Button
                      type="button"
                      onClick={handleSearchPrimaryPan}
                      disabled={isSearchingPrimary || !primaryPanInput.trim()}
                      size="sm"
                      className="h-9 px-4 shrink-0 text-xs font-medium"
                    >
                      {isSearchingPrimary ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                      <span className="ml-1.5 hidden sm:inline">Check LMS</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrimaryBorrower(null);
                        setPrimaryPanInput("");
                      }}
                      className="h-9 shrink-0 text-xs"
                    >
                      Change
                    </Button>
                  )}
                </div>
                {primarySearchError && <p className="text-xs text-destructive">{primarySearchError}</p>}
              </div>
            </div>

            {/* Verified Profile Card with Expandable Details */}
            {primaryBorrower && (
              <ExpandableProfileCard
                borrower={primaryBorrower}
                role="Primary Borrower"
                isVerified
                extraAction={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPrimaryBorrower(null);
                      setPrimaryPanInput("");
                    }}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Change
                  </Button>
                }
              />
            )}

            {/* Not Found State -> Inline Create */}
            {primaryNotFound && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 animate-in fade-in-50">
                <div className="text-xs">
                  <span className="font-bold text-foreground">
                    No borrower profile found for PAN {primaryPanInput}
                  </span>
                  <p className="text-muted-foreground mt-0.5">
                    Register this entity or individual inline now. It will be saved into LMS and attached as Primary Borrower.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPrimaryDialogOpen(true)}
                  className="shrink-0 gap-1.5 h-8 text-xs font-semibold"
                >
                  <Plus className="size-3.5" />
                  Create Profile Inline
                </Button>
              </div>
            )}

            {/* Co-Borrowers (Joint Applicants) - Positioned directly below Primary Borrower */}
            <div className="pt-5 border-t border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Co-Borrowers ({coBorrowers.length})
                    </Label>
                    <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Joint obligants holding shared liability for loan repayment.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCoBorrowerDialogOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Add Co-Borrower
                </Button>
              </div>

              {coBorrowers.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-muted/10">
                  No co-borrowers attached. Click &quot;Add Co-Borrower&quot; to search by PAN or register one inline.
                </div>
              ) : (
                <div className="space-y-2">
                  {coBorrowers.map((cb, idx) => (
                    <ExpandableProfileCard
                      key={cb.id}
                      borrower={cb}
                      role="Co-Borrower"
                      roleIndex={idx + 1}
                      onRemove={() => setCoBorrowers((prev) => prev.filter((item) => item.id !== cb.id))}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 2: Facility Terms, Amount & Tenure */}
        {/* ========================================================= */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                <CreditCard className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">2. Facility Terms & Commercials</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configure the commercial facility structure, repayment duration, and business purpose.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-5">
            {/* Loan Type Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                Loan Type / Facility *
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {LOAN_TYPE_OPTIONS.map((type) => (
                  <label
                    key={type}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all",
                      loanType === type
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-2xs"
                        : "border-border/70 hover:bg-muted/50 text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name="loan_facility_type"
                      value={type}
                      checked={loanType === type}
                      onChange={() => setLoanType(type)}
                      className="size-3.5 accent-primary text-primary"
                    />
                    <span className="truncate">{type}</span>
                  </label>
                ))}
              </div>

              {/* If Others is selected, show specify input */}
              {loanType === "Others" && (
                <div className="pt-1.5 animate-in fade-in-50">
                  <Input
                    value={loanTypeOther}
                    onChange={(e) => setLoanTypeOther(e.target.value)}
                    placeholder="Specify custom facility type (e.g. Channel Finance, Mezzanine Debt)..."
                    className="h-9 text-xs"
                    required
                  />
                </div>
              )}
            </div>

            {/* Amount & Tenure Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Requested Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="requested_amount_input" className="text-xs font-semibold">
                    Requested Loan Amount (₹) *
                  </Label>
                  {formattedAmount() && (
                    <span className="text-[11px] font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                      {formattedAmount()}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground font-semibold text-xs">₹</span>
                  <Input
                    id="requested_amount_input"
                    type="number"
                    step="10000"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    className="pl-7 font-mono font-bold text-sm h-9"
                    placeholder="e.g. 800000000"
                    required
                  />
                </div>

                {/* Quick amount pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: "₹ 5 Cr", val: 50000000 },
                    { label: "₹ 10 Cr", val: 100000000 },
                    { label: "₹ 25 Cr", val: 250000000 },
                    { label: "₹ 50 Cr", val: 500000000 },
                    { label: "₹ 80 Cr", val: 800000000 },
                    { label: "₹ 100 Cr", val: 1000000000 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setRequestedAmount(p.val.toString())}
                      className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded border transition-colors",
                        requestedAmount === p.val.toString()
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenure */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tenure_input" className="text-xs font-semibold">
                    Repayment Tenure (Months) *
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {tenureMonths ? `${tenureMonths} Months (${(Number(tenureMonths) / 12).toFixed(1)} Years)` : ""}
                  </span>
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    id="tenure_input"
                    type="number"
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    className="pl-8 font-mono font-bold text-sm h-9"
                    placeholder="e.g. 72"
                    required
                  />
                </div>

                {/* Quick tenure pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[12, 24, 36, 48, 60, 72, 84, 120].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTenureMonths(m.toString())}
                      className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded border transition-colors",
                        tenureMonths === m.toString()
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Purpose of Loan */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="purpose_input" className="text-xs font-semibold">
                Purpose of Loan *
              </Label>
              <Input
                id="purpose_input"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Business Expansion, Growth Working Capital Need and Completion of project"
                className="h-9 text-xs"
                required
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Business Expansion",
                  "Growth Working Capital Need",
                  "Completion of Project",
                  "Debt Refinancing / Takeover",
                  "Inventory Funding",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (!purpose.includes(chip)) {
                        setPurpose((prev) => (prev ? `${prev}, ${chip}` : chip));
                      }
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 3: Guarantors & Security Providers */}
        {/* ========================================================= */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-4 border-b">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Users className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">3. Guarantors & Security Providers</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">Credit Enhancement</Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Attach financial guarantors (Personal/Corporate Guarantee) and security providers (pledging collateral/shares).
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {primaryBorrower && !securityProviders.some((sp) => sp.borrower.id === primaryBorrower.id) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSecurityProviders((prev) => [
                        ...prev,
                        {
                          borrower: primaryBorrower,
                          isGuarantor: false,
                        },
                      ]);
                    }}
                    className="h-8 text-xs gap-1.5 border-dashed text-primary hover:bg-primary/5"
                  >
                    <UserCheck className="size-3.5 text-primary" />
                    + Add Primary Borrower as Pledgor
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSecurityProviderDialogOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" />
                  + Security Provider
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGuarantorDialogOpen(true)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" />
                  + Guarantor
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            {attachedObligors.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-muted/10">
                No guarantors or security providers attached yet. Click above to search by PAN or register inline.
              </div>
            ) : (
              <div className="space-y-2">
                {attachedObligors.map((party, idx) => {
                  const isDual = party.isGuarantor && party.isSecurityProvider;
                  const roleLabel = isDual
                    ? "Guarantor & Security Provider"
                    : party.isSecurityProvider
                      ? "Security Provider"
                      : "Guarantor";

                  return (
                    <ExpandableProfileCard
                      key={party.borrower.id}
                      borrower={party.borrower}
                      role={roleLabel}
                      roleIndex={idx + 1}
                      guaranteeType={party.guaranteeType}
                      onRemove={() => {
                        setGuarantors((prev) => prev.filter((item) => item.borrower.id !== party.borrower.id));
                        setSecurityProviders((prev) => prev.filter((item) => item.borrower.id !== party.borrower.id));
                      }}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* SECTION 4: Pledged Collaterals / LAS Securities */}
        {/* ========================================================= */}
        {loanType === "LAS (Loan Against Securities)" ? (
          <div className="space-y-4">
            <LASSecuritiesTable
              securities={lasSecurities}
              onChange={handleLasSecuritiesChange}
              requestedLoanAmount={amountNum}
              providers={availableSecurityProviders}
              onAddNewProvider={() => setSecurityProviderDialogOpen(true)}
              suggestedPledgors={suggestedPledgorNames}
              primaryBorrower={
                primaryBorrower
                  ? {
                      id: primaryBorrower.id,
                      name: primaryBorrower.displayName,
                      pan: primaryBorrower.pan,
                      isPrimary: true,
                      isSecurityProvider: true,
                    }
                  : null
              }
              onAddPrimaryBorrowerAsProvider={() => {
                if (!primaryBorrower) return;
                setSecurityProviders((prev) => {
                  if (prev.some((sp) => sp.borrower.id === primaryBorrower.id)) return prev;
                  return [
                    ...prev,
                    {
                      borrower: primaryBorrower,
                      isGuarantor: false,
                    },
                  ];
                });
              }}
            />
          </div>
        ) : (
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold">4. Pledged Collaterals</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">Optional</Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Pledge immovable properties, commercial assets, or liquid securities against this facility.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCollateralDialogOpen(true)}
                  className="h-8 text-xs gap-1.5 shrink-0"
                >
                  <Plus className="size-3.5" />
                  Add Collateral
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              {collaterals.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-muted/10">
                  No collateral properties added yet. Click &quot;Add Collateral&quot; to record pledged immovable or liquid assets.
                </div>
              ) : (
                <div className="space-y-2">
                  {collaterals.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border bg-card border-border/70 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground">{c.collateral_type}</span>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {c.charge_type.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {c.property_status}
                          </Badge>
                          <span className="text-xs font-bold text-primary font-mono ml-1">
                            ₹ {c.estimated_value.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">📍 {c.address} {c.city ? `, ${c.city}` : ""}</p>
                        {c.details && <p className="text-[11px] text-muted-foreground italic">Note: {c.details}</p>}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setCollaterals((prev) => prev.filter((item) => item.id !== c.id))}
                        className="text-muted-foreground hover:text-destructive h-7 px-2 shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ========================================================= */}
        {/* SECTION 5: Origination Dossier Summary & Final Submission */}
        {/* ========================================================= */}
        <Card className="shadow-xs border-primary/20 bg-card">
          <CardHeader className="pb-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Origination Dossier Summary
                </CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                Ready to Originate
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Application Code</span>
                <span className="font-mono font-bold text-foreground">{applicationCode || "Draft"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Primary Borrower</span>
                <span className="font-semibold text-foreground truncate block">
                  {primaryBorrower?.displayName || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Requested Facility</span>
                <span className="font-bold text-primary font-mono block">
                  {formattedAmount() || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Facility Type & Tenure</span>
                <span className="font-medium text-foreground block">
                  {loanType === "Others" ? loanTypeOther || "Others" : loanType} • {tenureMonths || "0"}m
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Co-Borrowers</span>
                <span className="font-medium text-foreground">{coBorrowers.length} Obligants</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Guarantors</span>
                <span className="font-medium text-foreground">{guarantors.length} Guarantees</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Collaterals Pledged
                </span>
                <span className="font-medium text-foreground">
                  {collaterals.length} Assets
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  Total Collateral Value
                </span>
                <span className="font-mono font-bold text-foreground">
                  ₹ {totalCollateralValue.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                {!primaryBorrower ? (
                  <span className="text-amber-600 font-medium">⚠️ Primary applicant must be verified before submission.</span>
                ) : amountNum <= 0 ? (
                  <span className="text-amber-600 font-medium">⚠️ Please specify a valid requested loan amount.</span>
                ) : (
                  <span className="text-emerald-600 font-medium">✓ All mandatory fields completed. Ready to submit.</span>
                )}
              </p>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Link
                  href={mode === "edit" && applicationId ? `/loans/${applicationId}` : "/loans"}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
                >
                  Cancel
                </Link>
                <Button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={isSubmitting || !isFormReady}
                  className="gap-2 text-xs font-semibold h-10 px-6 shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {mode === "edit" ? "Saving Changes..." : "Creating Application..."}
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      {mode === "edit" ? "Save Changes" : "Create & Submit Application"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Floating Bottom Bar on Mobile/Scroll */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t bg-card/95 backdrop-blur px-4 py-2.5 shadow-lg sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs truncate">
            <span className="font-bold text-foreground block truncate">
              {primaryBorrower?.displayName || "Primary applicant pending"}
            </span>
            <span className="text-primary font-mono font-semibold text-[11px]">
              {formattedAmount() || "₹ 0"}
            </span>
          </div>
          <Button
            type="button"
            onClick={handleSubmitApplication}
            disabled={isSubmitting || !isFormReady}
            size="sm"
            className="gap-1.5 text-xs font-semibold shrink-0"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Submit
          </Button>
        </div>
      </div>

      {/* Dialog for Primary Borrower creation */}
      <InlineBorrowerDialog
        open={primaryDialogOpen}
        onOpenChange={setPrimaryDialogOpen}
        title="Register Primary Borrower"
        description="Enter the company or individual details to save to LMS and attach as Primary Borrower."
        role="primary_borrower"
        defaultPan={primaryPanInput}
        onSelected={(borrower) => {
          setPrimaryBorrower(borrower);
          setPrimaryPanInput(borrower.pan);
          setPrimaryNotFound(false);
        }}
      />

      {/* Dialog for Co-Borrower lookup & creation */}
      <InlineBorrowerDialog
        open={coBorrowerDialogOpen}
        onOpenChange={setCoBorrowerDialogOpen}
        title="Add Co-Borrower"
        description="Enter PAN number to verify and attach a co-borrower to this loan application."
        role="co_borrower"
        onSelected={(borrower) => {
          if (
            borrower.id !== primaryBorrower?.id &&
            !coBorrowers.some((cb) => cb.id === borrower.id)
          ) {
            setCoBorrowers((prev) => [...prev, borrower]);
          }
        }}
      />

      {/* Dialog for Guarantor lookup & creation */}
      <InlineBorrowerDialog
        open={guarantorDialogOpen}
        onOpenChange={setGuarantorDialogOpen}
        title="Add Guarantor"
        description="Enter PAN number to verify and attach a guarantor or security provider to this facility."
        role="guarantor"
        onSelected={(borrower, guaranteeType, options) => {
          const isG = options?.isGuarantor !== false;
          const isSP = Boolean(options?.isSecurityProvider);

          if (isG) {
            setGuarantors((prev) => {
              if (prev.some((g) => g.borrower.id === borrower.id)) {
                return prev.map((g) =>
                  g.borrower.id === borrower.id
                    ? { ...g, guaranteeType: guaranteeType || g.guaranteeType, isSecurityProvider: isSP }
                    : g
                );
              }
              return [
                ...prev,
                {
                  borrower,
                  guaranteeType: guaranteeType || (borrower.borrower_type === "individual" ? "personal" : "corporate"),
                  isSecurityProvider: isSP,
                },
              ];
            });
          }

          if (isSP) {
            setSecurityProviders((prev) => {
              if (prev.some((p) => p.borrower.id === borrower.id)) return prev;
              return [...prev, { borrower, isGuarantor: isG, guaranteeType }];
            });
          }
        }}
      />

      {/* Dialog for Security Provider lookup & creation */}
      <InlineBorrowerDialog
        open={securityProviderDialogOpen}
        onOpenChange={setSecurityProviderDialogOpen}
        title="Register Security Provider (Pledgor)"
        description="Enter PAN number to verify and attach a security provider pledging shares or collateral."
        role="security_provider"
        onSelected={(borrower, guaranteeType, options) => {
          const isSP = options?.isSecurityProvider !== false;
          const isG = Boolean(options?.isGuarantor);

          if (isSP) {
            setSecurityProviders((prev) => {
              if (prev.some((p) => p.borrower.id === borrower.id)) return prev;
              return [...prev, { borrower, isGuarantor: isG, guaranteeType }];
            });
          }

          if (isG) {
            setGuarantors((prev) => {
              if (prev.some((g) => g.borrower.id === borrower.id)) return prev;
              return [
                ...prev,
                {
                  borrower,
                  guaranteeType: guaranteeType || (borrower.borrower_type === "individual" ? "personal" : "corporate"),
                  isSecurityProvider: isSP,
                },
              ];
            });
          }
        }}
      />

      {/* Dialog for adding collateral */}
      <CollateralDialog
        open={collateralDialogOpen}
        onOpenChange={setCollateralDialogOpen}
        onAdd={(item) => setCollaterals((prev) => [...prev, item])}
      />
    </div>
  );
}
