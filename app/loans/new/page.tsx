"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  findBorrowerByPan,
  createLoanApplicationForExistingBorrower,
  createBorrowerAndLoanApplication,
  type BorrowerLookup,
  type LoanOriginationState,
} from "@/app/loans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialActionState: LoanOriginationState = { error: null };

type Step = "application_number" | "found" | "not_found";

export default function NewLoanOriginationPage() {
  const [step, setStep] = useState<Step>("application_number");
  const [applicationCode, setApplicationCode] = useState("");
  const [panDialogOpen, setPanDialogOpen] = useState(false);
  const [pan, setPan] = useState("");
  const [borrower, setBorrower] = useState<BorrowerLookup | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <Link href="/loans" className="text-sm font-medium text-muted-foreground hover:underline">
          &larr; Loan applications
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">New loan origination</h1>
      </header>

      <main className="mx-auto max-w-xl p-6">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="application_code">Loan application number *</Label>
                {step === "application_number" && (
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(1000 + Math.random() * 9000);
                      setApplicationCode(`LA-${new Date().getFullYear()}-${rand}`);
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Auto-generate
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="application_code"
                  value={applicationCode}
                  onChange={(e) => setApplicationCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && applicationCode.trim()) {
                      e.preventDefault();
                      setPanDialogOpen(true);
                    }
                  }}
                  disabled={step !== "application_number"}
                  placeholder="e.g. LA-2026-0001"
                />
              </div>
            </div>

            {step === "application_number" && (
              <Button
                type="button"
                disabled={!applicationCode.trim()}
                onClick={() => setPanDialogOpen(true)}
              >
                Continue
              </Button>
            )}

            {step !== "application_number" && (
              <button
                type="button"
                onClick={() => {
                  setStep("application_number");
                  setBorrower(null);
                }}
                className="text-sm font-medium text-muted-foreground hover:underline"
              >
                &larr; Start over
              </button>
            )}
          </CardContent>
        </Card>

        {step === "found" && borrower && (
          <FoundBorrowerForm applicationCode={applicationCode} borrower={borrower} />
        )}

        {step === "not_found" && <NewBorrowerForm applicationCode={applicationCode} pan={pan} />}
      </main>

      <PanLookupDialog
        open={panDialogOpen}
        onOpenChange={setPanDialogOpen}
        onResolved={(result, enteredPan) => {
          setBorrower(result);
          setPan(enteredPan);
          setStep(result ? "found" : "not_found");
          setPanDialogOpen(false);
        }}
      />
    </div>
  );
}

function PanLookupDialog({
  open,
  onOpenChange,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (result: BorrowerLookup | null, pan: string) => void;
}) {
  const [pan, setPan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();

  function handleSearch() {
    setError(null);
    const trimmed = pan.trim().toUpperCase();

    if (!trimmed) {
      setError("Enter the borrower's PAN.");
      return;
    }

    startSearch(async () => {
      const result = await findBorrowerByPan(trimmed);
      onResolved(result, trimmed);
      setPan("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSearching) {
          onOpenChange(next);
          if (!next) {
            setPan("");
            setError(null);
          }
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter borrower PAN</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="pan_lookup">Borrower PAN *</Label>
          <Input
            id="pan_lookup"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FoundBorrowerForm({
  applicationCode,
  borrower,
}: {
  applicationCode: string;
  borrower: BorrowerLookup;
}) {
  const [state, formAction, pending] = useActionState(
    createLoanApplicationForExistingBorrower,
    initialActionState,
  );

  return (
    <Card className="mt-4">
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="application_code" value={applicationCode} />
          <input type="hidden" name="borrower_id" value={borrower.id} />

          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Profile found: <strong>{borrower.displayName}</strong> ({borrower.borrower_code},{" "}
            <span className="capitalize">{borrower.borrower_type}</span>)
          </div>

          <div className="space-y-2">
            <Label htmlFor="requested_amount">Requested amount *</Label>
            <Input id="requested_amount" name="requested_amount" type="number" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" name="purpose" />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create loan application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NewBorrowerForm({ applicationCode, pan }: { applicationCode: string; pan: string }) {
  const [state, formAction, pending] = useActionState(
    createBorrowerAndLoanApplication,
    initialActionState,
  );
  const [borrowerType, setBorrowerType] = useState<"individual" | "corporate" | "other">(
    "individual",
  );

  return (
    <Card className="mt-4">
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="application_code" value={applicationCode} />
          <input type="hidden" name="pan" value={pan} />

          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            No profile found for PAN <strong>{pan}</strong>. Create a new borrower profile to
            continue.
          </div>

          <div>
            <Label className="mb-2">Borrower type</Label>
            <ToggleGroup
              value={[borrowerType]}
              onValueChange={(values) => {
                const value = values[0] as typeof borrowerType | undefined;
                if (value) setBorrowerType(value);
              }}
              variant="outline"
            >
              <ToggleGroupItem value="individual" className="capitalize">
                Individual
              </ToggleGroupItem>
              <ToggleGroupItem value="corporate" className="capitalize">
                Corporate
              </ToggleGroupItem>
              <ToggleGroupItem value="other" className="capitalize">
                Other
              </ToggleGroupItem>
            </ToggleGroup>
            <input type="hidden" name="borrower_type" value={borrowerType} />
          </div>

          {borrowerType === "individual" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
              </div>
            </div>
          )}

          {borrowerType === "corporate" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legal_name">Legal name *</Label>
                <Input id="legal_name" name="legal_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN</Label>
                <Input id="gstin" name="gstin" />
              </div>
            </div>
          )}

          {borrowerType === "other" && (
            <div className="space-y-2">
              <Label htmlFor="entity_name">Entity name *</Label>
              <Input id="entity_name" name="entity_name" required />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="requested_amount">Requested amount *</Label>
            <Input id="requested_amount" name="requested_amount" type="number" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input id="purpose" name="purpose" />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create profile & loan application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
