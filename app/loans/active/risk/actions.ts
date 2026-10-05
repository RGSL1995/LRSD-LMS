"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchLiveStockPrice } from "@/app/loans/market-actions";
import type { LASSecurityItem } from "@/app/loans/las-types";

export type LASRiskStatus = "critical" | "margin_call" | "watch" | "healthy" | "no_exposure";

export type LASRiskSecurity = {
  collateralId: string;
  name: string;
  isin: string;
  symbol: string;
  quantity: number;
  cmp: number;
  previousCmp: number | null;
  marketValue: number;
  pledgor: string;
  observedAt: string | null;
  stale: boolean;
};

export type LASRiskLoan = {
  id: string;
  loanCode: string;
  applicationCode: string;
  borrower: string;
  outstanding: number;
  collateralValue: number;
  coverage: number;
  ltv: number;
  status: LASRiskStatus;
  stalePrices: number;
  securities: LASRiskSecurity[];
  lastObservedAt: string | null;
};

type CollateralRow = {
  id: string;
  loan_application_id: string;
  collateral_type: string;
  address: string | null;
  estimated_value: number | string | null;
  details: string | null;
};

type ParsedSecurity = LASSecurityItem & { market_price_updated_at?: string };
type LatestSnapshot = {
  collateral_id: string;
  cmp: number;
  symbol: string | null;
  previous_cmp: number | null;
  market_value: number;
  observed_at: string;
  price_observed_at: string | null;
  price_is_stale: boolean;
  quote_source: string;
};

function readSecurity(row: CollateralRow): ParsedSecurity | null {
  if (row.collateral_type !== "Equity Shares") return null;
  if (row.details) {
    try {
      const value = JSON.parse(row.details) as Partial<ParsedSecurity>;
      if (value && typeof value === "object" && value.security_name) {
        return {
          id: String(value.id || row.id),
          security_name: String(value.security_name),
          isin: String(value.isin || ""),
          quantity: Number(value.quantity || 0),
          cmp: Number(value.cmp || 0),
          market_value: Number(value.market_value || row.estimated_value || 0),
          security_cover: Number(value.security_cover || 0),
          loan_value: Number(value.loan_value || 0),
          pledgor_name: String(value.pledgor_name || "—"),
          market_price_updated_at: value.market_price_updated_at,
        };
      }
    } catch {
      // Older collateral records may use plain text in `details`.
    }
  }

  const address = row.address || "Pledged equity shares";
  const isin = address.match(/ISIN:\s*([A-Z0-9]+)/i)?.[1] || "";
  const name = address.replace(/\s*\(ISIN:.*\)$/i, "");
  const value = Number(row.estimated_value || 0);
  return {
    id: row.id,
    security_name: name || "Pledged equity shares",
    isin,
    quantity: 1,
    cmp: value,
    market_value: value,
    security_cover: 0,
    loan_value: 0,
    pledgor_name: "—",
  };
}

function riskStatus(coverage: number, outstanding: number): LASRiskStatus {
  if (outstanding <= 0) return "no_exposure";
  if (coverage <= 1.75) return "critical";
  if (coverage <= 2) return "margin_call";
  if (coverage < 2.5) return "watch";
  return "healthy";
}

function displayBorrower(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "—";
  const row = relation as Record<string, unknown>;
  const profile = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | null;
  return String(
    profile(row.individual_profiles)?.full_name ||
    profile(row.corporate_profiles)?.legal_name ||
    profile(row.other_profiles)?.entity_name ||
    row.borrower_code || "—"
  );
}

