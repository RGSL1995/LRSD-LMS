"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  findBorrowerByPan,
  createBorrowerInline,
  type BorrowerLookup,
  type InlineBorrowerData,
} from "@/app/loans/actions";
import { ExpandableProfileCard } from "@/components/borrowers/expandable-profile-card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  AlertCircle,
  Plus,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface InlineBorrowerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  role?: "primary_borrower" | "co_borrower" | "guarantor" | "security_provider";
  defaultPan?: string;
  onSelected: (
    borrower: BorrowerLookup,
    guaranteeType?: "personal" | "corporate",
    options?: { isGuarantor?: boolean; isSecurityProvider?: boolean }
  ) => void;
}

export function InlineBorrowerDialog({
  open,
  onOpenChange,
  title,
  description,
  role = "co_borrower",
  defaultPan = "",
  onSelected,
}: InlineBorrowerDialogProps) {
  const [pan, setPan] = useState(defaultPan);
  const [mode, setMode] = useState<"lookup" | "create">("lookup");
  const [isSearching, startSearching] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundBorrower, setFoundBorrower] = useState<BorrowerLookup | null>(null);
  const [notFoundPan, setNotFoundPan] = useState<string | null>(null);

  // Role capability toggles for Guarantor / Security Provider
  const [isGuarantor, setIsGuarantor] = useState(role === "guarantor");
  const [isSecurityProvider, setIsSecurityProvider] = useState(role === "security_provider");

  // Guarantee Type (for guarantors)
  const [guaranteeType, setGuaranteeType] = useState<"personal" | "corporate">("personal");

  useEffect(() => {
    if (open) {
      setIsGuarantor(role === "guarantor");
      setIsSecurityProvider(role === "security_provider");
    }
  }, [open, role]);

  // Create mode form state
  const [entityType, setEntityType] = useState<"individual" | "corporate">("individual");
  const [fullName, setFullName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessType, setBusinessType] = useState("llp");
  const [cin, setCin] = useState("");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [occupation, setOccupation] = useState("Business");
  const [createError, setCreateError] = useState<string | null>(null);

  function resetAll() {
    setPan(defaultPan);
    setMode("lookup");
    setSearchError(null);
    setFoundBorrower(null);
    setNotFoundPan(null);
    setCreateError(null);
    setIsGuarantor(role === "guarantor");
    setIsSecurityProvider(role === "security_provider");
    setFullName("");
    setLegalName("");
    setCin("");
    setDob("");
    setMobile("");
    setEmail("");
    setAddress("");
    setCity("");
    setState("");
    setPincode("");
  }

  function handleSearch() {
    const cleanPan = pan.trim().toUpperCase();
    setSearchError(null);
    setFoundBorrower(null);
    setNotFoundPan(null);

    if (!cleanPan) {
      setSearchError("Please enter a valid PAN.");
      return;
    }

    startSearching(async () => {
      const res = await findBorrowerByPan(cleanPan);
      if (res) {
        setFoundBorrower(res);
      } else {
        setNotFoundPan(cleanPan);
        // Auto infer type from PAN 4th letter (P = Individual, C/L/F/A = Corporate/LLP)
        const fourthChar = cleanPan.charAt(3);
        if (fourthChar === "P") {
          setEntityType("individual");
          setGuaranteeType("personal");
        } else {
          setEntityType("corporate");
          setGuaranteeType("corporate");
        }
      }
    });
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if ((role === "guarantor" || role === "security_provider") && !isGuarantor && !isSecurityProvider) {
      setCreateError("Please select at least one role: Financial Guarantor and/or Security Provider.");
      return;
    }

    const activePan = (notFoundPan || pan).trim().toUpperCase();
    if (!activePan) {
      setCreateError("PAN is required.");
      return;
    }

    if (entityType === "individual" && !fullName.trim()) {
      setCreateError("Full Name is required.");
      return;
    }
    if (entityType === "corporate" && !legalName.trim()) {
      setCreateError("Company / Legal Name is required.");
      return;
    }

    startSaving(async () => {
      const fullAddr = [address, city, state, pincode].filter(Boolean).join(", ");
      const data: InlineBorrowerData = {
        borrower_type: entityType,
        pan: activePan,
        full_name: fullName.trim(),
        legal_name: legalName.trim(),
        business_type: businessType,
        cin: cin.trim(),
        date_of_birth: dob || undefined,
        incorporation_date: dob || undefined,
        phone: mobile.trim(),
        email: email.trim(),
        address: fullAddr || undefined,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        occupation: occupation.trim(),
      };

      const result = await createBorrowerInline(data);
      if (result.success && result.borrower) {
        onSelected(
          result.borrower,
          isGuarantor ? guaranteeType : undefined,
          { isGuarantor, isSecurityProvider }
        );
        resetAll();
        onOpenChange(false);
      } else {
        setCreateError(result.error || "Failed to create borrower profile.");
      }
    });
  }

  function handleAttachFound() {
    if (foundBorrower) {
      if ((role === "guarantor" || role === "security_provider") && !isGuarantor && !isSecurityProvider) {
        setSearchError("Please select at least one role: Financial Guarantor and/or Security Provider.");
        return;
      }
      const derivedGuarantee: "personal" | "corporate" =
        guaranteeType || (foundBorrower.borrower_type === "individual" ? "personal" : "corporate");
      onSelected(
        foundBorrower,
        isGuarantor ? derivedGuarantee : undefined,
        { isGuarantor, isSecurityProvider }
      );
      resetAll();
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSearching && !isSaving) {
          onOpenChange(next);
          if (!next) resetAll();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-y-auto w-full">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <DialogTitle className="text-lg">{title}</DialogTitle>
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Lookup View */}
        {mode === "lookup" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="pan_search_input" className="text-sm font-medium">
                Enter PAN (Permanent Account Number) *
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="pan_search_input"
                    value={pan}
                    onChange={(e) => {
                      setPan(e.target.value.toUpperCase());
                      setFoundBorrower(null);
                      setNotFoundPan(null);
                      setSearchError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="e.g. ACDFA1362N"
                    className="font-mono uppercase tracking-wider text-base h-11"
                    maxLength={10}
                    autoFocus
                  />
                  {isSearching && (
                    <span className="absolute right-3 top-3 text-muted-foreground animate-spin">
                      <Loader2 className="size-5" />
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching || !pan.trim()}
                  className="h-11 px-5"
                >
                  <Search className="size-4 mr-1.5" />
                  Search PAN
                </Button>
              </div>
              {searchError && <p className="text-xs text-destructive font-medium">{searchError}</p>}
            </div>

            {/* If Found in LMS */}
            {foundBorrower && (
              <div className="space-y-3 animate-in fade-in-50">
                {(role === "guarantor" || role === "security_provider") && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-primary" />
                        Obligations & Role on this Facility
                      </span>
                      <span className="text-[11px] text-muted-foreground">Select all that apply</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isGuarantor
                            ? "border-primary bg-card shadow-2xs"
                            : "border-border/60 bg-muted/20 opacity-70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isGuarantor}
                          onChange={(e) => setIsGuarantor(e.target.checked)}
                          className="mt-0.5 rounded border-primary text-primary size-4"
                        />
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-foreground block">
                            🛡️ Financial Guarantor
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            Provides Personal or Corporate Guarantee for facility repayment.
                          </span>
                          {isGuarantor && (
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setGuaranteeType("personal");
                                }}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                                  guaranteeType === "personal"
                                    ? "bg-primary text-primary-foreground font-bold border-primary"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                Personal Guarantee
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setGuaranteeType("corporate");
                                }}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                                  guaranteeType === "corporate"
                                    ? "bg-primary text-primary-foreground font-bold border-primary"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                Corporate Guarantee
                              </button>
                            </div>
                          )}
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isSecurityProvider
                            ? "border-primary bg-card shadow-2xs"
                            : "border-border/60 bg-muted/20 opacity-70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSecurityProvider}
                          onChange={(e) => setIsSecurityProvider(e.target.checked)}
                          className="mt-0.5 rounded border-primary text-primary size-4"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-foreground block">
                            🏦 Security Provider (Pledgor)
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            Pledges equity shares or collateral assets in the security schedule.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                <ExpandableProfileCard
                  borrower={foundBorrower}
                  role={
                    role === "co_borrower"
                      ? "Co-Borrower"
                      : isGuarantor && isSecurityProvider
                        ? "Guarantor & Security Provider"
                        : isSecurityProvider
                          ? "Security Provider"
                          : role === "guarantor"
                            ? "Guarantor"
                            : "Primary Borrower"
                  }
                  defaultExpanded={true}
                  extraAction={
                    <Button type="button" onClick={handleAttachFound} size="sm" className="h-8 gap-1.5 font-semibold">
                      <Plus className="size-3.5" />
                      Attach Profile
                    </Button>
                  }
                />
              </div>
            )}

            {/* If Not Found in LMS */}
            {notFoundPan && !foundBorrower && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 animate-in fade-in-50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      No Existing Profile for PAN <span className="font-mono">{notFoundPan}</span>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      This applicant is not yet registered in your LMS. You can create their profile right now; it will
                      be saved to your system and linked directly to this loan.
                    </p>
                  </div>
                </div>

                <div className="pt-1 flex justify-end gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setMode("create");
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="size-4" />
                    Create Profile Now
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Mode Form */}
        {mode === "create" && (
          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                New {entityType === "individual" ? "Individual" : "Corporate"} Registration
              </span>
              <Badge variant="outline" className="font-mono uppercase text-xs">
                PAN: {notFoundPan || pan}
              </Badge>
            </div>

            {entityType === "individual" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ind_name" className="text-xs font-medium">
                      Full Name *
                    </Label>
                    <Input
                      id="ind_name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Karan Chauhan"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ind_dob" className="text-xs font-medium">
                      Date of Birth
                    </Label>
                    <Input
                      id="ind_dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ind_mobile" className="text-xs font-medium">
                      Mobile Number
                    </Label>
                    <Input
                      id="ind_mobile"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9999916610"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ind_email" className="text-xs font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="ind_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. karan.chauhan@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ind_address" className="text-xs font-medium">
                    Residential Address
                  </Label>
                  <Input
                    id="ind_address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House / Flat No, Street, Landmark"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ind_city" className="text-xs">City</Label>
                    <Input
                      id="ind_city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Noida"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ind_state" className="text-xs">State</Label>
                    <Input
                      id="ind_state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Uttar Pradesh"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ind_pin" className="text-xs">PIN Code</Label>
                    <Input
                      id="ind_pin"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="201301"
                      maxLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ind_occ" className="text-xs font-medium">
                    Occupation
                  </Label>
                  <Input
                    id="ind_occ"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Business / Director / Salaried"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="corp_name" className="text-xs font-medium">
                    Legal / Company Name *
                  </Label>
                  <Input
                    id="corp_name"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Black Opal Ventures LLP"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="corp_type" className="text-xs font-medium">
                      Company / Business Type
                    </Label>
                    <select
                      id="corp_type"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="llp">LLP (Limited Liability Partnership)</option>
                      <option value="private_limited">Private Limited Company</option>
                      <option value="public">Public Limited Company</option>
                      <option value="partnership">Partnership Firm</option>
                      <option value="other">Other Entity</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="corp_cin" className="text-xs font-medium">
                      CIN / LLPIN / Reg No.
                    </Label>
                    <Input
                      id="corp_cin"
                      value={cin}
                      onChange={(e) => setCin(e.target.value)}
                      placeholder="e.g. ACC-7967 or U..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="corp_inc" className="text-xs font-medium">
                      Date of Incorporation
                    </Label>
                    <Input
                      id="corp_inc"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="corp_mobile" className="text-xs font-medium">
                      Contact Phone
                    </Label>
                    <Input
                      id="corp_mobile"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="e.g. 9999916610"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="corp_addr" className="text-xs font-medium">
                    Registered Office Address
                  </Label>
                  <Input
                    id="corp_addr"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Unit / Floor, Building, Sector, Area"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="corp_city" className="text-xs">City</Label>
                    <Input
                      id="corp_city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Noida"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="corp_state" className="text-xs">State</Label>
                    <Input
                      id="corp_state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Uttar Pradesh"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="corp_pin" className="text-xs">PIN Code</Label>
                    <Input
                      id="corp_pin"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="201304"
                      maxLength={6}
                    />
                  </div>
                </div>
              </div>
            )}

            {(role === "guarantor" || role === "security_provider") && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" />
                    Obligations & Role on this Facility
                  </span>
                  <span className="text-[11px] text-muted-foreground">Select all that apply</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isGuarantor
                        ? "border-primary bg-card shadow-2xs"
                        : "border-border/60 bg-muted/20 opacity-70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isGuarantor}
                      onChange={(e) => setIsGuarantor(e.target.checked)}
                      className="mt-0.5 rounded border-primary text-primary size-4"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-foreground block">
                        🛡️ Financial Guarantor
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Provides Personal or Corporate Guarantee for facility repayment.
                      </span>
                      {isGuarantor && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setGuaranteeType("personal");
                            }}
                            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                              guaranteeType === "personal"
                                ? "bg-primary text-primary-foreground font-bold border-primary"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            Personal Guarantee
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setGuaranteeType("corporate");
                            }}
                            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                              guaranteeType === "corporate"
                                ? "bg-primary text-primary-foreground font-bold border-primary"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            Corporate Guarantee
                          </button>
                        </div>
                      )}
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      isSecurityProvider
                        ? "border-primary bg-card shadow-2xs"
                        : "border-border/60 bg-muted/20 opacity-70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSecurityProvider}
                      onChange={(e) => setIsSecurityProvider(e.target.checked)}
                      className="mt-0.5 rounded border-primary text-primary size-4"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-foreground block">
                        🏦 Security Provider (Pledgor)
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Pledges equity shares or collateral assets in the security schedule.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {createError && <p className="text-xs text-destructive font-medium">{createError}</p>}

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMode("lookup");
                  setCreateError(null);
                }}
                disabled={isSaving}
              >
                Back to Search
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-1.5">
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving to LMS...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Save & Attach Profile
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
