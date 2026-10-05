"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Edit,
  ExternalLink,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  refreshLASRiskPrices,
  getManualLASPositions,
  addManualLASPositionAction,
  updateManualLASPositionAction,
  deleteManualLASPositionAction,
  refreshManualLASPricesAction,
  type LASRiskLoan,
  type LASRiskStatus,
  type ManualLASPosition,
  type ManualLASPositionInput,
} from "./actions";
import { fetchLiveStockPrice, lookupSecurityDetails, searchSecuritiesAction } from "@/app/loans/market-actions";
import type { SecurityRecord } from "@/lib/securities-directory";
import { Zap, Info } from "lucide-react";

type Filter = "all" | LASRiskStatus | "shortfall" | "stale";

const STATUS_META: Record<LASRiskStatus, { label: string; className: string; rank: number }> = {
  critical: { label: "Critical · Liquidation trigger", className: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300", rank: 0 },
  margin_call: { label: "Margin call · Top-up required", className: "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300", rank: 1 },
  watch: { label: "Watch · Cover warning", className: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300", rank: 2 },
  healthy: { label: "Healthy · Fully covered", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", rank: 3 },
  no_exposure: { label: "No drawn exposure", className: "border-border bg-muted text-muted-foreground", rank: 4 },
};

function formatINR(amount: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount || 0);
}

function formatDateDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const cleanStr = String(dateStr).split("T")[0].trim();
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function RiskBadge({ status }: { status: LASRiskStatus }) {
  const meta = STATUS_META[status] || STATUS_META.healthy;
  return <Badge variant="outline" className={`whitespace-nowrap font-semibold text-[11px] ${meta.className}`}>{meta.label}</Badge>;
}

export function RiskMonitorClient({
  loans = [],
  initialManualPositions = [],
  error,
}: {
  loans: LASRiskLoan[];
  initialManualPositions: ManualLASPosition[];
  error?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"manual" | "portfolio">("manual");
  const [manualPositions, setManualPositions] = useState<ManualLASPosition[]>(initialManualPositions);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ManualLASPosition | null>(null);
  const [quickPricePosition, setQuickPricePosition] = useState<ManualLASPosition | null>(null);
  const [quickPriceInput, setQuickPriceInput] = useState<number>(0);

  // New Position Draft State
  const [draft, setDraft] = useState<ManualLASPositionInput>({
    borrowerName: "",
    loanCode: "",
    securityName: "",
    isin: "",
    symbol: "",
    sharesPledged: 0,
    priceAtDisbursement: 0,
    currentPrice: 0,
    disbursementDate: new Date().toISOString().split("T")[0],
    disbursedAmount: 0,
    requiredCover: 3.5,
    pledgorName: "",
    remarks: "",
  });

  // Stock Search / Live Quote Resolution State for Add Modal
  const [stockSuggestions, setStockSuggestions] = useState<SecurityRecord[]>([]);
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [liveQuoteResult, setLiveQuoteResult] = useState<{
    symbol: string;
    cmp: number;
    prevClose?: number;
    isin?: string;
    companyName?: string;
    exchange?: string;
  } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Stock Search / Live Quote Resolution State for Edit Modal
  const [editIsFetchingQuote, setEditIsFetchingQuote] = useState(false);
  const [editQuoteResult, setEditQuoteResult] = useState<{
    symbol: string;
    cmp: number;
    prevClose?: number;
    isin?: string;
    companyName?: string;
    exchange?: string;
  } | null>(null);
  const [editQuoteError, setEditQuoteError] = useState<string | null>(null);

  // Autocomplete change handler for Add Modal
  const handleStockNameChange = (val: string) => {
    setDraft((prev) => ({ ...prev, securityName: val }));
    setQuoteError(null);
    if (val.trim().length >= 2) {
      searchSecuritiesAction(val.trim()).then((results) => {
        setStockSuggestions(results);
        setShowStockDropdown(results.length > 0);
      });
    } else {
      setStockSuggestions([]);
      setShowStockDropdown(false);
    }
  };

  const handleSelectSuggestion = async (item: SecurityRecord) => {
    setShowStockDropdown(false);
    setStockSuggestions([]);
    setIsFetchingQuote(true);
    setQuoteError(null);
    setLiveQuoteResult(null);

    setDraft((prev) => ({
      ...prev,
      securityName: item.companyName,
      symbol: item.symbol,
      isin: item.isin || prev.isin,
    }));

    try {
      const quote = await fetchLiveStockPrice(item.symbol || item.companyName);
      setIsFetchingQuote(false);
      if (quote.success && quote.cmp) {
        setLiveQuoteResult({
          symbol: quote.symbol || item.symbol,
          cmp: quote.cmp,
          prevClose: quote.previousClose,
          isin: quote.isin || item.isin,
          companyName: quote.companyName || item.companyName,
          exchange: quote.exchange || "NSE",
        });
        setDraft((prev) => ({
          ...prev,
          securityName: quote.companyName || item.companyName,
          symbol: quote.symbol || item.symbol,
          isin: quote.isin || item.isin || prev.isin,
          currentPrice: quote.cmp!,
          priceAtDisbursement: prev.priceAtDisbursement === 0 ? quote.cmp! : prev.priceAtDisbursement,
        }));
      } else {
        setQuoteError(quote.error || "No live tick feed found. You can enter CMP manually.");
      }
    } catch {
      setIsFetchingQuote(false);
      setQuoteError("Unable to fetch market price. Enter CMP manually.");
    }
  };

  const handleFetchDraftQuote = async () => {
    const query = (draft.symbol || "").trim() || (draft.securityName || "").trim() || (draft.isin || "").trim();
    if (!query) {
      alert("Please enter a Stock Name, Symbol (e.g. ORIANA, GPECO, MYMUDRA) or ISIN Code.");
      return;
    }
    setIsFetchingQuote(true);
    setQuoteError(null);
    setLiveQuoteResult(null);

    try {
      const quote = await fetchLiveStockPrice(query);
      setIsFetchingQuote(false);
      if (quote.success && quote.cmp) {
        setLiveQuoteResult({
          symbol: quote.symbol || draft.symbol || query,
          cmp: quote.cmp,
          prevClose: quote.previousClose,
          isin: quote.isin || draft.isin,
          companyName: quote.companyName || draft.securityName,
          exchange: quote.exchange || "NSE",
        });
        setDraft((prev) => ({
          ...prev,
          securityName: quote.companyName || prev.securityName || query,
          symbol: quote.symbol || prev.symbol,
          isin: quote.isin || prev.isin,
          currentPrice: quote.cmp!,
          priceAtDisbursement: prev.priceAtDisbursement === 0 ? quote.cmp! : prev.priceAtDisbursement,
        }));
      } else {
        setQuoteError(quote.error || "No live exchange quote found. Please enter CMP manually.");
      }
    } catch {
      setIsFetchingQuote(false);
      setQuoteError("Service unavailable. Enter CMP manually.");
    }
  };

  const handleFetchEditQuote = async () => {
    if (!editingPosition) return;
    const query = (editingPosition.symbol || "").trim() || (editingPosition.securityName || "").trim() || (editingPosition.isin || "").trim();
    if (!query) {
      alert("Please enter a Stock Name, Symbol or ISIN Code to fetch price.");
      return;
    }
    setEditIsFetchingQuote(true);
    setEditQuoteError(null);
    setEditQuoteResult(null);

    try {
      const quote = await fetchLiveStockPrice(query);
      setEditIsFetchingQuote(false);
      if (quote.success && quote.cmp) {
        setEditQuoteResult({
          symbol: quote.symbol || editingPosition.symbol || query,
          cmp: quote.cmp,
          prevClose: quote.previousClose,
          isin: quote.isin || editingPosition.isin,
          companyName: quote.companyName || editingPosition.securityName,
          exchange: quote.exchange || "NSE",
        });
        setEditingPosition((prev) => prev ? ({
          ...prev,
          securityName: quote.companyName || prev.securityName,
          symbol: quote.symbol || prev.symbol,
          isin: quote.isin || prev.isin,
          currentPrice: quote.cmp!,
        }) : null);
      } else {
        setEditQuoteError(quote.error || "No live exchange quote found. Enter CMP manually.");
      }
    } catch {
      setEditIsFetchingQuote(false);
      setEditQuoteError("Service unavailable. Enter CMP manually.");
    }
  };

  // Filtered & Sorted Manual Positions
  const filteredManualPositions = useMemo(() => {
    return manualPositions
      .filter((pos) => {
        if (filter === "critical") return pos.status === "critical";
        if (filter === "margin_call") return pos.status === "margin_call";
        if (filter === "watch") return pos.status === "watch";
        if (filter === "healthy") return pos.status === "healthy";
        if (filter === "shortfall") return pos.shortfallAmount > 0;
        return true;
      })
      .filter((pos) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          pos.borrowerName.toLowerCase().includes(q) ||
          pos.securityName.toLowerCase().includes(q) ||
          pos.isin.toLowerCase().includes(q) ||
          pos.symbol.toLowerCase().includes(q) ||
          pos.loanCode.toLowerCase().includes(q)
        );
      });
  }, [manualPositions, filter, searchQuery]);

  // Aggregates for Manual Positions
  const totalManualDisbursed = manualPositions.reduce((sum, p) => sum + p.disbursedAmount, 0);
  const totalManualMarketValue = manualPositions.reduce((sum, p) => sum + p.currentMarketValue, 0);
  const totalManualShortfall = manualPositions.reduce((sum, p) => sum + p.shortfallAmount, 0);
  const totalManualMarginCalls = manualPositions.filter((p) => p.status === "margin_call" || p.status === "critical").length;
  const overallCover = totalManualDisbursed > 0 ? totalManualMarketValue / totalManualDisbursed : 0;

  // Add Position Form Calculations (Live Draft Preview)
  const draftDisbValue = draft.sharesPledged * draft.priceAtDisbursement;
  const draftCurrentValue = draft.sharesPledged * (draft.currentPrice || draft.priceAtDisbursement);
  const draftPriceFall = draft.priceAtDisbursement > 0
    ? (((draft.currentPrice || draft.priceAtDisbursement) - draft.priceAtDisbursement) / draft.priceAtDisbursement) * 100
    : 0;
  const draftCover = draft.disbursedAmount > 0 ? draftCurrentValue / draft.disbursedAmount : 0;
  const draftSecurityReq = draft.disbursedAmount * draft.requiredCover;
  const draftShortfall = Math.max(0, draftSecurityReq - draftCurrentValue);

  // Handle Add Position
  const handleAddPosition = async () => {
    if (!draft.borrowerName.trim()) {
      alert("Please enter Borrower Name");
      return;
    }
    if (!draft.securityName.trim()) {
      alert("Please enter Security / Stock Name");
      return;
    }
    if (draft.sharesPledged <= 0 || draft.priceAtDisbursement <= 0 || draft.disbursedAmount <= 0) {
      alert("Please enter valid positive values for Shares, Price, and Loan Amount.");
      return;
    }

    startTransition(async () => {
      const res = await addManualLASPositionAction(draft);
      if (res.success && res.position) {
        setManualPositions((prev) => [res.position!, ...prev]);
        setIsAddModalOpen(false);
        setFeedback("New LAS position added and risk metrics calculated successfully.");
        // Reset draft
        setDraft({
          borrowerName: "",
          loanCode: "",
          securityName: "",
          isin: "",
          symbol: "",
          sharesPledged: 0,
          priceAtDisbursement: 0,
          currentPrice: 0,
          disbursementDate: new Date().toISOString().split("T")[0],
          disbursedAmount: 0,
          requiredCover: 3.5,
          pledgorName: "",
          remarks: "",
        });
      } else {
        setFeedback(res.error || "Failed to add position.");
      }
    });
  };

  // Handle Update Position
  const handleUpdatePosition = async () => {
    if (!editingPosition) return;
    startTransition(async () => {
      const res = await updateManualLASPositionAction(editingPosition.id, {
        borrowerName: editingPosition.borrowerName,
        loanCode: editingPosition.loanCode,
        securityName: editingPosition.securityName,
        isin: editingPosition.isin,
        symbol: editingPosition.symbol,
        sharesPledged: editingPosition.sharesPledged,
        priceAtDisbursement: editingPosition.priceAtDisbursement,
        currentPrice: editingPosition.currentPrice,
        disbursementDate: editingPosition.disbursementDate,
        disbursedAmount: editingPosition.disbursedAmount,
        requiredCover: editingPosition.requiredCover,
        pledgorName: editingPosition.pledgorName,
        remarks: editingPosition.remarks,
      });

      if (res.success && res.position) {
        setManualPositions((prev) => prev.map((p) => (p.id === res.position!.id ? res.position! : p)));
        setEditingPosition(null);
        setFeedback("Position updated and risk metrics recalculated.");
      } else {
        setFeedback(res.error || "Failed to update position.");
      }
    });
  };

  // Handle Quick CMP Update
  const handleSaveQuickPrice = async () => {
    if (!quickPricePosition || quickPriceInput <= 0) return;
    startTransition(async () => {
      const res = await updateManualLASPositionAction(quickPricePosition.id, {
        currentPrice: quickPriceInput,
      });
      if (res.success && res.position) {
        setManualPositions((prev) => prev.map((p) => (p.id === res.position!.id ? res.position! : p)));
        setQuickPricePosition(null);
        setFeedback(`Updated market price for ${quickPricePosition.securityName} to ₹${formatINR(quickPriceInput, 2)}.`);
      }
    });
  };

  // Handle Delete Position
  const handleDeletePosition = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the LAS position for "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteManualLASPositionAction(id);
      if (res.success) {
        setManualPositions((prev) => prev.filter((p) => p.id !== id));
        setFeedback("Position deleted successfully.");
      } else {
        setFeedback(res.error || "Failed to delete position.");
      }
    });
  };

  // Live Refresh Market Prices
  const handleLiveRefreshAll = () => {
    setFeedback("");
    startTransition(async () => {
      const res = await refreshManualLASPricesAction();
      if (res.success) {
        const refreshed = await getManualLASPositions();
        setManualPositions(refreshed.positions);
        setFeedback(`Live quotes refreshed: ${res.updatedCount || 0} updated${res.failedCount ? `, ${res.failedCount} manual/fallback` : ""}.`);
      } else {
        setFeedback(res.error || "Market price refresh failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* TOP INSTITUTIONAL HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest bg-white/10 text-slate-200 px-2.5 py-1 rounded-md border border-white/15">
                LAS RISK MONITORING
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Real-Time MTM Feeds
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Loan Against Securities (LAS) Monitor
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Real-time portfolio collateral tracking, live stock valuations (CMP vs Disbursement Price), security cover multiples (**X), and instant margin call shortfall alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 px-4 gap-2 text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="size-4" />
              + Add LAS Position
            </Button>
            <Button
              variant="outline"
              onClick={handleLiveRefreshAll}
              disabled={isPending}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-10 px-3.5 gap-2 text-xs font-semibold backdrop-blur-sm"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin text-indigo-400" : "text-slate-300"}`} />
              {isPending ? "Syncing Market Feeds…" : "Sync Live Quotes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Feedback / Alert Notice */}
      {(error || feedback) && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in ${
            error
              ? "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {error ? <AlertTriangle className="size-4.5 shrink-0" /> : <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" />}
            <span className="font-medium">{error || feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback("")} className="text-xs opacity-70 hover:opacity-100 p-1">✕</button>
        </div>
      )}

      {/* 4 EXECUTIVE KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pledged Market Value */}
        <Card className="shadow-xs border-l-4 border-l-indigo-600 bg-card hover:shadow-md transition-shadow">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Pledged Collateral</span>
            <div className="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Layers className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black font-mono tracking-tight text-foreground">
              ₹{formatINR(totalManualMarketValue, 0)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>Across <strong className="text-foreground">{manualPositions.length}</strong> monitored position(s)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Disbursed Loan Exposure */}
        <Card className="shadow-xs border-l-4 border-l-blue-600 bg-card hover:shadow-md transition-shadow">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Active Loan Exposure</span>
            <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Activity className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-black font-mono tracking-tight text-blue-600 dark:text-blue-400">
              ₹{formatINR(totalManualDisbursed, 0)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Aggregate disbursed principal
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Aggregate Security Cover (**X) */}
        <Card className={`shadow-xs border-l-4 bg-card hover:shadow-md transition-shadow ${overallCover < 1.75 ? "border-l-red-600" : overallCover < 2.5 ? "border-l-amber-500" : "border-l-emerald-600"}`}>
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Portfolio Security Cover</span>
            <div className={`p-1.5 rounded-md ${overallCover < 1.75 ? "bg-red-50 text-red-600 dark:bg-red-950/50" : overallCover < 2.5 ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"}`}>
              <ShieldCheck className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-2xl font-black font-mono tracking-tight ${overallCover < 1.75 ? "text-destructive" : overallCover < 2.5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {overallCover > 0 ? `${overallCover.toFixed(2)}x` : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Total Collateral ÷ Total Exposure
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Margin Shortfall & Action Required */}
        <Card className={`shadow-xs border-l-4 bg-card hover:shadow-md transition-shadow ${totalManualShortfall > 0 ? "border-l-red-600" : "border-l-slate-400"}`}>
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Margin Shortfall</span>
            <div className={`p-1.5 rounded-md ${totalManualShortfall > 0 ? "bg-red-50 text-red-600 dark:bg-red-950/50" : "bg-muted text-muted-foreground"}`}>
              <AlertTriangle className="size-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-2xl font-black font-mono tracking-tight ${totalManualShortfall > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
              {totalManualShortfall > 0 ? `₹${formatINR(totalManualShortfall, 0)}` : "₹0 (Nil)"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {totalManualMarginCalls > 0 ? (
                <span className="text-red-600 dark:text-red-400 font-bold">{totalManualMarginCalls} position(s) require top-up</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">All positions fully covered</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm border rounded-xl overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/20">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <ShieldAlert className="size-4 text-indigo-600 dark:text-indigo-400" />
              Pledged Shares & Real-Time LAS Monitor
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Live tracking of Pledged Shares, Price @ Disbursement, % vs Disb Price, Security Cover (**X), and Security Required.
            </CardDescription>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search borrower, symbol, ISIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Positions ({manualPositions.length})</option>
              <option value="critical">Critical (&le;1.50x / Fall &gt;35%)</option>
              <option value="margin_call">Margin Call (&le;1.75x / Fall &gt;25%)</option>
              <option value="watch">Watch (&lt;Required / Fall &gt;15%)</option>
              <option value="healthy">Healthy (&ge;Required Cover)</option>
              <option value="shortfall">Shortfall Only</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-muted/80 border-b border-border text-[11px] font-bold text-foreground uppercase tracking-wider">
                  <th className="p-3.5 border-r min-w-48 font-bold">Borrower & Loan Facility</th>
                  <th className="p-3.5 border-r min-w-40">Pledged Security</th>
                  <th className="p-3.5 text-right border-r">Shares Pledged</th>
                  <th className="p-3.5 text-right border-r">Price @ Disb</th>
                  <th className="p-3.5 text-right border-r font-bold text-indigo-600 dark:text-indigo-400">Current CMP</th>
                  <th className="p-3.5 text-right border-r font-bold">
                    <div>% vs Disb Price</div>
                    <div className="text-[9px] font-normal text-muted-foreground font-sans lowercase">cmp vs disb</div>
                  </th>
                  <th className="p-3.5 text-center border-r whitespace-nowrap">Disb Date</th>
                  <th className="p-3.5 text-right border-r font-bold">Disb / Loan Amt</th>
                  <th className="p-3.5 text-center border-r font-bold">Security Cover</th>
                  <th className="p-3.5 text-right border-r">Security Req (**X)</th>
                  <th className="p-3.5 text-right border-r font-bold text-destructive">Shortfall</th>
                  <th className="p-3.5 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {filteredManualPositions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-10 text-center text-muted-foreground font-sans text-xs">
                      <ShieldCheck className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                      {manualPositions.length === 0
                        ? 'No manual LAS positions recorded yet. Click "+ Add LAS Position" to enter and monitor your pledged equities.'
                        : "No positions match the current search / filter criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredManualPositions.map((pos) => {
                    const isFalling = pos.priceFallPercent < 0;
                    const isCoverBreached = pos.currentSecurityCover < pos.requiredCover;

                    return (
                      <tr key={pos.id} className="hover:bg-muted/30 transition-colors">
                        {/* 1. Borrower / Loan Code (Highlighted & Highly Visible) */}
                        <td className="p-3 border-r font-sans min-w-48">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <Building2 className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <span className="font-extrabold text-[13px] text-foreground tracking-tight leading-snug">
                              {pos.borrowerName}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                              <Layers className="size-3" />
                              {pos.loanCode || "—"}
                            </span>
                            {pos.pledgorName && pos.pledgorName !== "—" && (
                              <span className="text-[10px] text-muted-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded border">
                                Pledgor: <strong className="text-foreground">{pos.pledgorName}</strong>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Pledged Security */}
                        <td className="p-3 border-r font-sans">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="line-clamp-1">{pos.securityName}</span>
                            {pos.symbol && (
                              <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded shrink-0">
                                {pos.symbol}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {pos.isin || "No ISIN"}
                          </div>
                        </td>

                        {/* 3. Shares Pledged */}
                        <td className="p-3 text-right border-r font-bold text-foreground">
                          {formatINR(pos.sharesPledged)}
                        </td>

                        {/* 4. Price @ Disbursement */}
                        <td className="p-3 text-right border-r text-foreground">
                          ₹{formatINR(pos.priceAtDisbursement, 2)}
                        </td>

                        {/* 5. Current CMP */}
                        <td className="p-3 text-right border-r font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/10">
                          <div className="flex items-center justify-end gap-1.5">
                            <span>₹{formatINR(pos.currentPrice, 2)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickPricePosition(pos);
                                setQuickPriceInput(pos.currentPrice);
                              }}
                              title="Quick Update Price"
                              className="text-muted-foreground hover:text-indigo-600 p-0.5 rounded hover:bg-muted transition-colors"
                            >
                              <Pencil className="size-3" />
                            </button>
                          </div>
                        </td>

                        {/* 6. Percentage vs Disbursement Price (CMP vs Price @ Disb) */}
                        <td className="p-3 text-right border-r font-bold">
                          {pos.priceFallPercent !== 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                                isFalling
                                  ? "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              }`}
                            >
                              {isFalling ? <ArrowDownRight className="size-3 shrink-0" /> : <ArrowUpRight className="size-3 shrink-0" />}
                              {pos.priceFallPercent > 0
                                ? `+${pos.priceFallPercent.toFixed(2)}% Above`
                                : `${Math.abs(pos.priceFallPercent).toFixed(2)}% Below`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">0.00% (At Disb)</span>
                          )}
                        </td>

                        {/* 7. Date of Disbursement */}
                        <td className="p-3 text-center border-r font-mono whitespace-nowrap text-foreground">
                          {formatDateDDMMYYYY(pos.disbursementDate)}
                        </td>

                        {/* 8. Disbursement / Loan Amount */}
                        <td className="p-3 text-right border-r font-bold text-foreground">
                          ₹{formatINR(pos.disbursedAmount, 0)}
                        </td>

                        {/* 9. Security Cover (**X) */}
                        <td className="p-3 text-center border-r font-bold">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                                pos.status === "critical"
                                  ? "bg-red-600 text-white"
                                  : pos.status === "margin_call"
                                  ? "bg-orange-500 text-white"
                                  : pos.status === "watch"
                                  ? "bg-amber-400 text-slate-950"
                                  : "bg-emerald-600 text-white"
                              }`}
                            >
                              {pos.currentSecurityCover.toFixed(2)}x
                            </span>
                            <span className="text-[9px] font-sans text-muted-foreground font-normal">
                              Req: {pos.requiredCover.toFixed(2)}x
                            </span>
                          </div>
                        </td>

                        {/* 10. Security Required */}
                        <td className="p-3 text-right border-r text-muted-foreground">
                          ₹{formatINR(pos.securityRequired, 0)}
                        </td>

                        {/* 11. Shortfall / Margin Call */}
                        <td className="p-3 text-right border-r font-bold">
                          {pos.shortfallAmount > 0 ? (
                            <div className="text-red-600 dark:text-red-400 font-bold">
                              <div>₹{formatINR(pos.shortfallAmount, 0)}</div>
                              <span className="text-[9px] font-sans text-muted-foreground block font-normal">
                                +{formatINR(pos.topUpSharesRequired)} shs
                              </span>
                            </div>
                          ) : (
                            <span className="text-emerald-600 text-[11px] font-semibold">Covered</span>
                          )}
                        </td>

                        {/* 12. Actions */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingPosition(pos)}
                              title="Edit Position"
                              className="text-muted-foreground hover:text-indigo-600 p-1 rounded hover:bg-muted transition-colors"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePosition(pos.id, pos.securityName)}
                              title="Delete Position"
                              className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Totals Footer */}
              {filteredManualPositions.length > 0 && (
                <tfoot className="bg-muted/80 font-mono text-xs border-t-2 border-border font-bold">
                  <tr>
                    <td colSpan={2} className="p-3 border-r font-sans font-bold text-right">
                      Portfolio Totals / Averages:
                    </td>
                    <td className="p-3 text-right border-r text-foreground">
                      {formatINR(filteredManualPositions.reduce((s, p) => s + p.sharesPledged, 0))}
                    </td>
                    <td className="p-3 border-r text-center text-muted-foreground font-sans">-</td>
                    <td className="p-3 text-right border-r text-indigo-600 dark:text-indigo-400">
                      ₹{formatINR(filteredManualPositions.reduce((s, p) => s + p.currentMarketValue, 0), 0)} (MV)
                    </td>
                    <td className="p-3 text-right border-r text-muted-foreground font-sans">-</td>
                    <td className="p-3 border-r text-center text-muted-foreground font-sans">-</td>
                    <td className="p-3 text-right border-r text-foreground">
                      ₹{formatINR(filteredManualPositions.reduce((s, p) => s + p.disbursedAmount, 0), 0)}
                    </td>
                    <td className="p-3 text-center border-r font-bold text-primary">
                      {filteredManualPositions.reduce((s, p) => s + p.disbursedAmount, 0) > 0
                        ? `${(
                            filteredManualPositions.reduce((s, p) => s + p.currentMarketValue, 0) /
                            filteredManualPositions.reduce((s, p) => s + p.disbursedAmount, 0)
                          ).toFixed(2)}x`
                        : "—"}
                    </td>
                    <td className="p-3 text-right border-r text-muted-foreground">
                      ₹{formatINR(filteredManualPositions.reduce((s, p) => s + p.securityRequired, 0), 0)}
                    </td>
                    <td className="p-3 text-right border-r text-destructive font-bold">
                      ₹{formatINR(filteredManualPositions.reduce((s, p) => s + p.shortfallAmount, 0), 0)}
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ADD MANUAL LAS POSITION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 text-foreground animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Plus className="size-4" />
                  Add Manual LAS Risk Position
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter loan disbursement details, pledged shares, disbursement price, and minimum required security cover.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-indigo-950 dark:text-indigo-200">
                <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-indigo-500" /> Live Risk Metrics Preview</span>
                <span className="font-mono">Security Cover: <strong className="text-primary">{draftCover > 0 ? `${draftCover.toFixed(2)}x` : "0.00x"}</strong> (Req: {draft.requiredCover}x)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-card/80 p-1.5 rounded border">
                  <span className="text-muted-foreground block text-[10px] font-sans">Val @ Disb:</span>
                  <strong>₹{formatINR(draftDisbValue, 0)}</strong>
                </div>
                <div className="bg-card/80 p-1.5 rounded border">
                  <span className="text-muted-foreground block text-[10px] font-sans">Current Mkt Val:</span>
                  <strong className="text-indigo-600 dark:text-indigo-400">₹{formatINR(draftCurrentValue, 0)}</strong>
                </div>
                <div className="bg-card/80 p-1.5 rounded border">
                  <span className="text-muted-foreground block text-[10px] font-sans">% vs Disb Price:</span>
                  <strong className={draftPriceFall < 0 ? "text-red-600" : "text-emerald-600"}>
                    {draftPriceFall > 0
                      ? `+${draftPriceFall.toFixed(1)}% Above`
                      : draftPriceFall < 0
                      ? `${Math.abs(draftPriceFall).toFixed(1)}% Below`
                      : "0.0% (At Disb)"}
                  </strong>
                </div>
                <div className="bg-card/80 p-1.5 rounded border">
                  <span className="text-muted-foreground block text-[10px] font-sans">Margin Shortfall:</span>
                  <strong className={draftShortfall > 0 ? "text-red-600" : "text-emerald-600"}>
                    {draftShortfall > 0 ? `₹${formatINR(draftShortfall, 0)}` : "Nil"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Borrower Name */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Borrower / Company Name *</label>
                <Input
                  value={draft.borrowerName}
                  onChange={(e) => setDraft({ ...draft, borrowerName: e.target.value })}
                  placeholder="e.g. Apex Enterprises Pvt Ltd"
                  className="h-8 text-xs"
                />
              </div>

              {/* Loan Code / Facility Code */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Loan / Facility Code</label>
                <Input
                  value={draft.loanCode}
                  onChange={(e) => setDraft({ ...draft, loanCode: e.target.value })}
                  placeholder="e.g. LN-LAS-2026-001"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Security Name with Live Autocomplete & Live Quote Fetcher */}
              <div className="space-y-1 relative sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-muted-foreground flex items-center gap-1.5">
                    Pledged Security / Stock Name *
                    <span className="text-[10px] font-normal text-indigo-500">(Type to search or enter symbol)</span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleFetchDraftQuote}
                    disabled={isFetchingQuote || (!(draft.securityName || "").trim() && !(draft.symbol || "").trim() && !(draft.isin || "").trim())}
                    className="h-6 px-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 gap-1"
                  >
                    {isFetchingQuote ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3 text-amber-500 fill-amber-500" />}
                    ⚡ Fetch Live Quote
                  </Button>
                </div>

                <div className="relative">
                  <Input
                    value={draft.securityName}
                    onChange={(e) => handleStockNameChange(e.target.value)}
                    onFocus={() => {
                      if (stockSuggestions.length > 0) setShowStockDropdown(true);
                    }}
                    placeholder="e.g. Oriana Power, GP Eco Solutions, My Mudra, Reliance, TCS..."
                    className="h-8 text-xs pr-8"
                  />
                  {isFetchingQuote && (
                    <div className="absolute right-2.5 top-2">
                      <Loader2 className="size-4 animate-spin text-indigo-500" />
                    </div>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showStockDropdown && stockSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-border/50 text-xs">
                    <div className="px-3 py-1 bg-muted/60 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Matching Listed Equities & SMEs
                    </div>
                    {stockSuggestions.map((item, idx) => (
                      <button
                        key={`${item.symbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{item.companyName}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Symbol: <span className="text-primary font-bold">{item.symbol}</span> {item.isin ? `· ISIN: ${item.isin}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0 ml-2">
                          Select & Fetch
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {/* Live Quote Result or Info Message */}
                {liveQuoteResult && (
                  <div className="mt-1.5 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live {liveQuoteResult.exchange || "NSE"} Quote:</span>
                      <strong className="font-mono text-sm">₹{formatINR(liveQuoteResult.cmp, 2)}</strong>
                      {liveQuoteResult.prevClose && (
                        <span className="text-muted-foreground text-[10px] font-normal">
                          (Prev Close: ₹{formatINR(liveQuoteResult.prevClose, 2)})
                        </span>
                      )}
                    </div>
                    {liveQuoteResult.isin && (
                      <span className="font-mono text-[10px] bg-background/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        ISIN: {liveQuoteResult.isin}
                      </span>
                    )}
                  </div>
                )}

                {quoteError && (
                  <div className="mt-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Info className="size-3.5 shrink-0 text-amber-500" />
                    <span>{quoteError} (You can enter Price & CMP manually).</span>
                  </div>
                )}
              </div>

              {/* Symbol / ISIN */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">NSE / BSE Symbol</label>
                <Input
                  value={draft.symbol}
                  onChange={(e) => setDraft({ ...draft, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g. ORIANA, GPECO, RELIANCE"
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">ISIN Code</label>
                <Input
                  value={draft.isin}
                  onChange={(e) => setDraft({ ...draft, isin: e.target.value.toUpperCase() })}
                  placeholder="e.g. INE0OUT01027"
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              {/* Shares Pledged */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Shares Pledged (Quantity) *</label>
                <Input
                  type="number"
                  value={draft.sharesPledged || ""}
                  onChange={(e) => setDraft({ ...draft, sharesPledged: Number(e.target.value) || 0 })}
                  placeholder="e.g. 50000"
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              {/* Price @ Disbursement */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Price @ Disbursement (₹) *</label>
                <Input
                  type="number"
                  value={draft.priceAtDisbursement || ""}
                  onChange={(e) => {
                    const p = Number(e.target.value) || 0;
                    setDraft({
                      ...draft,
                      priceAtDisbursement: p,
                      currentPrice: draft.currentPrice === 0 ? p : draft.currentPrice,
                    });
                  }}
                  placeholder="e.g. 2450.00"
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              {/* Current Market Price (CMP) */}
              <div className="space-y-1">
                <label className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                  <span>Current Market Price (CMP ₹)</span>
                  <span className="text-[10px] font-normal text-muted-foreground">(Auto-fetched or manual)</span>
                </label>
                <Input
                  type="number"
                  value={draft.currentPrice || ""}
                  onChange={(e) => setDraft({ ...draft, currentPrice: Number(e.target.value) || 0 })}
                  placeholder="e.g. 2100.00"
                  className="h-8 text-xs font-mono font-bold border-indigo-400/50 bg-indigo-50/20 dark:bg-indigo-950/20"
                />
              </div>

              {/* Disbursement Date */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Date of Disbursement</label>
                <Input
                  type="date"
                  value={draft.disbursementDate}
                  onChange={(e) => setDraft({ ...draft, disbursementDate: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Disbursement / Loan Amount */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Disbursement / Loan Amount (₹) *</label>
                <Input
                  type="number"
                  value={draft.disbursedAmount || ""}
                  onChange={(e) => setDraft({ ...draft, disbursedAmount: Number(e.target.value) || 0 })}
                  placeholder="e.g. 50000000 (5 Cr)"
                  className="h-8 text-xs font-mono font-bold text-indigo-600"
                />
              </div>

              {/* Security Cover Required (**X) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-muted-foreground">Security Cover Required (**X)</label>
                  <div className="flex items-center gap-1">
                    {[2.0, 2.5, 3.0, 3.5, 4.0, 5.0].map((cov) => (
                      <button
                        key={cov}
                        type="button"
                        onClick={() => setDraft({ ...draft, requiredCover: cov })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          draft.requiredCover === cov
                            ? "bg-indigo-600 text-white font-bold border-indigo-600 shadow-xs"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {cov}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={draft.requiredCover}
                    onChange={(e) => setDraft({ ...draft, requiredCover: Number(e.target.value) || 3.5 })}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value={1.5}>1.50x (66.6% LTV)</option>
                    <option value={1.75}>1.75x (57.1% LTV)</option>
                    <option value={2.0}>2.00x (50.0% LTV)</option>
                    <option value={2.25}>2.25x (44.4% LTV)</option>
                    <option value={2.5}>2.50x (40.0% LTV)</option>
                    <option value={3.0}>3.00x (33.3% LTV)</option>
                    <option value={3.5}>3.50x (28.6% LTV)</option>
                    <option value={4.0}>4.00x (25.0% LTV)</option>
                    <option value={4.5}>4.50x (22.2% LTV)</option>
                    <option value={5.0}>5.00x (20.0% LTV)</option>
                  </select>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      value={draft.requiredCover || ""}
                      onChange={(e) => setDraft({ ...draft, requiredCover: Number(e.target.value) || 0 })}
                      placeholder="Custom e.g. 3.5"
                      className="h-8 text-xs font-mono font-bold pr-6"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] font-bold text-muted-foreground">x</span>
                  </div>
                </div>
              </div>

              {/* Pledgor Name */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Pledgor Name / Entity</label>
                <Input
                  value={draft.pledgorName}
                  onChange={(e) => setDraft({ ...draft, pledgorName: e.target.value })}
                  placeholder="e.g. Promoter Holdings Ltd"
                  className="h-8 text-xs"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Remarks / Monitoring Notes</label>
                <Input
                  value={draft.remarks}
                  onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
                  placeholder="e.g. Quarterly review scheduled"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddPosition}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Save & Calculate Risk
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PRICE UPDATE & STRESS SIMULATOR MODAL */}
      {quickPricePosition && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-foreground animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <TrendingDown className="size-4" />
                  Update CMP / Stress Simulator
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{quickPricePosition.securityName} ({quickPricePosition.borrowerName})</p>
              </div>
              <button type="button" onClick={() => setQuickPricePosition(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded font-mono text-[11px]">
                <div>
                  <span className="text-muted-foreground text-[10px] block font-sans">Price @ Disb:</span>
                  <strong>₹{formatINR(quickPricePosition.priceAtDisbursement, 2)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block font-sans">Shares:</span>
                  <strong>{formatINR(quickPricePosition.sharesPledged)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Enter Current Market Price (₹):</label>
                <Input
                  type="number"
                  value={quickPriceInput || ""}
                  onChange={(e) => setQuickPriceInput(Number(e.target.value) || 0)}
                  className="h-9 text-sm font-mono font-bold"
                />
              </div>

              {/* Stress Simulator Quick Drop Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">Simulate Price Drops:</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 20, 30, 40].map((drop) => {
                    const simPrice = Math.round(quickPricePosition.priceAtDisbursement * (1 - drop / 100) * 100) / 100;
                    return (
                      <button
                        key={drop}
                        type="button"
                        onClick={() => setQuickPriceInput(simPrice)}
                        className="py-1 px-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/20 text-[10px] font-mono font-semibold"
                      >
                        -{drop}% (₹{simPrice})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Outcome Calculation */}
              {quickPriceInput > 0 && (
                <div className="p-2.5 rounded bg-indigo-50/50 dark:bg-indigo-950/30 border text-[11px] font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">% vs Disb Price:</span>
                    <strong className={quickPriceInput < quickPricePosition.priceAtDisbursement ? "text-red-600" : "text-emerald-600"}>
                      {quickPriceInput > quickPricePosition.priceAtDisbursement
                        ? `+${(((quickPriceInput - quickPricePosition.priceAtDisbursement) / quickPricePosition.priceAtDisbursement) * 100).toFixed(2)}% Above`
                        : quickPriceInput < quickPricePosition.priceAtDisbursement
                        ? `${Math.abs(((quickPriceInput - quickPricePosition.priceAtDisbursement) / quickPricePosition.priceAtDisbursement) * 100).toFixed(2)}% Below`
                        : "0.00% (At Disb)"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Updated Cover:</span>
                    <strong>{((quickPricePosition.sharesPledged * quickPriceInput) / quickPricePosition.disbursedAmount).toFixed(2)}x</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Shortfall:</span>
                    <strong className="text-destructive">
                      ₹{formatINR(Math.max(0, quickPricePosition.securityRequired - (quickPricePosition.sharesPledged * quickPriceInput)), 0)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickPricePosition(null)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveQuickPrice}
                disabled={isPending || quickPriceInput <= 0}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs font-semibold"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Apply & Update
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT POSITION DETAILS MODAL */}
      {editingPosition && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 text-foreground animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <Pencil className="size-4" />
                  Edit LAS Position Details
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Update quantities, disbursement price, current CMP, or loan amounts.
                </p>
              </div>
              <button type="button" onClick={() => setEditingPosition(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Borrower Name</label>
                <Input
                  value={editingPosition.borrowerName}
                  onChange={(e) => setEditingPosition({ ...editingPosition, borrowerName: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Loan Code</label>
                <Input
                  value={editingPosition.loanCode}
                  onChange={(e) => setEditingPosition({ ...editingPosition, loanCode: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-muted-foreground">Security / Stock Name</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleFetchEditQuote}
                    disabled={editIsFetchingQuote || (!(editingPosition.securityName || "").trim() && !(editingPosition.symbol || "").trim() && !(editingPosition.isin || "").trim())}
                    className="h-6 px-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 gap-1"
                  >
                    {editIsFetchingQuote ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3 text-amber-500 fill-amber-500" />}
                    ⚡ Fetch Live Quote
                  </Button>
                </div>
                <Input
                  value={editingPosition.securityName}
                  onChange={(e) => setEditingPosition({ ...editingPosition, securityName: e.target.value })}
                  className="h-8 text-xs"
                />

                {editQuoteResult && (
                  <div className="mt-1.5 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live {editQuoteResult.exchange || "NSE"} Quote:</span>
                      <strong className="font-mono text-sm">₹{formatINR(editQuoteResult.cmp, 2)}</strong>
                    </div>
                    {editQuoteResult.isin && (
                      <span className="font-mono text-[10px] bg-background/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        ISIN: {editQuoteResult.isin}
                      </span>
                    )}
                  </div>
                )}

                {editQuoteError && (
                  <div className="mt-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Info className="size-3.5 shrink-0 text-amber-500" />
                    <span>{editQuoteError}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">NSE / BSE Symbol</label>
                  <Input
                    value={editingPosition.symbol}
                    onChange={(e) => setEditingPosition({ ...editingPosition, symbol: e.target.value.toUpperCase() })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground">ISIN</label>
                  <Input
                    value={editingPosition.isin}
                    onChange={(e) => setEditingPosition({ ...editingPosition, isin: e.target.value.toUpperCase() })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Shares Pledged</label>
                <Input
                  type="number"
                  value={editingPosition.sharesPledged || ""}
                  onChange={(e) => setEditingPosition({ ...editingPosition, sharesPledged: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Price @ Disbursement (₹)</label>
                <Input
                  type="number"
                  value={editingPosition.priceAtDisbursement || ""}
                  onChange={(e) => setEditingPosition({ ...editingPosition, priceAtDisbursement: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-indigo-600 dark:text-indigo-400">Current CMP (₹)</label>
                <Input
                  type="number"
                  value={editingPosition.currentPrice || ""}
                  onChange={(e) => setEditingPosition({ ...editingPosition, currentPrice: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono font-bold border-indigo-400/50 bg-indigo-50/20 dark:bg-indigo-950/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Disbursement Date</label>
                <Input
                  type="date"
                  value={editingPosition.disbursementDate}
                  onChange={(e) => setEditingPosition({ ...editingPosition, disbursementDate: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Disbursement / Loan Amount (₹)</label>
                <Input
                  type="number"
                  value={editingPosition.disbursedAmount || ""}
                  onChange={(e) => setEditingPosition({ ...editingPosition, disbursedAmount: Number(e.target.value) || 0 })}
                  className="h-8 text-xs font-mono font-bold text-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-muted-foreground">Security Cover Required (**X)</label>
                  <div className="flex items-center gap-1">
                    {[2.0, 2.5, 3.0, 3.5, 4.0, 5.0].map((cov) => (
                      <button
                        key={cov}
                        type="button"
                        onClick={() => setEditingPosition({ ...editingPosition, requiredCover: cov })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          editingPosition.requiredCover === cov
                            ? "bg-indigo-600 text-white font-bold border-indigo-600 shadow-xs"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {cov}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editingPosition.requiredCover}
                    onChange={(e) => setEditingPosition({ ...editingPosition, requiredCover: Number(e.target.value) || 3.5 })}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    <option value={1.5}>1.50x (66.6% LTV)</option>
                    <option value={1.75}>1.75x (57.1% LTV)</option>
                    <option value={2.0}>2.00x (50.0% LTV)</option>
                    <option value={2.25}>2.25x (44.4% LTV)</option>
                    <option value={2.5}>2.50x (40.0% LTV)</option>
                    <option value={3.0}>3.00x (33.3% LTV)</option>
                    <option value={3.5}>3.50x (28.6% LTV)</option>
                    <option value={4.0}>4.00x (25.0% LTV)</option>
                    <option value={4.5}>4.50x (22.2% LTV)</option>
                    <option value={5.0}>5.00x (20.0% LTV)</option>
                  </select>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      value={editingPosition.requiredCover || ""}
                      onChange={(e) => setEditingPosition({ ...editingPosition, requiredCover: Number(e.target.value) || 0 })}
                      placeholder="Custom e.g. 3.5"
                      className="h-8 text-xs font-mono font-bold pr-6"
                    />
                    <span className="absolute right-2.5 top-2 text-[11px] font-bold text-muted-foreground">x</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingPosition(null)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpdatePosition}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 text-xs font-semibold gap-1.5 shadow-sm"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
