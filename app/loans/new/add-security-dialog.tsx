"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { type LASSecurityItem, type SecurityProviderOption, formatIndianNumber } from "../las-types";
import { fetchLiveStockPrice, lookupSecurityDetails, searchSecuritiesAction } from "../market-actions";
import { type SecurityRecord } from "@/lib/securities-directory";
import { Landmark, TrendingUp, Sparkles, Check, AlertCircle, Zap, Loader2, RefreshCw, Plus, Search } from "lucide-react";

const QUICK_SECURITIES: Array<{ label: string; name: string; isin: string; symbol: string }> = [
  { label: "TCS", name: "Tata Consultancy Services Limited", isin: "INE467B01029", symbol: "TCS" },
  { label: "Reliance", name: "Reliance Industries Limited", isin: "INE002A01018", symbol: "RELIANCE" },
  { label: "HDFC Bank", name: "HDFC Bank Limited", isin: "INE040A01034", symbol: "HDFCBANK" },
  { label: "Infosys", name: "Infosys Limited", isin: "INE009A01021", symbol: "INFY" },
  { label: "ITC", name: "ITC Limited", isin: "INE154A01025", symbol: "ITC" },
  { label: "SBI", name: "State Bank of India", isin: "INE062A01020", symbol: "SBIN" },
];

interface AddSecurityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: LASSecurityItem) => void;
  initialItem?: LASSecurityItem | null;
  providers?: SecurityProviderOption[];
  defaultProviderId?: string;
  onAddNewProvider?: () => void;
  suggestedPledgors?: string[];
  primaryBorrower?: SecurityProviderOption | null;
}

