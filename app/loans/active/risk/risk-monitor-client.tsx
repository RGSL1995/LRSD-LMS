"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { refreshLASRiskPrices, type LASRiskLoan, type LASRiskStatus } from "./actions";

type Filter = "all" | LASRiskStatus | "stale";

const STATUS_META: Record<LASRiskStatus, { label: string; className: string; rank: number }> = {
  critical: { label: "Critical · Liquidation trigger", className: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300", rank: 0 },
  margin_call: { label: "Margin call", className: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300", rank: 1 },
  watch: { label: "Watch", className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300", rank: 2 },
  healthy: { label: "Healthy", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", rank: 3 },
  no_exposure: { label: "No drawn exposure", className: "border-border bg-muted text-muted-foreground", rank: 4 },
};

function inr(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
}

function observedDate(value: string | null) {
  if (!value) return "Not yet refreshed";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function RiskBadge({ status }: { status: LASRiskStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant="outline" className={`whitespace-nowrap font-semibold ${meta.className}`}>{meta.label}</Badge>;
}

export function RiskMonitorClient({ loans, error }: { loans: LASRiskLoan[]; error?: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();

  const orderedLoans = useMemo(() => [...loans]
    .filter((loan) => filter === "all" || (filter === "stale" ? loan.stalePrices > 0 : loan.status === filter))
    .sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank || a.coverage - b.coverage), [loans, filter]);

  const critical = loans.filter((loan) => loan.status === "critical").length;
  const marginCalls = loans.filter((loan) => loan.status === "margin_call").length;
  const watches = loans.filter((loan) => loan.status === "watch").length;
  const staleCount = loans.filter((loan) => loan.stalePrices > 0).length;
  const totalExposure = loans.reduce((sum, loan) => sum + loan.outstanding, 0);

  function refresh() {
    setFeedback("");
    startTransition(async () => {
      const result = await refreshLASRiskPrices();
      if (!result.success) {
        setFeedback(result.error || "Price refresh failed.");
        return;
      }
      setFeedback(`Checked ${result.checkedCount || 0} pledged position(s): ${result.updatedCount || 0} live quote(s) refreshed${result.failedCount ? `, ${result.failedCount} using last known price` : ""}.`);
      router.refresh();
    });
  }

  const filters: Array<{ value: Filter; label: string; count: number }> = [
    { value: "all", label: "All facilities", count: loans.length },
    { value: "critical", label: "Critical", count: critical },
    { value: "margin_call", label: "Margin call", count: marginCalls },
    { value: "watch", label: "Watch", count: watches },
    { value: "stale", label: "Stale prices", count: staleCount },
    { value: "healthy", label: "Healthy", count: loans.filter((loan) => loan.status === "healthy").length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Activity className="size-4" /></div>
          <div>
            <div className="text-sm font-semibold">LAS risk policy bands</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Critical at ≤1.75x cover · Margin call at ≤2.00x · Watch below 2.50x. Prices older than 24 hours are marked stale.</p>
          </div>
        </div>
        <Button onClick={refresh} disabled={isPending || Boolean(error)} className="shrink-0">
          <RefreshCw className={`mr-2 size-4 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Refreshing market data…" : "Refresh market prices"}
        </Button>
      </div>

      {(error || feedback) && <div className={`rounded-lg border p-3 text-sm ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>{error || feedback}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="LAS facilities monitored" value={String(loans.length)} icon={<Building2 className="size-4" />} />
        <Metric label="Outstanding exposure" value={inr(totalExposure)} icon={<Activity className="size-4" />} />
        <Metric label="Action required" value={String(critical + marginCalls)} icon={<AlertTriangle className="size-4" />} detail={`${critical} critical · ${marginCalls} margin call`} tone={critical + marginCalls > 0 ? "danger" : "normal"} />
        <Metric label="Stale price facilities" value={String(staleCount)} icon={<Clock3 className="size-4" />} detail={`${watches} additional facilities on watch`} tone={staleCount > 0 ? "warning" : "normal"} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border/70 pb-3">
        {filters.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
            {item.label}<span className="ml-1.5 opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {orderedLoans.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center">
          <ShieldCheck className="size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-semibold">{loans.length ? "No facilities match this filter" : "No active LAS facilities found"}</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">Active LAS facilities with pledged equity securities appear here. Refresh market prices to start a timestamped risk history.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {orderedLoans.map((loan) => <LoanRiskCard key={loan.id} loan={loan} />)}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Market quotes are sourced from Yahoo Finance and may be delayed or unavailable. Review freshness before acting on a risk flag.</p>
    </div>
  );
}

function Metric({ label, value, icon, detail, tone = "normal" }: { label: string; value: string; icon: React.ReactNode; detail?: string; tone?: "normal" | "warning" | "danger" }) {
  return <Card><CardContent className="p-4">
    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><span className={tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-primary"}>{icon}</span></div>
    <div className={`mt-2 text-xl font-bold tracking-tight ${tone === "danger" ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>{value}</div>
    {detail && <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>}
  </CardContent></Card>;
}

function LoanRiskCard({ loan }: { loan: LASRiskLoan }) {
  return <Card className="overflow-hidden border-border/80">
    <CardContent className="p-0">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(120px,.55fr))_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Link href={`/loans/active/${loan.id}`} className="font-mono text-sm font-bold hover:text-primary">{loan.loanCode}</Link><RiskBadge status={loan.status} /></div>
          <div className="mt-1 truncate text-xs font-medium text-foreground">{loan.borrower}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Application {loan.applicationCode} · {loan.securities.length} pledged scrip{loan.securities.length === 1 ? "" : "s"}</div>
        </div>
        <Value label="Security cover" value={loan.outstanding > 0 ? `${loan.coverage.toFixed(2)}x` : "—"} detail={loan.stalePrices ? `${loan.stalePrices} stale quote${loan.stalePrices === 1 ? "" : "s"}` : "Prices current"} tone={loan.status === "critical" || loan.status === "margin_call" ? "danger" : "normal"} />
        <Value label="LTV" value={loan.outstanding > 0 ? `${loan.ltv.toFixed(1)}%` : "—"} detail={`Outstanding ${inr(loan.outstanding)}`} />
        <Value label="Pledged market value" value={inr(loan.collateralValue)} detail={`Last quote ${observedDate(loan.lastObservedAt)}`} />
        <Link href={`/loans/active/${loan.id}`} className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Open facility</Link>
      </div>
      <div className="overflow-x-auto border-t bg-muted/20">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 font-semibold">Pledged security</th><th className="px-4 py-2 font-semibold">ISIN</th><th className="px-4 py-2 text-right font-semibold">Quantity</th><th className="px-4 py-2 text-right font-semibold">CMP</th><th className="px-4 py-2 text-right font-semibold">1D move</th><th className="px-4 py-2 text-right font-semibold">Market value</th><th className="px-4 py-2 text-right font-semibold">Quote status</th></tr></thead>
          <tbody className="divide-y divide-border/60">{loan.securities.map((security) => <tr key={security.collateralId}>
            <td className="px-4 py-2.5 font-medium">{security.name}<div className="mt-0.5 text-[10px] text-muted-foreground">{security.symbol ? `${security.symbol} · ` : ""}Pledgor: {security.pledgor}</div></td>
            <td className="px-4 py-2.5 font-mono text-muted-foreground">{security.isin || "—"}</td>
            <td className="px-4 py-2.5 text-right font-mono">{security.quantity.toLocaleString("en-IN")}</td>
            <td className="px-4 py-2.5 text-right font-mono">{security.cmp ? inr(security.cmp) : "—"}</td>
            <td className="px-4 py-2.5 text-right font-mono">{security.previousCmp && security.previousCmp > 0 ? (() => { const change = ((security.cmp - security.previousCmp) / security.previousCmp) * 100; const Icon = change < 0 ? ArrowDownRight : ArrowUpRight; return <span className={`inline-flex items-center justify-end gap-0.5 ${change < 0 ? "text-red-600" : "text-emerald-600"}`}><Icon className="size-3" />{Math.abs(change).toFixed(2)}%</span>; })() : "—"}</td>
            <td className="px-4 py-2.5 text-right font-mono">{inr(security.marketValue)}</td>
            <td className="px-4 py-2.5 text-right"><span className={`inline-flex items-center gap-1 ${security.stale ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{security.stale ? <><Clock3 className="size-3" /> Stale</> : <><RefreshCw className="size-3" /> Current</>}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </CardContent>
  </Card>;
}

function Value({ label, value, detail, tone = "normal" }: { label: string; value: string; detail: string; tone?: "normal" | "danger" }) {
  return <div><div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className={`mt-1 text-sm font-bold font-mono ${tone === "danger" ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>{value}</div><div className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</div></div>;
}
