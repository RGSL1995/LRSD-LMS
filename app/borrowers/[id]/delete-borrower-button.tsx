"use client";

import { useActionState } from "react";
import { deleteBorrower, type BorrowerFormState } from "@/app/borrowers/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState: BorrowerFormState = { error: null };

export function DeleteBorrowerButton({
  borrowerId,
  variant = "destructive",
  size = "sm",
}: {
  borrowerId: string;
  variant?: "destructive" | "outline" | "ghost";
  size?: "sm" | "icon" | "default";
}) {
  const [state, formAction, pending] = useActionState(deleteBorrower, initialState);

  return (
    <Dialog>
      <DialogTrigger render={<Button variant={variant} size={size} />}>Delete</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete borrower?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the borrower profile, contacts, documents, and any associates. This
          cannot be undone. If this borrower has loan applications or loans, deletion will be blocked.
        </p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="borrower_id" value={borrowerId} />
          {state.error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium">
              {state.error}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Delete borrower"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
