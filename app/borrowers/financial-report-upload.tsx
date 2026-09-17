"use client";

import { useActionState, useEffect, useState, useTransition, type ChangeEvent } from "react";
import {
  uploadFinancialReport,
  getCorporateFinancials,
  type FinancialUploadState,
  type CorporateFinancialRow,
} from "@/app/borrowers/financial-actions";
import { parseAndIngestCorporatePdf } from "@/app/borrowers/corporate-ingest-actions";
import type { ExtractedCorporateData } from "@/app/borrowers/corporate-types";
import { EraseProfileButton } from "@/app/borrowers/erase-profile-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FileSpreadsheet, Loader2, CheckCircle2, Upload, ChevronDown, ChevronUp } from "lucide-react";

const initialState: FinancialUploadState = { error: null, extracted: null };

function formatNumber(n: number | null) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN");
}

export function FinancialReportUpload({
  borrowerId,
  onExtracted,
}: {
  borrowerId: string;
  onExtracted?: (data: ExtractedCorporateData) => void;
}) {
  const [state, formAction, pending] = useActionState(uploadFinancialReport, initialState);
  const [activeTab, setActiveTab] = useState<"pdf" | "excel">("pdf");
  const [pdfPending, startPdfTransition] = useTransition();
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [rows, setRows] = useState<CorporateFinancialRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, startLoad] = useTransition();
  const [lastHandled, setLastHandled] = useState(state);
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);

  const hasFinancials = rows.length > 0;
  // If financial documents/data already uploaded, default to de-expanded (collapsed).
  // When loading saved profiles, keep de-expanded until data is retrieved to avoid UI flicker.
  const isUploaderOpen =
    manuallyToggled !== null
      ? manuallyToggled
      : !loaded
      ? false
      : !hasFinancials;

  useEffect(() => {
    if (rows.length === 0) {
      setManuallyToggled(null);
    }
  }, [rows.length]);

  function refresh() {
    startLoad(async () => {
      const data = await getCorporateFinancials(borrowerId);
      setRows(data);
      setLoaded(true);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.error === null) {
      setManuallyToggled(false); // auto de-expand!
      refresh();
    }
  }

  function handlePdfUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfStatus(null);
    setPdfError(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("borrower_id", borrowerId);

    startPdfTransition(async () => {
      try {
        const res = await parseAndIngestCorporatePdf(null, formData);
        if (res.success) {
          setPdfStatus(res.message || "Financial data and corporate profile extracted from PDF.");
          setManuallyToggled(false); // auto de-expand!
          if (res.data && onExtracted) {
            onExtracted(res.data);
          }
          refresh();
        } else {
          setPdfError(res.error || "Failed to extract data from PDF.");
        }
      } catch (err: unknown) {
        setPdfError(err instanceof Error ? err.message : "Error uploading PDF.");
      }
    });

    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Company Financial Report</CardTitle>
            {hasFinancials && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-3" /> Data Uploaded ({rows.length} Periods)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ingest financial statements and ratios via Corporate PDF report or Excel spreadsheet.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasFinancials && (
            <Button
              type="button"
              size="sm"
              variant={isUploaderOpen ? "secondary" : "outline"}
              onClick={() => setManuallyToggled(!isUploaderOpen)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isUploaderOpen ? (
                <>
                  <ChevronUp className="size-3.5" />
                  <span>Collapse Uploader</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5 text-primary" />
                  <span>Upload / Replace Document</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </>
              )}
            </Button>
          )}

          {/* Segmented Option Switcher */}
          {isUploaderOpen && (
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("pdf")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "pdf"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="size-3.5 text-primary" /> 1. PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("excel")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "excel"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600" /> 2. Excel
              </button>
            </div>
          )}

          <EraseProfileButton borrowerId={borrowerId} onClearLocalForm={refresh} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isUploaderOpen && (
          <>
            {activeTab === "pdf" ? (
          <div className="space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  Upload MCA / Corporate Report PDF
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Automatically extracts 3-year Standalone &amp; Consolidated Balance Sheets, P&amp;L, and Ratios.
                </p>
              </div>

              <label className="inline-flex cursor-pointer items-center justify-center">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  disabled={pdfPending}
                  className="sr-only"
                />
                <Button size="sm" type="button" disabled={pdfPending} className="pointer-events-none gap-1.5">
                  {pdfPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Extracting PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="size-3.5" /> Select Corporate PDF
                    </>
                  )}
                </Button>
              </label>
            </div>

            {pdfStatus && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="size-4" /> {pdfStatus}
              </div>
            )}
            {pdfError && <p className="text-xs text-destructive">{pdfError}</p>}
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-dashed border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  Upload Financial Statements Spreadsheet
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Balance Sheet &amp; P&amp;L schedule export in .xlsx or .xls format.
                </p>
              </div>

              <form action={formAction} className="flex items-center gap-2">
                <input type="hidden" name="borrower_id" value={borrowerId} />
                <input
                  type="file"
                  name="file"
                  accept=".xls,.xlsx"
                  required
                  className="max-w-[200px] text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs"
                />
                <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
                  {pending ? "Processing..." : "Extract Excel"}
                </Button>
              </form>
            </div>

            {state.error && <p className="text-xs text-destructive">{state.error}</p>}
            {state.extracted && state.extracted.length > 0 && (
              <p className="text-xs text-emerald-600 font-medium">
                Extracted{" "}
                {state.extracted
                  .map((e) => `${e.statementType} FY${e.financialYearEnding.slice(0, 4)}`)
                  .join(", ")}
                .
              </p>
            )}
          </div>
        )}
      </>
    )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Period Ending</th>
                  <th className="px-3 py-2 text-left font-medium">Statement Type</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue (Cr)</th>
                  <th className="px-3 py-2 text-right font-medium">EBITDA (Cr)</th>
                  <th className="px-3 py-2 text-right font-medium">PAT (Cr)</th>
                  <th className="px-3 py-2 text-right font-medium">Total Assets (Cr)</th>
                  <th className="px-3 py-2 text-right font-medium">Debt / Equity</th>
                  <th className="px-3 py-2 text-right font-medium">Current Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.financial_year_ending}</td>
                    <td className="px-3 py-2 capitalize font-medium">{r.statement_type}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.net_revenue)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.ebitda)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.profit_after_tax)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(r.total_assets)}</td>
                    <td className="px-3 py-2 text-right">{r.debt_to_equity ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{r.current_ratio ?? "—"}</td>
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
