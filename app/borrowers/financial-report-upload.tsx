"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  uploadFinancialReport,
  getCorporateFinancials,
  type FinancialUploadState,
  type CorporateFinancialRow,
} from "@/app/borrowers/financial-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: FinancialUploadState = { error: null, extracted: null };

function formatNumber(n: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN");
}

export function FinancialReportUpload({ borrowerId }: { borrowerId: string }) {
  const [state, formAction, pending] = useActionState(uploadFinancialReport, initialState);
  const [rows, setRows] = useState<CorporateFinancialRow[]>([]);
  const [, startLoad] = useTransition();
  const [lastHandled, setLastHandled] = useState(state);

  function refresh() {
    startLoad(async () => {
      const data = await getCorporateFinancials(borrowerId);
      setRows(data);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.error === null) refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Company financial report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Upload a company financial data report (Balance Sheet / P&amp;L Excel export) to
          automatically extract key figures.
        </p>

        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="borrower_id" value={borrowerId} />
          <input
            type="file"
            name="file"
            accept=".xls,.xlsx"
            required
            className="flex-1 text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Processing..." : "Upload & extract"}
          </Button>
        </form>

        {state.error && <p className="text-xs text-destructive">{state.error}</p>}

        {state.extracted && state.extracted.length > 0 && (
          <p className="text-xs text-emerald-600">
            Extracted{" "}
            {state.extracted
              .map((e) => `${e.statementType} FY${e.financialYearEnding.slice(0, 4)}`)
              .join(", ")}
            .
          </p>
        )}

        {state.extracted && state.extracted.length === 0 && (
          <p className="text-xs text-amber-600">
            File saved, but no recognizable financial data sheets were found in it.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1.5 text-left">Year</th>
                  <th className="px-2 py-1.5 text-left">Type</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                  <th className="px-2 py-1.5 text-right">EBITDA</th>
                  <th className="px-2 py-1.5 text-right">PAT</th>
                  <th className="px-2 py-1.5 text-right">Total assets</th>
                  <th className="px-2 py-1.5 text-right">Debt/Equity</th>
                  <th className="px-2 py-1.5 text-right">Current ratio</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-2 py-1.5">{r.financial_year_ending}</td>
                    <td className="px-2 py-1.5 capitalize">{r.statement_type}</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(r.net_revenue)}</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(r.ebitda)}</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(r.profit_after_tax)}</td>
                    <td className="px-2 py-1.5 text-right">{formatNumber(r.total_assets)}</td>
                    <td className="px-2 py-1.5 text-right">{r.debt_to_equity ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">{r.current_ratio ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
