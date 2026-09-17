"use client";

import { useState, useMemo } from "react";
import type { ExtractedCorporateData, ExtractedOpenCharge } from "./corporate-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Search,
  Landmark,
  ShieldAlert,
  Building2,
  Lock,
  Layers,
} from "lucide-react";

interface ChargeDetailsStepProps {
  borrowerId: string;
  extractedData?: ExtractedCorporateData | null;
}

export function ChargeDetailsStep({ extractedData }: ChargeDetailsStepProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLender, setSelectedLender] = useState<string>("all");

  const charges: ExtractedOpenCharge[] = extractedData?.openCharges || [];

  // Group by lender exposure
  const lenderExposure = useMemo(() => {
    const map = new Map<string, { totalAmount: number; count: number }>();
    charges.forEach((c) => {
      const name = c.holder_name.trim();
      const curr = map.get(name) || { totalAmount: 0, count: 0 };
      curr.totalAmount += c.amount_crore || 0;
      curr.count += 1;
      map.set(name, curr);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        totalAmount: data.totalAmount,
        count: data.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [charges]);

  // Group by collateral / property category
  const collateralTypes = useMemo(() => {
    let bookDebts = 0;
    let movableAssets = 0;
    let immovable = 0;
    let plantMachinery = 0;
    let otherFloating = 0;

    charges.forEach((c) => {
      const text = c.property_type.toLowerCase();
      if (text.includes("book debt") || text.includes("receivable")) bookDebts++;
      else if (text.includes("plant") || text.includes("machinery") || text.includes("equipment")) plantMachinery++;
      else if (text.includes("immovable") || text.includes("land") || text.includes("building")) immovable++;
      else if (text.includes("movable")) movableAssets++;
      else otherFloating++;
    });

    return [
      { label: "Book Debts & Receivables", count: bookDebts, color: "bg-blue-500" },
      { label: "Plant, Machinery & Equipment", count: plantMachinery, color: "bg-emerald-500" },
      { label: "Movable Assets & Stocks", count: movableAssets, color: "bg-amber-500" },
      { label: "Immovable Properties", count: immovable, color: "bg-indigo-500" },
      { label: "Floating & Project Security", count: otherFloating, color: "bg-purple-500" },
    ];
  }, [charges]);

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      const matchesSearch =
        c.holder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.charge_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.property_type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLender = selectedLender === "all" || c.holder_name === selectedLender;
      return matchesSearch && matchesLender;
    });
  }, [charges, searchTerm, selectedLender]);

  if (charges.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center bg-muted/20">
        <ShieldAlert className="size-10 mx-auto text-muted-foreground/60 mb-2" />
        <h3 className="text-base font-semibold text-foreground">No Charge Details Available</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Upload an MCA / Corporate PDF report in Step 1 to extract detailed security hypothecation and collateral data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Lock className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Primary Charge Ranks</span>
              <span className="text-base font-bold text-foreground">
                {charges.filter((c) => c.status === "Creation").length} Initial / {charges.filter((c) => c.status === "Modification").length} Modifications
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Landmark className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Lead Lender Consortium</span>
              <span className="text-sm font-bold text-foreground line-clamp-1">
                {lenderExposure[0]?.name || "N/A"}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                ₹{lenderExposure[0]?.totalAmount.toFixed(2)} Cr ({lenderExposure[0]?.count} charges)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Collateral Classification</span>
              <span className="text-base font-bold text-foreground">
                {collateralTypes.filter((t) => t.count > 0).length} Hypothecated Asset Classes
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lender-wise Exposure Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-primary" /> Lender-Wise Exposure Distribution
          </CardTitle>
          <CardDescription className="text-xs">
            Aggregated charge exposure per banking institution and debenture trustee
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lenderExposure.map((lender, i) => (
              <div
                key={i}
                onClick={() => setSelectedLender(selectedLender === lender.name ? "all" : lender.name)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedLender === lender.name
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-foreground line-clamp-2 leading-tight">
                    {lender.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {lender.count} {lender.count === 1 ? "charge" : "charges"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-baseline justify-between pt-1.5 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">Sanctioned</span>
                  <span className="font-mono font-bold text-primary">
                    ₹{lender.totalAmount.toFixed(2)} Cr
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Hypothecation & Asset Security Registry */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Hypothecated Security &amp; Asset Descriptions
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed description of property, book debts, equipment, and assets charged
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search security narrative..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs w-48 sm:w-64"
                />
              </div>

              {selectedLender !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedLender("all")}
                  className="text-xs text-primary underline hover:opacity-80"
                >
                  Clear Lender Filter
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-[480px] overflow-y-auto divide-y">
              {filteredCharges.map((charge, idx) => (
                <div key={idx} className="p-3.5 hover:bg-muted/20 transition-colors text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">
                        Charge #{charge.charge_id}
                      </span>
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
                      <span className="text-muted-foreground">&middot;</span>
                      <span className="text-muted-foreground">Date: {charge.date}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Amount:</span>
                      <span className="font-mono font-bold text-primary text-sm">
                        ₹{charge.amount_crore.toFixed(2)} Cr
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Landmark className="size-3.5 text-muted-foreground" />
                    <span>Lender: {charge.holder_name}</span>
                  </div>

                  <div className="rounded-md bg-muted/40 p-2.5 text-muted-foreground leading-relaxed text-[11px]">
                    <span className="font-semibold text-foreground block mb-0.5">Hypothecated Security / Property:</span>
                    {charge.property_type || "General floating charge on book debts, current assets, and movable properties."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
