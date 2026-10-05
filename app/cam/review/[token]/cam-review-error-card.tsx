import Link from "next/link";
import { AlertCircle, ShieldAlert, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function CamReviewErrorCard({ error }: { error?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/30 shadow-lg">
        <CardHeader className="text-center pb-3">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2">
            <ShieldAlert className="size-6" />
          </div>
          <CardTitle className="text-lg font-bold text-foreground">
            Credit Review Access Expired or Invalid
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            This secure Credit Committee link could not be verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 text-center">
          <div className="p-3.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive flex items-start gap-2 text-left">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              {error || "The link may have expired or was already replaced by a newer decision session."}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            If you are a member of the Credit Committee, please request the relationship manager or credit underwriting team to resend the approval invitation.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full text-xs gap-1.5" })}
            >
              <ArrowLeft className="size-3.5" /> Return to Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
