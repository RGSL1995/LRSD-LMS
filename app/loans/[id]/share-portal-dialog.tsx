"use client";

import { useState, useTransition } from "react";
import { getOrGeneratePortalLink } from "@/app/portal/portal-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface SharePortalDialogProps {
  applicationId: string;
  applicationCode: string;
  borrowerName?: string;
  portalStatus?: string;
  triggerVariant?: "outline" | "default" | "secondary";
  triggerSize?: "sm" | "default" | "xs";
  className?: string;
}

export function SharePortalDialog({
  applicationId,
  applicationCode,
  borrowerName = "Borrower",
  portalStatus = "pending",
  triggerVariant = "outline",
  triggerSize = "sm",
  className,
}: SharePortalDialogProps) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !link) {
      startTransition(async () => {
        const res = await getOrGeneratePortalLink(applicationId);
        if (res.success && res.token) {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          setLink(`${origin}/portal/review/${res.token}`);
        } else {
          setError(res.error || "Failed to generate shareable link.");
        }
      });
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const shareText = `Dear ${borrowerName},\n\nPlease review your Wholesale Loan Facility Application (${applicationCode}) and upload required supporting KYC & financial documents via this secure link:\n${link}\n\nThank you,\nLending Operations Desk`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`Wholesale Facility Review - Application ${applicationCode}`)}&body=${encodeURIComponent(shareText)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={className || "h-8 px-3 text-xs gap-1.5 font-medium shadow-xs"}
          >
            <Share2 className="size-3.5 text-primary" />
            <span>Share with Borrower</span>
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Share2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Share Review Portal with Borrower
              </DialogTitle>
              <DialogDescription className="text-xs">
                Send a secure, tamper-proof review link to {borrowerName} for facility cross-check and document collection.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status badge */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Portal Status:</span>
              {portalStatus === "confirmed" ? (
                <Badge className="bg-emerald-600 text-white border-0 text-[11px] gap-1">
                  <CheckCircle2 className="size-3" />
                  Borrower Review Confirmed
                </Badge>
              ) : portalStatus === "documents_uploaded" ? (
                <Badge className="bg-blue-600 text-white border-0 text-[11px]">
                  Documents Uploaded
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[11px]">
                  Pending Borrower Action
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <Lock className="size-3 text-emerald-600" />
              HMAC-SHA256 Encrypted
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span>Generating tamper-proof review link...</span>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Copyable Link Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Public Review &amp; Document Upload Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={link}
                    className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs font-mono text-foreground focus:outline-hidden"
                  />
                  <Button
                    type="button"
                    onClick={handleCopy}
                    size="sm"
                    className="h-9 px-3 gap-1.5 text-xs shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The borrower can access this link directly without an employee login.
                </p>
              </div>

              {/* Instant Share Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-colors"
                >
                  <MessageSquare className="size-3.5" />
                  WhatsApp
                </a>

                <a
                  href={emailUrl}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold transition-colors"
                >
                  <Mail className="size-3.5" />
                  Email
                </a>

                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg border bg-card hover:bg-muted/40 text-foreground text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Open Preview
                </a>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
