"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  searchApprovedApplications,
  bookActiveFacility,
  createDemoFacility,
  type ApplicationSearchResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Loader2,
  Landmark,
  ArrowRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BookFacilityDialogProps {
  onFacilityBooked?: () => void;
  triggerButton?: React.ReactNode;
}

export function BookFacilityDialog({
  onFacilityBooked,
  triggerButton,
}: BookFacilityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Application search states
  const [searchQuery, setSearchQuery] = useState("");
  const [applications, setApplications] = useState<ApplicationSearchResult[]>([]);
  const [isSearching, startSearching] = useTransition();
  const [selectedApp, setSelectedApp] = useState<ApplicationSearchResult | null>(null);

  // Sanction terms
  const [sanctionedAmount, setSanctionedAmount] = useState<string>("");
  const [interestRate, setInterestRate] = useState<string>("11.25");
  const [tenureMonths, setTenureMonths] = useState<string>("60");
  const [sanctionDate, setSanctionDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Submission states
  const [isSubmitting, startSubmitting] = useTransition();
  const [isSeedingDemo, startSeedingDemo] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  function handleCreateDemo() {
    setErrorMessage(null);
    startSeedingDemo(async () => {
      const res = await createDemoFacility();
      if (!res.success) {
        setErrorMessage(res.error || "Failed to generate demo facility.");
        return;
      }
      setSuccessCode(res.loanCode || "New Facility");
      router.refresh();
      if (onFacilityBooked) onFacilityBooked();
    });
  }

  // Initial load when dialog opens
  useEffect(() => {
    if (open) {
      startSearching(async () => {
        const results = await searchApprovedApplications();
        setApplications(results);
      });
    } else {
      // Reset on close
      setSelectedApp(null);
      setSearchQuery("");
      setErrorMessage(null);
      setSuccessCode(null);
    }
  }, [open]);

  function handleSearch(queryText: string) {
    setSearchQuery(queryText);
    startSearching(async () => {
      const results = await searchApprovedApplications(queryText);
      setApplications(results);
    });
  }

  function handleSelectApplication(app: ApplicationSearchResult) {
    if (app.already_booked) return;
    setSelectedApp(app);
    setSanctionedAmount(app.requested_amount ? String(app.requested_amount) : "");
    if (app.tenure_months) setTenureMonths(String(app.tenure_months));
    setErrorMessage(null);
  }

  const amountNum = Number(sanctionedAmount) || 0;
  const formattedAmount = () => {
    if (amountNum <= 0) return "";
    if (amountNum >= 10000000) {
      return `₹ ${amountNum.toLocaleString("en-IN")} (${(amountNum / 10000000).toFixed(2)} Crore)`;
    }
    if (amountNum >= 100000) {
      return `₹ ${amountNum.toLocaleString("en-IN")} (${(amountNum / 100000).toFixed(2)} Lakh)`;
    }
    return `₹ ${amountNum.toLocaleString("en-IN")}`;
  };

  function handleBook() {
    setErrorMessage(null);

    if (!selectedApp) {
      setErrorMessage("Please select a loan application.");
      return;
    }

    if (amountNum <= 0) {
      setErrorMessage("Please enter a valid sanctioned amount.");
      return;
    }

    const rateNum = Number(interestRate);
    if (isNaN(rateNum) || rateNum <= 0 || rateNum > 100) {
      setErrorMessage("Please enter a valid interest rate (0.1% - 100% p.a.).");
      return;
    }

    const tenureNum = Number(tenureMonths);
    if (isNaN(tenureNum) || tenureNum <= 0) {
      setErrorMessage("Please enter a valid loan tenure in months.");
      return;
    }

    startSubmitting(async () => {
      const res = await bookActiveFacility({
        loan_application_id: selectedApp.id,
        sanctioned_amount: amountNum,
        interest_rate: rateNum,
        tenure_months: tenureNum,
        sanctioned_at: new Date(sanctionDate).toISOString(),
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to book active facility.");
        return;
      }

      setSuccessCode(res.loanCode || "New Facility");
      router.refresh();
      if (onFacilityBooked) onFacilityBooked();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          (triggerButton as React.ReactElement) || (
            <Button size="sm" className="gap-1.5 h-9 text-xs font-semibold shadow-xs">
              <PlusCircle className="size-3.5" />
              <span>Book Active Facility</span>
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Landmark className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">Book Active Facility (LMS)</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Convert a vetted credit application into a live sanctioned account in the servicing ledger.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successCode ? (
          <div className="py-6 space-y-4 text-center">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">
                Facility Successfully Booked!
              </h3>
              <p className="text-xs text-muted-foreground">
                Official Facility Code:{" "}
                <span className="font-mono font-bold text-foreground text-sm">
                  {successCode}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                This account is now active in the Loan Servicing Ledger. You can now record tranche disbursements, generate amortization schedules, and track repayments.
              </p>
            </div>

            <Button
              className="mt-4 text-xs font-semibold"
              onClick={() => setOpen(false)}
            >
              Go to Active Facilities Registry
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {errorMessage && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* STEP 1: Select or Search Application Number */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1. Lookup by Loan Application Number
                </Label>
                {selectedApp && (
                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Change Application
                  </button>
                )}
              </div>

              {!selectedApp ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Type Application Number (e.g. APP-2026-0001) or Borrower PAN..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9 text-xs h-9"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Application Search Results List */}
                  <div className="max-h-52 overflow-y-auto rounded-lg border divide-y bg-muted/20">
                    {applications.length > 0 ? (
                      applications.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => handleSelectApplication(app)}
                          className={cn(
                            "p-3 text-xs transition-colors flex items-center justify-between gap-3",
                            app.already_booked
                              ? "opacity-60 bg-muted/40 cursor-not-allowed"
                              : "hover:bg-primary/5 cursor-pointer"
                          )}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-primary">
                                {app.application_code}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 h-4 capitalize",
                                  app.status === "approved"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                )}
                              >
                                {app.status.replace("_", " ")}
                              </Badge>
                              {app.already_booked && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                >
                                  Booked: #{app.linked_loan_code}
                                </Badge>
                              )}
                            </div>

                            <p className="font-medium text-foreground truncate">
                              {app.borrower.displayName}
                            </p>

                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                              {app.borrower.pan && <span>PAN: {app.borrower.pan}</span>}
                              <span>&middot;</span>
                              <span>
                                Req: ₹{" "}
                                {Number(app.requested_amount).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {app.already_booked ? (
                              <span className="text-[11px] text-muted-foreground italic">
                                Active Facility
                              </span>
                            ) : (
                              <Button
                                size="xs"
                                variant="outline"
                                className="h-7 text-xs font-medium gap-1"
                              >
                                Select <ArrowRight className="size-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-muted-foreground text-xs">
                        {isSearching ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="size-4 animate-spin text-primary" />
                            <span>Searching applications...</span>
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            <p className="font-semibold text-foreground">No loan applications found</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                              No loan applications exist in the database yet. You can generate a sample commercial credit facility to test the LMS servicing ledger immediately.
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={isSeedingDemo}
                              onClick={handleCreateDemo}
                              className="mt-1 text-xs gap-1.5 font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
                            >
                              {isSeedingDemo ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Generating Sample Facility...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="size-3.5 text-emerald-600" />
                                  <span>Generate Sample Facility (1-Click)</span>
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Selected Application Preview Dossier */
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">
                          {selectedApp.application_code}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 uppercase font-semibold"
                        >
                          ✓ Credit Committee Approved
                        </Badge>
                      </div>
                      <h4 className="text-sm font-bold text-foreground mt-1">
                        {selectedApp.borrower.displayName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {selectedApp.borrower.pan ? `PAN: ${selectedApp.borrower.pan}` : ""}{" "}
                        &middot; {selectedApp.borrower.borrower_type.toUpperCase()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">
                        Requested Facility
                      </span>
                      <span className="text-sm font-bold font-mono text-foreground">
                        ₹ {selectedApp.requested_amount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="pt-2 border-t border-primary/20 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-background/80 text-foreground font-medium border">
                      Type: {selectedApp.facility_type || "Commercial Loan"}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-background/80 text-foreground font-medium border">
                      Tenure: {selectedApp.tenure_months || 60} Months
                    </span>
                    {selectedApp.collateralsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-background/80 text-foreground font-medium border">
                        {selectedApp.collateralsCount} Pledged Collateral(s)
                      </span>
                    )}
                    {selectedApp.partiesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-background/80 text-foreground font-medium border">
                        {selectedApp.partiesCount} Co-Borrower(s)/Guarantor(s)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: Sanctioned Terms Review */}
            {selectedApp && (
              <div className="space-y-4 pt-2 border-t">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Sanctioned Terms &amp; Conditions
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sanctioned Limit */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="sanctionedAmount" className="text-xs font-medium">
                      Final Sanctioned Limit (₹) *
                    </Label>
                    <Input
                      id="sanctionedAmount"
                      type="number"
                      placeholder="e.g. 500000000"
                      value={sanctionedAmount}
                      onChange={(e) => setSanctionedAmount(e.target.value)}
                      className="font-mono text-sm h-9"
                    />
                    {formattedAmount() && (
                      <p className="text-xs text-primary font-medium">
                        {formattedAmount()}
                      </p>
                    )}
                  </div>

                  {/* Interest Rate */}
                  <div className="space-y-1.5">
                    <Label htmlFor="interestRate" className="text-xs font-medium">
                      Annual Interest Rate (% p.a.) *
                    </Label>
                    <div className="relative">
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.05"
                        placeholder="11.25"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="font-mono text-xs h-9 pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Tenure Months */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tenureMonths" className="text-xs font-medium">
                      Tenure (Months) *
                    </Label>
                    <div className="relative">
                      <Input
                        id="tenureMonths"
                        type="number"
                        placeholder="60"
                        value={tenureMonths}
                        onChange={(e) => setTenureMonths(e.target.value)}
                        className="font-mono text-xs h-9 pr-12"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                        Mo
                      </span>
                    </div>
                  </div>

                  {/* Sanction Date */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="sanctionDate" className="text-xs font-medium">
                      Official Sanction Date
                    </Label>
                    <div className="relative">
                      <Input
                        id="sanctionDate"
                        type="date"
                        value={sanctionDate}
                        onChange={(e) => setSanctionDate(e.target.value)}
                        className="text-xs h-9 pl-9"
                      />
                      <Calendar className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!successCode && (
          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleBook}
              disabled={!selectedApp || isSubmitting}
              className="gap-1.5 font-medium shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Booking Facility...</span>
                </>
              ) : (
                <>
                  <Landmark className="size-3.5" />
                  <span>Book Active Facility ➔</span>
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
