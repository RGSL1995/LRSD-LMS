"use client";

import { useState, useTransition } from "react";
import { eraseCorporateProfileData } from "./corporate-ingest-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";

interface EraseProfileButtonProps {
  borrowerId?: string;
  onClearLocalForm?: () => void;
  variant?: "outline" | "destructive" | "ghost" | "default";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function EraseProfileButton({
  borrowerId,
  onClearLocalForm,
  variant = "outline",
  size = "sm",
  className = "",
}: EraseProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const [eraseLinked, setEraseLinked] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleErase() {
    if (!borrowerId) {
      if (onClearLocalForm) {
        onClearLocalForm();
      }
      setFeedback("Form fields cleared.");
      setTimeout(() => {
        setOpen(false);
        setFeedback(null);
      }, 1000);
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await eraseCorporateProfileData(borrowerId, eraseLinked);
      if (res.success) {
        if (onClearLocalForm) onClearLocalForm();
        setFeedback("Profile data cleared successfully.");
        setTimeout(() => {
          setOpen(false);
          setFeedback(null);
        }, 1200);
      } else {
        setError(res.error || "Failed to erase profile data.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button
          type="button"
          variant={variant}
          size={size}
          className={`gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 ${className}`}
        />
      }>
        <RotateCcw className="size-3.5" /> Erase Profile Data
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <AlertTriangle className="size-5" />
            <DialogTitle>Erase Borrower Profile Data</DialogTitle>
          </div>
          <DialogDescription className="text-xs pt-2 leading-relaxed">
            This will wipe the company master information (CIN, PAN, GSTIN, dates, addresses, and contacts) back to an empty state so you can re-import or re-enter data cleanly.
          </DialogDescription>
        </DialogHeader>

        {borrowerId && (
          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer font-medium text-foreground">
              <input
                type="checkbox"
                checked={eraseLinked}
                onChange={(e) => setEraseLinked(e.target.checked)}
                className="size-4 mt-0.5 rounded border-gray-300 text-destructive focus:ring-destructive"
              />
              <div>
                <span>Also wipe linked extracted data</span>
                <p className="text-[11px] text-muted-foreground font-normal mt-0.5">
                  Removes associated financial statements, directors, subsidiaries, and GST records for this company.
                </p>
              </div>
            </label>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {feedback && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="size-4" /> {feedback}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-3">
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
            onClick={handleErase}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              "Erasing Data..."
            ) : (
              <>
                <RotateCcw className="size-3.5" /> Confirm Erase
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
