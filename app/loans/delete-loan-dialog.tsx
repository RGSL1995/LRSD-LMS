"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLoanApplication } from "@/app/loans/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteLoanDialogProps {
  loanId: string;
  applicationCode: string;
  borrowerName?: string;
  triggerVariant?: "destructive" | "outline" | "ghost" | "default";
  triggerSize?: "xs" | "sm" | "default" | "icon" | "icon-sm" | "icon-xs";
  showText?: boolean;
  buttonText?: string;
  redirectOnSuccess?: boolean;
  className?: string;
}

export function DeleteLoanDialog({
  loanId,
  applicationCode,
  borrowerName,
  triggerVariant = "ghost",
  triggerSize = "xs",
  showText = false,
  buttonText = "Delete",
  redirectOnSuccess = false,
  className,
}: DeleteLoanDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const sqlFix = `create policy "Authenticated users can delete loan applications" on public.loan_applications for delete to authenticated using (true);
create policy "Authenticated users can delete approval history" on public.approval_history for delete to authenticated using (true);`;

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteLoanApplication(loanId);
      if (!res.success) {
        setError(res.error ?? "Failed to delete loan application.");
        return;
      }

      setOpen(false);
      if (redirectOnSuccess) {
        router.push("/loans");
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) setError(null);
    }}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={cn(
              "text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors gap-1.5",
              className,
            )}
            title={`Delete application ${applicationCode}`}
          />
        }
      >
        <Trash2 className="size-3.5" />
        {showText && <span>{buttonText}</span>}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Delete Loan Application?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Application <span className="font-mono font-semibold text-foreground">{applicationCode}</span>
                {borrowerName ? ` · ${borrowerName}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            Are you sure you want to delete this loan application? This action will permanently remove:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[11px] font-medium text-foreground/80">
            <li>Loan facility appraisal terms and parameters</li>
            <li>Co-borrower and guarantor obligor linkages</li>
            <li>Pledged collateral and security schedules</li>
            <li>Internal credit appraisal history</li>
          </ul>
          <p className="text-[11px] bg-muted/40 p-2.5 rounded-lg border border-border/70 text-muted-foreground">
            <strong>Note:</strong> Borrower entity and contact profiles will remain safely stored in the LMS borrower directory.
          </p>
        </div>

        {error && (
          <div className="space-y-2.5">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium leading-relaxed">
              {error}
            </div>
            {(error.includes("migration 0012") || error.includes("DELETE policy") || error.includes("0 rows deleted")) && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2 text-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[11px] text-amber-800 dark:text-amber-300">
                    Supabase SQL Fix (Run once in SQL Editor):
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      navigator.clipboard.writeText(sqlFix);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    className="h-6 text-[10px] gap-1 px-2 border-amber-500/40 hover:bg-amber-500/20 shrink-0"
                  >
                    {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    {copied ? "Copied!" : "Copy SQL"}
                  </Button>
                </div>
                <pre className="text-[10px] font-mono bg-background/80 p-2 rounded border border-border/80 overflow-x-auto whitespace-pre-wrap select-all">
                  {sqlFix}
                </pre>
                <p className="text-[10px] text-muted-foreground">
                  Paste this into your <strong>Supabase Dashboard &rarr; SQL Editor</strong> and click <strong>Run</strong>, then click <strong>Delete Application</strong> below.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                Delete Application
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