export async function getLASRiskDashboard(): Promise<{ loans: LASRiskLoan[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { loans: [], error: "Sign in to view LAS risk monitoring." };

  const { data: loans, error: loansError } = await supabase
    .from("loans")
    .select("id, loan_code, sanctioned_amount, borrower_id, loan_application_id, borrowers ( borrower_code, individual_profiles ( full_name ), corporate_profiles ( legal_name ), other_profiles ( entity_name ) )")
    .eq("status", "active")
    .not("loan_application_id", "is", null)
    .order("created_at", { ascending: false });
  if (loansError) return { loans: [], error: loansError.message };
  if (!loans?.length) return { loans: [] };

  const loanIds = loans.map((loan) => loan.id);
  const appIds = [...new Set(loans.map((loan) => loan.loan_application_id).filter(Boolean))] as string[];
  const [appsRes, disbursementsRes, repaymentsRes, collateralRes] = await Promise.all([
    supabase.from("loan_applications").select("id, application_code, facility_type").in("id", appIds),
    supabase.from("loan_disbursements").select("loan_id, amount").in("loan_id", loanIds),
    supabase.from("loan_repayments").select("loan_id, amount").in("loan_id", loanIds),
    supabase.from("loan_collaterals").select("id, loan_application_id, collateral_type, address, estimated_value, details").in("loan_application_id", appIds),
  ]);

  if (collateralRes.error) return { loans: [], error: collateralRes.error.message };
  if (appsRes.error || disbursementsRes.error || repaymentsRes.error) {
    return { loans: [], error: appsRes.error?.message || disbursementsRes.error?.message || repaymentsRes.error?.message };
  }
  const apps = new Map((appsRes.data || []).map((row) => [row.id, row]));
  const disbursed = new Map<string, number>();
  const repaid = new Map<string, number>();
  for (const row of disbursementsRes.data || []) disbursed.set(row.loan_id, (disbursed.get(row.loan_id) || 0) + Number(row.amount || 0));
  for (const row of repaymentsRes.data || []) repaid.set(row.loan_id, (repaid.get(row.loan_id) || 0) + Number(row.amount || 0));
  const collateralsByApp = new Map<string, CollateralRow[]>();
  for (const row of (collateralRes.data || []) as CollateralRow[]) {
    const group = collateralsByApp.get(row.loan_application_id) || [];
    group.push(row);
    collateralsByApp.set(row.loan_application_id, group);
  }

  const collateralIds = (collateralRes.data || []).map((row) => row.id);
  let snapshots: LatestSnapshot[] = [];
  if (collateralIds.length) {
    const { data } = await supabase
      .from("las_risk_snapshots")
      .select("collateral_id, cmp, previous_cmp, symbol, market_value, observed_at, price_observed_at, price_is_stale, quote_source")
      .in("collateral_id", collateralIds)
      .order("observed_at", { ascending: false });
    snapshots = (data || []) as LatestSnapshot[];
  }
  const latestByCollateral = new Map<string, LatestSnapshot>();
  for (const row of snapshots) if (!latestByCollateral.has(row.collateral_id)) latestByCollateral.set(row.collateral_id, row);

  const result: LASRiskLoan[] = [];
  for (const loan of loans) {
    const appId = loan.loan_application_id as string;
    const app = apps.get(appId);
    const collateralRows = (collateralsByApp.get(appId) || []).filter((row) => readSecurity(row));
    if (!app || !/LAS|SECURIT/i.test(String(app.facility_type || "")) || collateralRows.length === 0) continue;

    const securities = collateralRows.map((row): LASRiskSecurity => {
      const parsed = readSecurity(row)!;
      const snapshot = latestByCollateral.get(row.id);
      const observedAt = snapshot?.price_observed_at || parsed.market_price_updated_at || null;
      const cmp = Number(snapshot?.cmp ?? parsed.cmp ?? 0);
      const mv = Number(snapshot?.market_value ?? ((parsed.quantity * cmp) || row.estimated_value || 0));
      const stale = Boolean(snapshot?.price_is_stale) || !observedAt || Date.now() - new Date(observedAt).getTime() > 24 * 60 * 60 * 1000;
      return {
        collateralId: row.id,
        name: parsed.security_name,
        isin: parsed.isin,
        symbol: snapshot?.symbol || "",
        quantity: parsed.quantity,
        cmp,
        previousCmp: snapshot?.previous_cmp ?? null,
        marketValue: mv,
        pledgor: parsed.pledgor_name || "—",
        observedAt,
        stale,
      };
    });
    const outstanding = Math.max(0, (disbursed.get(loan.id) || 0) - (repaid.get(loan.id) || 0));
    const collateralValue = securities.reduce((sum, security) => sum + security.marketValue, 0);
    const coverage = outstanding > 0 ? collateralValue / outstanding : 0;
    const lastObservedAt = securities.map((security) => security.observedAt).filter(Boolean).sort().at(-1) || null;
    result.push({
      id: loan.id,
      loanCode: loan.loan_code,
      applicationCode: app.application_code,
      borrower: displayBorrower(loan.borrowers),
      outstanding,
      collateralValue,
      coverage,
      ltv: collateralValue > 0 ? (outstanding / collateralValue) * 100 : 0,
      status: riskStatus(coverage, outstanding),
      stalePrices: securities.filter((security) => security.stale).length,
      securities,
      lastObservedAt,
    });
  }

  return { loans: result };
}

async function inBatches<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    results.push(...await Promise.all(items.slice(index, index + size).map(worker)));
  }
  return results;
}

