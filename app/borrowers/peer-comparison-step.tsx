"use client";

import type { ExtractedCorporateData } from "./corporate-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2, Layers, Award } from "lucide-react";

interface PeerComparisonStepProps {
  borrowerId: string;
  extractedData?: ExtractedCorporateData | null;
}

export function PeerComparisonStep({
  extractedData,
}: PeerComparisonStepProps) {
  const peerComparison = extractedData?.peerComparison;
  const legalName = extractedData?.profile?.legal_name || "Company";

  const industry = peerComparison?.industry || "Power / Renewable Energy";
  const segment = peerComparison?.segment || "EPC, BoP and BTG";
  const peers = peerComparison?.closest_peers || [];

  return (
    <div className="space-y-6">
      {/* Industry Header Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block">Industry &amp; Sector Benchmark</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-bold text-foreground">{industry}</span>
                <span className="text-muted-foreground">&middot;</span>
                <Badge variant="outline" className="text-xs">{segment}</Badge>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Peer benchmarking based on MCA financial filings of closest revenue competitors
          </div>
        </CardContent>
      </Card>

      {/* 5 Closest Peers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Closest Peers by Revenue
          </CardTitle>
          <CardDescription className="text-xs">
            Direct industry competitors ranked by turnover for credit benchmarking and capacity assessment
          </CardDescription>
        </CardHeader>

        <CardContent>
          {peers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Building2 className="size-8 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm font-semibold text-foreground">No Peer Data Available</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Peer comparison figures are automatically populated from corporate intelligence reports.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b">
                  <tr>
                    <th className="p-3 w-12">Rank</th>
                    <th className="p-3">Corporate Entity</th>
                    <th className="p-3">Registered City</th>
                    <th className="p-3 text-right">Revenue (₹ Crore)</th>
                    <th className="p-3 text-center">Benchmark Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {peers.map((peer, idx) => {
                    const isSubject =
                      peer.name.toUpperCase().includes(legalName.toUpperCase()) ||
                      legalName.toUpperCase().includes(peer.name.toUpperCase());

                    return (
                      <tr
                        key={idx}
                        className={
                          isSubject
                            ? "bg-primary/10 font-medium"
                            : "hover:bg-muted/30 transition-colors"
                        }
                      >
                        <td className="p-3 font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{peer.name}</span>
                            {isSubject && (
                              <Badge className="text-[10px] bg-primary text-primary-foreground py-0.5">
                                Current Borrower
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{peer.city}</td>
                        <td className="p-3 font-mono font-bold text-right text-foreground">
                          ₹{peer.revenue_crore.toFixed(2)} Cr
                        </td>
                        <td className="p-3 text-center">
                          {isSubject ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold">
                              <Award className="size-3.5" /> Subject
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Peer Competitor</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
