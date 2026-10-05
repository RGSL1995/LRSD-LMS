"use client";

import { useState } from "react";
import Link from "next/link";
import { BorrowerAvatar } from "@/components/ui/borrower-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BorrowerLookup } from "@/app/loans/actions";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  Briefcase,
  FileText,
} from "lucide-react";

export interface ExpandableProfileCardProps {
  borrower: BorrowerLookup;
  role: "Primary Borrower" | "Co-Borrower" | "Guarantor" | string;
  roleIndex?: number;
  guaranteeType?: "personal" | "corporate" | "unconditional" | "limited" | string | null;
  onRemove?: () => void;
  defaultExpanded?: boolean;
  isVerified?: boolean;
  extraAction?: React.ReactNode;
  className?: string;
}

export function ExpandableProfileCard({
  borrower,
  role,
  roleIndex,
  guaranteeType,
  onRemove,
  defaultExpanded = false,
  isVerified = true,
  extraAction,
  className,
}: ExpandableProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  function copyToClipboard(text: string, key: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  }

  const isCorporate = borrower.borrower_type === "corporate";

  const fullAddress =
    borrower.registered_address ||
    borrower.address ||
    [borrower.city, borrower.state, borrower.pincode].filter(Boolean).join(", ") ||
    null;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-200 overflow-hidden shadow-xs",
        isExpanded ? "border-primary/40 ring-1 ring-primary/20 shadow-sm" : "border-border/80 hover:border-border",
        className,
      )}
    >
      {/* Header Summary Row */}
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <BorrowerAvatar
            name={borrower.displayName}
            type={borrower.borrower_type}
            avatarUrl={borrower.avatar_url}
            size="md"
          />

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground truncate max-w-[260px] sm:max-w-xs">
                {borrower.displayName}
              </span>

              {/* Role badge */}
              {role === "Primary Borrower" ? (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-mono tracking-wide">
                  Primary Borrower
                </Badge>
              ) : role === "Co-Borrower" ? (
                <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wide">
                  Co-Borrower {roleIndex ? `#${roleIndex}` : ""}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wide">
                  Guarantor {roleIndex ? `#${roleIndex}` : ""}
                </Badge>
              )}

              {guaranteeType && (
                <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground border-border/80">
                  {guaranteeType} Guarantee
                </Badge>
              )}

              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground hidden sm:inline-flex">
                {borrower.borrower_code}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap font-mono">
              <span className="font-semibold text-foreground">PAN: {borrower.pan}</span>
              <span>•</span>
              <span className="capitalize font-sans">{borrower.borrower_type}</span>
              {borrower.city && (
                <>
                  <span>•</span>
                  <span className="font-sans">📍 {borrower.city}</span>
                </>
              )}
              {borrower.phone && (
                <>
                  <span className="hidden md:inline">•</span>
                  <span className="font-sans hidden md:inline">📞 {borrower.phone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {isVerified && role === "Primary Borrower" && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-emerald-600 font-semibold px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 mr-1">
              <ShieldCheck className="size-3.5" /> Verified
            </div>
          )}

          {/* Expand / Collapse Button */}
          <Button
            type="button"
            variant={isExpanded ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="h-8 text-xs gap-1.5 font-medium cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="size-3.5 text-primary" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5 text-muted-foreground" />
                Expand Details
              </>
            )}
          </Button>

          {/* Optional extra action (e.g. Change Applicant) */}
          {extraAction}

          {/* Remove Button if provided */}
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Remove Profile"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Details Body */}
      {isExpanded && (
        <div className="border-t border-border/80 bg-muted/20 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 text-xs">
            {/* 1. Legal / Entity Details */}
            <div className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                {isCorporate ? <Building2 className="size-3.5 text-primary" /> : <User className="size-3.5 text-primary" />}
                Entity & Identification
              </div>

              <div className="space-y-1.5 pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Legal Name</span>
                  <span className="font-semibold text-foreground block">{borrower.displayName}</span>
                </div>

                {borrower.trade_name && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Trade Name</span>
                    <span className="text-foreground block">{borrower.trade_name}</span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-muted-foreground block">System Code</span>
                  <span className="font-mono text-muted-foreground block">{borrower.borrower_code}</span>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground block">Entity Classification</span>
                  <span className="capitalize text-foreground font-medium block">
                    {borrower.entity_category || borrower.borrower_type}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Statutory & Tax Registration */}
            <div className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                <CreditCard className="size-3.5 text-primary" />
                Tax & Identifiers
              </div>

              <div className="space-y-1.5 pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Permanent Account Number (PAN)</span>
                  <div className="flex items-center justify-between font-mono font-bold text-foreground text-xs">
                    <span>{borrower.pan}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(borrower.pan, "pan")}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy PAN"
                    >
                      {copiedKey === "pan" ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                </div>

                {borrower.gstin && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">GSTIN</span>
                    <div className="flex items-center justify-between font-mono font-semibold text-foreground text-xs">
                      <span className="truncate">{borrower.gstin}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(borrower.gstin!, "gstin")}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy GSTIN"
                      >
                        {copiedKey === "gstin" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {borrower.cin && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">CIN / Registration No</span>
                    <div className="flex items-center justify-between font-mono text-muted-foreground text-xs">
                      <span className="truncate">{borrower.cin}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(borrower.cin!, "cin")}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy CIN"
                      >
                        {copiedKey === "cin" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {borrower.date_of_birth && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Date of Birth</span>
                    <span className="text-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground" />
                      {borrower.date_of_birth}
                    </span>
                  </div>
                )}

                {borrower.incorporation_date && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Incorporation Date</span>
                    <span className="text-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground" />
                      {borrower.incorporation_date}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Business & Contact */}
            <div className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                <Briefcase className="size-3.5 text-primary" />
                Profile & Contact
              </div>

              <div className="space-y-1.5 pt-1">
                {borrower.business_type && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Business / Constitution</span>
                    <span className="capitalize text-foreground font-medium block">{borrower.business_type}</span>
                  </div>
                )}

                {borrower.occupation && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Occupation</span>
                    <span className="capitalize text-foreground font-medium block">{borrower.occupation}</span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] text-muted-foreground block">Email Address</span>
                  {borrower.email ? (
                    <a
                      href={`mailto:${borrower.email}`}
                      className="text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{borrower.email}</span>
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground block">Phone / Mobile</span>
                  {borrower.phone ? (
                    <a
                      href={`tel:${borrower.phone}`}
                      className="text-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Phone className="size-3 shrink-0 text-muted-foreground" />
                      {borrower.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Address Details */}
            <div className="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                <MapPin className="size-3.5 text-primary" />
                Address Details
              </div>

              <div className="space-y-1.5 pt-1">
                <div>
                  <span className="text-[10px] text-muted-foreground block">
                    {isCorporate ? "Registered Office" : "Current Address"}
                  </span>
                  <p className="text-xs text-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {fullAddress || <span className="italic text-muted-foreground">No address recorded</span>}
                  </p>
                </div>

                {(borrower.city || borrower.state || borrower.pincode) && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">City, State & PIN</span>
                    <span className="text-foreground font-medium block">
                      {[borrower.city, borrower.state, borrower.pincode].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}

                {borrower.corporate_address && (
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Corporate Office</span>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{borrower.corporate_address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Bar: Deep link to Borrower Profile */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/60">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" />
              <span>Full documentation, financials & governance available in LMS Borrower Profile.</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/borrowers/${borrower.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline px-3 py-1.5 rounded-md hover:bg-primary/5 transition-colors border border-primary/20"
              >
                Open Full Borrower Profile <ExternalLink className="size-3" />
              </Link>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Collapse
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