export function AddSecurityDialog({
  open,
  onOpenChange,
  onSave,
  initialItem,
  providers = [],
  defaultProviderId,
  onAddNewProvider,
  suggestedPledgors = [],
  primaryBorrower,
}: AddSecurityDialogProps) {
  const [securityName, setSecurityName] = useState("");
  const [isin, setIsin] = useState("");
  const [quantity, setQuantity] = useState<string>("");
  const [cmp, setCmp] = useState<string>("");
  const [securityCover, setSecurityCover] = useState<string>("2.5");
  const [loanValue, setLoanValue] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [pledgorName, setPledgorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<SecurityRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [priceFetchSuccess, setPriceFetchSuccess] = useState<{
    symbol: string;
    cmp: number;
    prevClose?: number;
    exchange?: string;
    isin?: string;
  } | null>(null);

  useEffect(() => {
    if (initialItem) {
      setSecurityName(initialItem.security_name);
      setIsin(initialItem.isin);
      setQuantity(String(initialItem.quantity));
      setCmp(String(initialItem.cmp));
      setSecurityCover(String(initialItem.security_cover || 2.5));
      setLoanValue(String(initialItem.loan_value || ""));
      setPledgorName(initialItem.pledgor_name);
      if (initialItem.pledgor_borrower_id) {
        setSelectedProviderId(initialItem.pledgor_borrower_id);
      } else {
        const match =
          providers.find(
            (p) => p.name.toLowerCase() === initialItem.pledgor_name.toLowerCase()
          ) ||
          (primaryBorrower &&
          primaryBorrower.name.toLowerCase() === initialItem.pledgor_name.toLowerCase()
            ? primaryBorrower
            : null);
        setSelectedProviderId(
          match ? match.id : (providers.length > 0 || primaryBorrower ? "__custom__" : "")
        );
      }
      setPriceFetchSuccess(null);
    } else {
      resetForm();
    }
  }, [initialItem, open, defaultProviderId, providers.length, primaryBorrower]);

  function resetForm() {
    setSecurityName("");
    setIsin("");
    setQuantity("");
    setCmp("");
    setSecurityCover("2.5");
    setLoanValue("");
    setError(null);
    setIsFetchingPrice(false);
    setIsResolving(false);
    setNameSuggestions([]);
    setShowSuggestions(false);
    setPriceFetchSuccess(null);

    const defaultProv =
      providers.find((p) => p.id === defaultProviderId) ||
      (defaultProviderId ? null : providers[0]);

    if (defaultProv) {
      setSelectedProviderId(defaultProv.id);
      setPledgorName(defaultProv.name);
    } else {
      setSelectedProviderId("");
      setPledgorName("");
    }
  }

  function handleSelectProvider(provId: string) {
    setSelectedProviderId(provId);
    if (provId === "__custom__") {
      setPledgorName("");
    } else if (primaryBorrower && provId === primaryBorrower.id) {
      setPledgorName(primaryBorrower.name);
    } else {
      const p = providers.find((prov) => prov.id === provId);
      if (p) {
        setPledgorName(p.name);
      }
    }
  }

  // Core price fetch helper (reusable by click, ISIN lookup, or autocomplete selection)
  async function fetchPriceForSecurity(nameToFetch: string, isinToFetch: string) {
    const query = isinToFetch.trim() || nameToFetch.trim();
    if (!query) return;

    setError(null);
    setIsFetchingPrice(true);
    setPriceFetchSuccess(null);

    try {
      const res = await fetchLiveStockPrice(query);
      setIsFetchingPrice(false);

      if (res.success && res.cmp) {
        setCmp(String(res.cmp));
        if (res.companyName && (!nameToFetch.trim() || nameToFetch.length < 5)) {
          setSecurityName(res.companyName);
        }
        if (res.isin && !isinToFetch.trim()) {
          setIsin(res.isin);
        }
        setPriceFetchSuccess({
          symbol: res.symbol || query,
          cmp: res.cmp,
          prevClose: res.previousClose,
          exchange: res.exchange || "NSE",
          isin: res.isin || (isinToFetch.startsWith("IN") ? isinToFetch : undefined),
        });

        // Recalculate loan value with new CMP
        const q = Number(quantity) || 0;
        const c = Number(securityCover) || 2.5;
        const mv = Math.round(q * res.cmp);
        if (c > 0 && mv > 0) {
          setLoanValue(String(Math.round(mv / c)));
        }
      } else {
        setError(res.error || "Could not fetch live price. Please enter CMP manually.");
      }
    } catch {
      setIsFetchingPrice(false);
      setError("Network error while fetching market quote.");
    }
  }

  // Auto-fetch real-time market CMP from NSE/BSE
  async function handleFetchLiveCMP() {
    const query = isin.trim() || securityName.trim();
    if (!query) {
      setError("Please enter a Security Name (e.g. TCS, Reliance) or ISIN Code (e.g. INE467B01029) to fetch live market price.");
      return;
    }
    await fetchPriceForSecurity(securityName, isin);
  }

  // User selects an autocomplete suggestion or quick-select chip
  async function handleSelectSecurity(nameVal: string, isinVal: string) {
    setSecurityName(nameVal);
    setIsin(isinVal);
    setNameSuggestions([]);
    setShowSuggestions(false);
    await fetchPriceForSecurity(nameVal, isinVal);
  }

  // Handlers for Company Name input: Autocomplete suggestions + reciprocal ISIN resolution
  function handleNameChange(val: string) {
    setSecurityName(val);
    if (val.trim().length >= 2) {
      searchSecuritiesAction(val.trim()).then((results) => {
        setNameSuggestions(results);
        setShowSuggestions(results.length > 0);
      });
    } else {
      setNameSuggestions([]);
      setShowSuggestions(false);
    }
  }

  async function handleNameBlur() {
    setTimeout(async () => {
      setShowSuggestions(false);
      if (securityName.trim() && !isin.trim()) {
        setIsResolving(true);
        const match = await lookupSecurityDetails(securityName.trim());
        setIsResolving(false);
        if (match.found && match.isin) {
          setIsin(match.isin);
          if (match.companyName) setSecurityName(match.companyName);
          await fetchPriceForSecurity(match.companyName || securityName, match.isin);
        }
      }
    }, 200);
  }

  // Handlers for ISIN Code input: Reciprocal Company Name resolution + live quote fetch
  async function handleIsinChange(val: string) {
    const clean = val.toUpperCase().trim();
    setIsin(clean);

    // If 12-character ISIN is entered/pasted (e.g. INE467B01029)
    if (clean.length === 12) {
      setIsResolving(true);
      const match = await lookupSecurityDetails(clean);
      setIsResolving(false);
      if (match.found && match.companyName) {
        setSecurityName(match.companyName);
        await fetchPriceForSecurity(match.companyName, clean);
      }
    }
  }

  async function handleIsinBlur() {
    if (isin.trim().length >= 10 && (!securityName.trim() || !cmp)) {
      setIsResolving(true);
      const match = await lookupSecurityDetails(isin.trim());
      setIsResolving(false);
      if (match.found && match.companyName) {
        setSecurityName(match.companyName);
        await fetchPriceForSecurity(match.companyName, match.isin || isin.trim());
      }
    }
  }

  // Live Calculations
  const qtyNum = Number(quantity) || 0;
  const cmpNum = Number(cmp) || 0;
  const marketVal = Math.round(qtyNum * cmpNum);
  const coverNum = Number(securityCover) || 2.5;

  // Auto-update loan value when market value or cover changes if not manually overridden
  function handleQuantityChange(val: string) {
    setQuantity(val);
    const q = Number(val) || 0;
    const mv = Math.round(q * cmpNum);
    if (coverNum > 0 && mv > 0) {
      setLoanValue(String(Math.round(mv / coverNum)));
    }
  }

  function handleCmpChange(val: string) {
    setCmp(val);
    const p = Number(val) || 0;
    const mv = Math.round(qtyNum * p);
    if (coverNum > 0 && mv > 0) {
      setLoanValue(String(Math.round(mv / coverNum)));
    }
  }

  function handleCoverChange(val: string) {
    setSecurityCover(val);
    const c = Number(val) || 2.5;
    if (c > 0 && marketVal > 0) {
      setLoanValue(String(Math.round(marketVal / c)));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!securityName.trim()) {
      setError("Please enter the Security / Company Name.");
      return;
    }
    if (!isin.trim()) {
      setError("Please enter the ISIN code (e.g. INE0LLY01014).");
      return;
    }
    if (qtyNum <= 0) {
      setError("Quantity of shares must be greater than zero.");
      return;
    }
    if (cmpNum <= 0) {
      setError("Current Market Price (CMP) must be greater than zero.");
      return;
    }
    const chosenProvider =
      providers.find((p) => p.id === selectedProviderId) ||
      (primaryBorrower && selectedProviderId === primaryBorrower.id ? primaryBorrower : null);
    const finalPledgorName = (chosenProvider ? chosenProvider.name : pledgorName).trim();

    if (!finalPledgorName) {
      setError("Security Provider (Pledgor) is required.");
      return;
    }

    const calculatedLoanValue = Number(loanValue) || (coverNum > 0 ? Math.round(marketVal / coverNum) : 0);

    onSave({
      id: initialItem?.id || `las-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      security_name: securityName.trim(),
      isin: isin.trim().toUpperCase(),
      quantity: qtyNum,
      cmp: cmpNum,
      market_value: marketVal,
      security_cover: coverNum,
      loan_value: calculatedLoanValue,
      pledgor_name: finalPledgorName,
      pledgor_borrower_id: chosenProvider?.id,
      pledgor_pan: chosenProvider?.pan,
      is_guarantor: chosenProvider?.isGuarantor,
      guarantee_type: chosenProvider?.guaranteeType,
    });

    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto w-full">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="size-4" />
            </span>
            <DialogTitle className="text-base sm:text-lg">
              {initialItem ? "Edit Pledged Security" : "Add Pledged Security (LAS)"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs mt-0.5">
            Record pledged equity shares, market valuation, coverage multiplier, and pledgor details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive flex items-center gap-2 font-medium">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Security Name & ISIN (Reciprocal Resolution) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="sec_name" className="text-xs font-semibold flex items-center gap-1.5">
                  Security Name (Company) *
                  {isResolving && <Loader2 className="size-3 animate-spin text-primary" />}
                </Label>
                <div className="flex items-center gap-1 flex-wrap">
                  {QUICK_SECURITIES.map((quick) => (
                    <button
                      key={quick.label}
                      type="button"
                      onClick={() => handleSelectSecurity(quick.name, quick.isin)}
                      className="text-[9px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
                      title={`${quick.name} (${quick.isin})`}
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Input
                  id="sec_name"
                  value={securityName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  onFocus={() => {
                    if (nameSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  autoComplete="off"
                  className="h-9 text-xs"
                  required
                />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground rounded-lg border border-border shadow-lg max-h-56 overflow-y-auto divide-y divide-border/60 animate-in fade-in-50">
                    <div className="p-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/40 uppercase tracking-wider flex items-center justify-between">
                      <span>Matching Companies ({nameSuggestions.length})</span>
                      <span className="text-[9px] font-normal lowercase">Click to select & auto-fill ISIN</span>
                    </div>
                    {nameSuggestions.map((item) => (
                      <button
                        type="button"
                        key={item.isin}
                        onMouseDown={() => handleSelectSecurity(item.companyName, item.isin)}
                        className="w-full text-left p-2 hover:bg-muted flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-foreground truncate">
                            {item.companyName}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Symbol: <span className="font-bold text-primary">{item.symbol}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase shrink-0">
                          {item.isin}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sec_isin" className="text-xs font-semibold">
                  ISIN Code *
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Auto-fills Company Name
                </span>
              </div>
              <Input
                id="sec_isin"
                value={isin}
                onChange={(e) => handleIsinChange(e.target.value)}
                onBlur={handleIsinBlur}
                className="h-9 text-xs font-mono uppercase tracking-wider"
                maxLength={12}
                required
              />
            </div>
          </div>

          {/* Real-time CMP Live Fetch Bar */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                <Zap className="size-3.5 fill-amber-500 text-amber-500" />
              </span>
              <div>
                <span className="font-semibold text-xs text-foreground block">
                  Free Real-Time Exchange Price & ISIN Link
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Reciprocal auto-fetch: Company Name ⇄ ISIN Code + Live Exchange CMP.
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleFetchLiveCMP}
              disabled={isFetchingPrice || (!isin.trim() && !securityName.trim())}
              className="h-7 text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10 self-start sm:self-auto shrink-0 shadow-2xs"
            >
              {isFetchingPrice ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Fetching Live Quote...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3" />
                  ⚡ Fetch Live Quote
                </>
              )}
            </Button>
          </div>

          {priceFetchSuccess && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in-50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                  Live {priceFetchSuccess.exchange}: ₹{priceFetchSuccess.cmp.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">({priceFetchSuccess.symbol})</span>
                {priceFetchSuccess.isin && (
                  <Badge variant="outline" className="text-[10px] font-mono uppercase bg-background/60 text-foreground">
                    ISIN: {priceFetchSuccess.isin}
                  </Badge>
                )}
              </div>
              {priceFetchSuccess.prevClose && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Prev Close: ₹{priceFetchSuccess.prevClose.toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Quantity & CMP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="sec_qty" className="text-xs font-semibold">
                Quantity (Number of Shares) *
              </Label>
              <Input
                id="sec_qty"
                type="number"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
              {qtyNum > 0 && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {formatIndianNumber(qtyNum)} Shares
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec_cmp" className="text-xs font-semibold">
                CMP (Current Market Price in ₹) *
              </Label>
              <div className="relative">
                <Input
                  id="sec_cmp"
                  type="number"
                  step="0.05"
                  value={cmp}
                  onChange={(e) => handleCmpChange(e.target.value)}
                  className="h-9 text-xs font-mono pr-8 font-bold"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                  ₹
                </span>
              </div>
            </div>
          </div>

          {/* Market Value Display Strip */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted-foreground font-medium block">
                Total Market Value (Quantity × CMP)
              </span>
              <span className="font-mono font-bold text-sm text-foreground">
                ₹ {formatIndianNumber(marketVal)}
              </span>
            </div>
            {marketVal >= 10000000 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-[10px]">
                ₹ {(marketVal / 10000000).toFixed(2)} Cr
              </Badge>
            )}
            {marketVal >= 100000 && marketVal < 10000000 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-[10px]">
                ₹ {(marketVal / 100000).toFixed(2)} Lakh
              </Badge>
            )}
          </div>

          {/* Security Cover & Loan Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="sec_cover" className="text-xs font-semibold">
                  Security Cover Multiplier *
                </Label>
                <div className="flex items-center gap-1">
                  {["2.0", "2.5", "3.0", "3.5", "4.0", "5.0"].map((cov) => (
                    <button
                      key={cov}
                      type="button"
                      onClick={() => handleCoverChange(cov)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        securityCover === cov
                          ? "bg-primary text-primary-foreground font-bold border-primary"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {cov}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Input
                  id="sec_cover"
                  type="number"
                  step="0.1"
                  value={securityCover}
                  onChange={(e) => handleCoverChange(e.target.value)}
                  className="h-9 text-xs font-mono pr-8"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">
                  x
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec_loan_val" className="text-xs font-semibold">
                Loan Value (₹ Supported)
              </Label>
              <Input
                id="sec_loan_val"
                type="number"
                value={loanValue}
                onChange={(e) => setLoanValue(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              {Number(loanValue) > 0 && (
                <span className="text-[11px] text-primary font-mono font-medium">
                  ₹ {formatIndianNumber(Number(loanValue))}
                </span>
              )}
            </div>
          </div>

          {/* Security Provider / Pledgor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="sec_pledgor_select" className="text-xs font-semibold">
                Security Provider / Pledgor *
              </Label>
              {onAddNewProvider && (
                <button
                  type="button"
                  onClick={onAddNewProvider}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  Add New Security Provider
                </button>
              )}
            </div>

            {providers.length > 0 || primaryBorrower ? (
              <div className="space-y-2">
                <select
                  id="sec_pledgor_select"
                  value={selectedProviderId}
                  onChange={(e) => handleSelectProvider(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                >
                  <option value="" disabled>-- Select Security Provider / Pledgor --</option>
                  {providers.length > 0 && (
                    <optgroup label="Registered Security Providers">
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.pan ? `(${p.pan})` : ""} {p.isGuarantor && p.isSecurityProvider ? "— 🛡️ Guarantor & 🏦 SP" : p.isGuarantor ? "— 🛡️ Guarantor" : "— 🏦 Security Provider"}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {primaryBorrower && !providers.some((p) => p.id === primaryBorrower.id) && (
                    <optgroup label="Primary Borrower (Manual Option)">
                      <option value={primaryBorrower.id}>
                        {primaryBorrower.name} {primaryBorrower.pan ? `(${primaryBorrower.pan})` : ""} — Primary Borrower
                      </option>
                    </optgroup>
                  )}
                  <optgroup label="Other">
                    <option value="__custom__">+ Other / Custom Pledgor Name</option>
                  </optgroup>
                </select>

                {selectedProviderId === "__custom__" && (
                  <Input
                    id="sec_pledgor_custom"
                    placeholder="Enter full pledgor name"
                    value={pledgorName}
                    onChange={(e) => setPledgorName(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                )}
              </div>
            ) : (
              <div>
                <Input
                  id="sec_pledgor"
                  value={pledgorName}
                  onChange={(e) => setPledgorName(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
                {suggestedPledgors.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-muted-foreground">Quick select:</span>
                    {suggestedPledgors.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPledgorName(p)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-foreground font-medium border transition-colors"
                      >
                        + {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="font-medium gap-1.5">
              <Check className="size-3.5" />
              {initialItem ? "Save Changes" : "Add Pledged Share"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
