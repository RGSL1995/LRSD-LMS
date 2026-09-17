"use client";

import { useState, useEffect } from "react";
import type { ExtractedCorporateData, ExtractedOpenCharge } from "./corporate-types";
import { getLatestCorporateReport } from "./corporate-ingest-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CreditCard, Search, Landmark, ShieldAlert, FileText } from "lucide-react";

interface ChargesLendersStepProps {
  borrowerId: string;
  extractedData?: ExtractedCorporateData | null;
}

export function ChargesLendersStep({
  borrowerId,
  extractedData,
}: ChargesLendersStepProps) {
  const [corporateData, setCorporateData] = useState<ExtractedCorporateData | null>(
    extractedData ?? null,
  );

  useEffect(() => {
    if (extractedData) {
      setCorporateData(extractedData);
    }
  }, [extractedData]);

  useEffect(() => {
    if (!corporateData && borrowerId) {
      getLatestCorporateReport(borrowerId).then((report) => {
        if (report) {
          setCorporateData(report);
        }
      });
    }
  }, [borrowerId, corporateData]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Creation" | "Modification">("all");

  const charges: ExtractedOpenCharge[] = corporateData?.openCharges || [];
  const sumOfChargesStr = corporateData?.highlights?.sum_of_charges || null;

  const totalCalculatedAmount = charges.reduce((acc, c) => acc + (c.amount_crore || 0), 0);
  const uniqueLendersCount = new Set(charges.map((c) => c.holder_name.toUpperCase())).size;

  const filteredCharges = charges.filter((c) => {
    const matchesSearch =
      c.holder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.charge_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.property_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Sum of Charges</span>
              <span className="text-lg font-bold text-foreground">
                {sumOfChargesStr || `₹${totalCalculatedAmount.toFixed(2)} Cr`}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <FileText className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Identified Open Charges</span>
              <span className="text-lg font-bold text-foreground">{charges.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Landmark className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Unique Financial Lenders</span>
              <span className="text-lg font-bold text-foreground">{uniqueLendersCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charges Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="size-4 text-primary" /> Open Charges Sequence &amp; Lenders
              </CardTitle>
              <CardDescription className="text-xs">
                Active charges registered with MCA/ROC against assets, inventory, book debts, and equipment
              </CardDescription>
            </div>

            {/* Filter & Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search lender or charge ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs w-48 sm:w-60"
                />
              </div>

              <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    statusFilter === "all" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Creation")}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    statusFilter === "Creation" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  Creation
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Modification")}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    statusFilter === "Modification" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  Modification
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {charges.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <ShieldAlert className="size-8 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">No Open Charges Recorded</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                No active charge sequence was found. If you have an MCA or Corporate PDF report, upload it in Step 1 to auto-populate all charges.
              </p>
            </div>
          ) : filteredCharges.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No charges match your search query &quot;{searchTerm}&quot;.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-[11px] text-muted-foreground sticky top-0 border-b z-10">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Holder / Lender Name</th>
                      <th className="p-2.5">Amount (₹ Crore)</th>
                      <th className="p-2.5">Charge ID</th>
                      <th className="p-2.5">Creation Date</th>
                      <th className="p-2.5">Filing Date</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Property &amp; Security Hypothecation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCharges.map((charge, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 text-muted-foreground font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-2.5 font-medium text-foreground">{charge.holder_name}</td>
                        <td className="p-2.5 font-mono font-bold text-primary">
                          ₹{charge.amount_crore.toFixed(2)} Cr
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">{charge.charge_id}</td>
                        <td className="p-2.5 text-[11px] text-muted-foreground">{charge.date}</td>
                        <td className="p-2.5 text-[11px] text-muted-foreground">{charge.filing_date}</td>
                        <td className="p-2.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              charge.status === "Creation"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                            }`}
                          >
                            {charge.status}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-[11px] text-muted-foreground max-w-sm" title={charge.property_type}>
                          <p className="line-clamp-2">{charge.property_type}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
