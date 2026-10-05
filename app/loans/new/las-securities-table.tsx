"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddSecurityDialog } from "./add-security-dialog";
import {
  type LASSecurityItem,
  type SecurityProviderOption,
  type SecurityProviderGroup,
  formatIndianNumber,
  calculateCoverageRatio,
  getCoverageStatus,
} from "../las-types";
import {
  Plus,
  Trash2,
  Edit2,
  Landmark,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
  UserCheck,
} from "lucide-react";
import { fetchLiveStockPrice } from "../market-actions";
import { cn } from "@/lib/utils";

interface LASSecuritiesTableProps {
  securities: LASSecurityItem[];
  onChange: (items: LASSecurityItem[]) => void;
  requestedLoanAmount?: number;
  providers?: SecurityProviderOption[];
  onAddNewProvider?: () => void;
  suggestedPledgors?: string[];
  readOnly?: boolean;
  primaryBorrower?: SecurityProviderOption | null;
  onAddPrimaryBorrowerAsProvider?: () => void;
}

export function LASSecuritiesTable({
  securities,
  onChange,
  requestedLoanAmount = 0,
  providers = [],
  onAddNewProvider,
  suggestedPledgors = [],
  readOnly = false,
  primaryBorrower,
  onAddPrimaryBorrowerAsProvider,
}: LASSecuritiesTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LASSecurityItem | null>(null);
  const [selectedProviderForAdd, setSelectedProviderForAdd] = useState<string | undefined>(undefined);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Group securities bifurcated by Security Provider (SP 1, SP 2, etc.)
  const providerGroups: SecurityProviderGroup[] = useMemo(() => {
    const matchedSecIds = new Set<string>();
    const groups: SecurityProviderGroup[] = [];

    // 1. Process known registered providers
    providers.forEach((p) => {
      const pSecs = securities.filter((s) => {
        if (s.pledgor_borrower_id && s.pledgor_borrower_id === p.id) return true;
        if (!s.pledgor_borrower_id && s.pledgor_name && s.pledgor_name.toLowerCase() === p.name.toLowerCase()) return true;
        return false;
      });
      pSecs.forEach((s) => matchedSecIds.add(s.id));

      const totalMv = pSecs.reduce((sum, s) => sum + (s.market_value || 0), 0);
      const totalLv = pSecs.reduce((sum, s) => sum + (s.loan_value || 0), 0);

      groups.push({
        providerId: p.id,
        providerName: p.name,
        pan: p.pan,
        isGuarantor: p.isGuarantor,
        guaranteeType: p.guaranteeType,
        isPrimary: p.isPrimary,
        securities: pSecs,
        totalMarketValue: totalMv,
        totalLoanValue: totalLv,
        scripsCount: pSecs.length,
      });
    });

    // 2. Process orphaned securities (e.g. from manual/legacy entries)
    const unassigned = securities.filter((s) => !matchedSecIds.has(s.id));
    if (unassigned.length > 0) {
      const unassignedMap: Record<string, LASSecurityItem[]> = {};
      unassigned.forEach((s) => {
        const key = s.pledgor_name || "Unassigned Security Provider";
        if (!unassignedMap[key]) unassignedMap[key] = [];
        unassignedMap[key].push(s);
      });

      Object.entries(unassignedMap).forEach(([name, secs]) => {
        const totalMv = secs.reduce((sum, s) => sum + (s.market_value || 0), 0);
        const totalLv = secs.reduce((sum, s) => sum + (s.loan_value || 0), 0);
        groups.push({
          providerId: `unassigned_${name}`,
          providerName: name,
          pan: secs[0]?.pledgor_pan,
          isGuarantor: secs[0]?.is_guarantor,
          guaranteeType: secs[0]?.guarantee_type,
          securities: secs,
          totalMarketValue: totalMv,
          totalLoanValue: totalLv,
          scripsCount: secs.length,
        });
      });
    }

    return groups;
  }, [providers, securities]);

  // 1-click update all CMPs from NSE/BSE
  async function handleRefreshAllCMPs() {
    if (securities.length === 0 || isRefreshingAll) return;
    setIsRefreshingAll(true);
    try {
      const updated = await Promise.all(
        securities.map(async (s) => {
          const query = s.isin || s.security_name;
          const res = await fetchLiveStockPrice(query);
          if (res.success && res.cmp) {
            const newCmp = res.cmp;
            const newMv = Math.round(s.quantity * newCmp);
            const cover = s.security_cover || 2.5;
            const newLoanVal = cover > 0 ? Math.round(newMv / cover) : s.loan_value;
            return {
              ...s,
              cmp: newCmp,
              market_value: newMv,
              loan_value: newLoanVal,
            };
          }
          return s;
        })
      );
      onChange(updated);
    } catch {
      // ignore
    } finally {
      setIsRefreshingAll(false);
    }
  }

  function handleAddOrUpdate(item: LASSecurityItem) {
    if (editingItem) {
      onChange(securities.map((s) => (s.id === item.id ? item : s)));
      setEditingItem(null);
    } else {
      onChange([...securities, item]);
    }
  }

  function handleEdit(item: LASSecurityItem) {
    if (readOnly) return;
    setEditingItem(item);
    setSelectedProviderForAdd(item.pledgor_borrower_id);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    if (readOnly) return;
    onChange(securities.filter((s) => s.id !== id));
  }

  function handleOpenAddForProvider(providerId?: string) {
    if (readOnly) return;
    setEditingItem(null);
    setSelectedProviderForAdd(providerId);
    setDialogOpen(true);
  }

  // Load sample data if desired
  function handleLoadSample() {
    const firstProv = providers[0];
    const provName = firstProv ? firstProv.name : "Promoter Security Provider";
    const provId = firstProv?.id;
    const provPan = firstProv?.pan;
    const provIsGuarantor = firstProv?.isGuarantor;

    const sampleItems: LASSecurityItem[] = [
      {
        id: "sample_tcs",
        security_name: "Tata Consultancy Services Ltd",
        isin: "INE467B01029",
        quantity: 125500,
        cmp: 2128.7,
        market_value: 267151850,
        security_cover: 2.5,
        loan_value: 106860740,
        pledgor_name: provName,
        pledgor_borrower_id: provId,
        pledgor_pan: provPan,
        is_guarantor: provIsGuarantor,
      },
      {
        id: "sample_reliance",
        security_name: "Reliance Industries Ltd",
        isin: "INE002A01018",
        quantity: 200000,
        cmp: 1247.4,
        market_value: 249480000,
        security_cover: 2.5,
        loan_value: 99792000,
        pledgor_name: provName,
        pledgor_borrower_id: provId,
        pledgor_pan: provPan,
        is_guarantor: provIsGuarantor,
      },
    ];
    onChange([...securities, ...sampleItems]);
  }

  // Overall Portfolio Rollup Calculations
  const totalMarketValue = securities.reduce((sum, s) => sum + (s.market_value || 0), 0);
  const totalLoanValueFromSecurities = securities.reduce((sum, s) => sum + (s.loan_value || 0), 0);
  const effectiveLoanBase = requestedLoanAmount > 0 ? requestedLoanAmount : totalLoanValueFromSecurities;
  const overallCoverage = calculateCoverageRatio(totalMarketValue, effectiveLoanBase);
  const coverStatus = getCoverageStatus(overallCoverage);

  return (
    <div className="space-y-4">
      {/* Top Banner & Batch CMP Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3.5 rounded-xl border border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Landmark className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs text-foreground">
                LAS Pledged Securities Schedule
              </span>
              <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", coverStatus.colorClass)}>
                {coverStatus.label}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Bifurcated by Security Provider. Minimum <span className="font-semibold text-foreground">2.5x</span> cover policy required.
            </p>
          </div>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {securities.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleRefreshAllCMPs}
                disabled={isRefreshingAll}
                className="h-8 text-[11px] gap-1.5 font-medium text-muted-foreground hover:text-foreground border-dashed"
                title="Update all share prices from NSE/BSE"
              >
                {isRefreshingAll ? (
                  <Loader2 className="size-3 animate-spin text-primary" />
                ) : (
                  <RefreshCw className="size-3 text-emerald-600" />
                )}
                <span>{isRefreshingAll ? "Refreshing..." : "Refresh Live Prices"}</span>
              </Button>
            )}

            {securities.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleLoadSample}
                className="h-8 text-[11px] gap-1.5 font-medium border-dashed text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="size-3 text-amber-500" />
                Load Sample Template
              </Button>
            )}

            {onAddNewProvider && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddNewProvider}
                className="h-8 text-xs gap-1.5 font-medium"
              >
                <UserCheck className="size-3.5 text-primary" />
                + Security Provider
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenAddForProvider(undefined)}
              className="h-8 text-xs gap-1.5 font-semibold shadow-xs"
            >
              <Plus className="size-3.5" />
              Add Security
            </Button>
          </div>
        )}
      </div>

      {/* Bifurcated Provider Groups */}
      {providerGroups.length > 0 ? (
        <div className="space-y-4">
          {providerGroups.map((group, groupIdx) => (
            <div
              key={group.providerId}
              className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs"
            >
              {/* Provider Header Box */}
              <div className="p-3.5 bg-muted/50 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    SP {groupIdx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground">
                        {group.providerName}
                      </span>
                      {group.pan && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          PAN: {group.pan}
                        </Badge>
                      )}
                      {group.isGuarantor && (
                        <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 font-medium">
                          🛡️ {group.guaranteeType === "corporate" ? "Corporate" : "Personal"} Guarantor
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 font-medium">
                        🏦 Security Provider
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground block mt-0.5 font-mono">
                      {group.scripsCount} {group.scripsCount === 1 ? "Scrip" : "Scrips"} pledged
                    </span>
                  </div>
                </div>

                {/* Subtotals & Add Action */}
                <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="bg-background px-2.5 py-1 rounded-lg border border-border/70 text-right shadow-2xs">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold block">Market Value</span>
                      <span className="text-xs font-bold font-mono text-foreground">
                        ₹ {formatIndianNumber(group.totalMarketValue)}
                      </span>
                    </div>
                    <div className="bg-background px-2.5 py-1 rounded-lg border border-border/70 text-right shadow-2xs">
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold block">Loan Supported</span>
                      <span className="text-xs font-bold font-mono text-primary">
                        ₹ {formatIndianNumber(group.totalLoanValue)}
                      </span>
                    </div>
                  </div>

                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleOpenAddForProvider(group.providerId)}
                      className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10 shadow-2xs"
                    >
                      <Plus className="size-3" />
                      Add Security
                    </Button>
                  )}
                </div>
              </div>

              {/* Provider's Securities Sub-Table */}
              {group.securities.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/40 text-foreground font-semibold border-b border-border/60 text-[11px]">
                      <tr>
                        <th className="px-3 py-2 text-center w-12 font-mono">#</th>
                        <th className="px-3.5 py-2 min-w-[200px]">Security Name</th>
                        <th className="px-3.5 py-2 font-mono min-w-[120px]">ISIN</th>
                        <th className="px-3.5 py-2 text-right font-mono min-w-[90px]">Quantity</th>
                        <th className="px-3.5 py-2 text-right font-mono min-w-[80px]">CMP (₹)</th>
                        <th className="px-3.5 py-2 text-right font-mono min-w-[120px]">Market Value (₹)</th>
                        <th className="px-3.5 py-2 text-center font-mono min-w-[90px]">Cover</th>
                        <th className="px-3.5 py-2 text-right font-mono min-w-[120px]">Loan Value (₹)</th>
                        {!readOnly && <th className="px-3 py-2 text-right w-16">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {group.securities.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-3 py-2.5 text-center font-mono text-muted-foreground font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-2.5 font-semibold text-foreground">
                            {s.security_name}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-muted-foreground text-[11px] uppercase tracking-wider">
                            {s.isin}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-medium text-foreground">
                            {formatIndianNumber(s.quantity)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-foreground font-semibold">
                            {formatIndianNumber(s.cmp)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                            {formatIndianNumber(s.market_value)}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {s.security_cover ? `${s.security_cover}x` : "2.5x"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-medium text-foreground">
                            {formatIndianNumber(s.loan_value)}
                          </td>
                          {!readOnly && (
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(s)}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                  title="Edit Security"
                                >
                                  <Edit2 className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(s.id)}
                                  className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                                  title="Remove Security"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t font-semibold text-[11px] text-muted-foreground">
                      <tr>
                        <td colSpan={5} className="px-3.5 py-2 text-right font-medium">
                          Subtotal ({group.providerName}):
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-foreground">
                          ₹ {formatIndianNumber(group.totalMarketValue)}
                        </td>
                        <td />
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-primary">
                          ₹ {formatIndianNumber(group.totalLoanValue)}
                        </td>
                        {!readOnly && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground bg-muted/5 border-t border-dashed">
                  <p className="text-xs font-medium">No shares pledged by {group.providerName} yet.</p>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleOpenAddForProvider(group.providerId)}
                      className="mt-2 text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10"
                    >
                      <Plus className="size-3" />
                      Record Pledged Shares for {group.providerName}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Fallback if no providers registered yet */
        <div className="rounded-xl border border-dashed border-border/90 p-8 text-center bg-card space-y-3">
          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Landmark className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">No Security Providers Registered</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Add a Guarantor or Security Provider in the Obligor Structure above, or click &quot;Add Security&quot; to enter pledged shares directly.
            </p>
          </div>
          {!readOnly && (
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {onAddPrimaryBorrowerAsProvider && primaryBorrower && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddPrimaryBorrowerAsProvider}
                  className="gap-1.5 border-dashed text-primary hover:bg-primary/5"
                >
                  <UserCheck className="size-3.5 text-primary" />
                  + Add Primary Borrower as Pledgor
                </Button>
              )}
              {onAddNewProvider && (
                <Button type="button" variant="outline" size="sm" onClick={onAddNewProvider} className="gap-1.5">
                  <UserCheck className="size-3.5 text-primary" />
                  Register Security Provider
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => handleOpenAddForProvider(undefined)} className="gap-1.5">
                <Plus className="size-3.5" />
                Add Security Directly
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Combined Portfolio Rollup Strip */}
      {securities.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Overall Facility Portfolio Rollup
              </span>
              <Badge variant="outline" className={cn("text-[10px] font-mono font-bold px-2 py-0.5", coverStatus.colorClass)}>
                {overallCoverage}x Policy Coverage
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {overallCoverage >= 2.5
                ? `✓ Meets 2.5x policy standard across ${providerGroups.length} security provider(s). Total ₹${(totalMarketValue / 10000000).toFixed(2)} Cr pledged against ₹${(effectiveLoanBase / 10000000).toFixed(2)} Cr loan.`
                : `⚠️ Coverage is below the 2.5x threshold. Additional pledged shares required.`}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-background px-3 py-1.5 rounded-lg border border-border/80 text-right shadow-2xs">
              <span className="text-[10px] text-muted-foreground block font-medium">Grand Total Market Value</span>
              <span className="text-sm font-bold font-mono text-foreground">
                ₹ {formatIndianNumber(totalMarketValue)}
              </span>
            </div>
            <div className="bg-background px-3 py-1.5 rounded-lg border border-border/80 text-right shadow-2xs">
              <span className="text-[10px] text-muted-foreground block font-medium">Sanctioned / Loan Value</span>
              <span className="text-sm font-bold font-mono text-primary">
                ₹ {formatIndianNumber(effectiveLoanBase)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Security Modal */}
      <AddSecurityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleAddOrUpdate}
        initialItem={editingItem}
        providers={providers}
        defaultProviderId={selectedProviderForAdd}
        onAddNewProvider={onAddNewProvider}
        suggestedPledgors={suggestedPledgors}
        primaryBorrower={primaryBorrower}
      />
    </div>
  );
}