export async function refreshLASRiskPrices(): Promise<{
  success: boolean;
  updatedCount?: number;
  failedCount?: number;
  checkedCount?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sign in before refreshing market data." };

  const dashboard = await getLASRiskDashboard();
  if (dashboard.error) return { success: false, error: dashboard.error };
  if (!dashboard.loans.length) return { success: true, updatedCount: 0, failedCount: 0, checkedCount: 0 };

  const securities = dashboard.loans.flatMap((loan) => loan.securities);
  const unique = new Map<string, LASRiskSecurity>();
  for (const security of securities) unique.set(security.isin || security.symbol || security.name, security);
  const quotes = new Map<string, Awaited<ReturnType<typeof fetchLiveStockPrice>>>();
  await inBatches([...unique.entries()], 5, async ([key, security]) => {
    quotes.set(key, await fetchLiveStockPrice(security.isin || security.symbol || security.name));
  });

  const now = new Date().toISOString();
  const rowsForSnapshot: Array<Record<string, unknown>> = [];
  let updatedCount = 0;
  let failedCount = 0;

  for (const loan of dashboard.loans) {
    const current = loan.securities.map((security) => {
      const key = security.isin || security.symbol || security.name;
      const quote = quotes.get(key);
      const fresh = Boolean(quote?.success && quote.cmp && quote.cmp > 0);
      if (fresh) updatedCount += 1;
      else failedCount += 1;
      const cmp = fresh ? Number(quote!.cmp) : security.cmp;
      const marketValue = security.quantity * cmp;
      return { security, quote, fresh, cmp, marketValue };
    });
    const totalValue = current.reduce((sum, row) => sum + row.marketValue, 0);
    const coverage = loan.outstanding > 0 ? totalValue / loan.outstanding : 0;
    const status = riskStatus(coverage, loan.outstanding);

    for (const row of current) {
      const { security, quote, fresh, cmp, marketValue } = row;
      if (fresh) {
        const { data: collateral } = await supabase
          .from("loan_collaterals")
          .select("details")
          .eq("id", security.collateralId)
          .maybeSingle();
        let details: Record<string, unknown> = {};
        try {
          details = collateral?.details ? JSON.parse(collateral.details) as Record<string, unknown> : {};
        } catch {
          // Replace legacy non-JSON details with the canonical LAS shape.
        }
        const nextDetails = {
          ...details,
          id: security.collateralId,
          security_name: security.name,
          isin: quote?.isin || security.isin,
          quantity: security.quantity,
          cmp,
          market_value: marketValue,
          market_price_updated_at: now,
        };
        const { error } = await supabase
          .from("loan_collaterals")
          .update({ details: JSON.stringify(nextDetails), estimated_value: marketValue })
          .eq("id", security.collateralId);
        if (error) return { success: false, error: `Could not save ${security.name}: ${error.message}` };
      }

      rowsForSnapshot.push({
        loan_id: loan.id,
        collateral_id: security.collateralId,
        loan_code: loan.loanCode,
        security_name: security.name,
        isin: quote?.isin || security.isin || null,
        symbol: quote?.symbol || null,
        quantity: security.quantity,
        cmp,
        previous_cmp: fresh ? Number(quote?.previousClose || 0) || null : security.previousCmp,
        market_value: marketValue,
        outstanding_principal: loan.outstanding,
        coverage_ratio: coverage,
        ltv_percent: totalValue > 0 ? (loan.outstanding / totalValue) * 100 : 0,
        risk_status: status,
        price_is_stale: !fresh,
        price_observed_at: fresh ? now : security.observedAt,
        quote_source: fresh ? "Yahoo Finance" : "Last known price",
        observed_at: now,
        recorded_by: user.id,
      });
    }
  }

  if (rowsForSnapshot.length) {
    const { error } = await supabase.from("las_risk_snapshots").insert(rowsForSnapshot);
    if (error) return { success: false, error: `Market prices refreshed but snapshot history could not be saved: ${error.message}` };
  }
  revalidatePath("/loans/active/risk");
  return { success: true, updatedCount, failedCount, checkedCount: securities.length };
}
