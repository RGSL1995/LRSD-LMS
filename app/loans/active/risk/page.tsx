import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { NavBar } from "@/components/layout/nav-bar";
import { LoanSubNav } from "@/components/loans/loan-subnav";
import { RiskMonitorClient } from "./risk-monitor-client";
import { getLASRiskDashboard, getManualLASPositions } from "./actions";

export const dynamic = "force-dynamic";

export default async function LASRiskMonitoringPage() {
  const [{ loans, error }, { positions: manualPositions }] = await Promise.all([
    getLASRiskDashboard(),
    getManualLASPositions(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/loans/active" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" /> Active facilities</Link>
              <span className="text-muted-foreground/40">·</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><ShieldAlert className="size-3.5" /> LAS risk monitoring</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">LAS Portfolio Risk Monitor</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Manual LAS entry, live equity valuation, % vs disbursement price tracking, security cover monitoring (**X), and margin call alerts.
            </p>
          </div>
          <Link href="/loans/active" className="text-xs font-semibold text-primary hover:underline">View all active facilities</Link>
        </div>
        <LoanSubNav />
        <RiskMonitorClient loans={loans} initialManualPositions={manualPositions} error={error} />
      </main>
    </div>
  );
}
