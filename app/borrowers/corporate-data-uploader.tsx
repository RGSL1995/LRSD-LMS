"use client";

import { useState, useMemo, useTransition, type ChangeEvent } from "react";
import { parseAndIngestCorporatePdf } from "./corporate-ingest-actions";
import { uploadFinancialReport, type FinancialUploadState } from "./financial-actions";
import { parseFinancialReport } from "./financial-parser";
import type { ExtractedCorporateData } from "./corporate-types";
import { EraseProfileButton } from "./erase-profile-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  Network,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  ReceiptText,
  Search,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  AlertTriangle,
  X,
} from "lucide-react";

interface CorporateDataUploaderProps {
  borrowerId?: string;
  hasExistingData?: boolean;
  onPdfExtracted?: (data: ExtractedCorporateData) => void;
  onExcelExtracted?: (financials: Array<{ statementType: string; financialYearEnding: string }>) => void;
  onClearForm?: () => void;
  className?: string;
}

export function CorporateDataUploader({
  borrowerId,
  hasExistingData = false,
  onPdfExtracted,
  onExcelExtracted,
  onClearForm,
  className = "",
}: CorporateDataUploaderProps) {
  const [activeTab, setActiveTab] = useState<"pdf" | "excel">("pdf");
  const [isProcessing, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedCorporateData | null>(null);
  const [showDossier, setShowDossier] = useState(true);
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);

  // Additional filter states for previewing complete extracted data
  const [gstViewMode, setGstViewMode] = useState<"both" | "directory" | "annexure">("both");
  const [gstDirectoryFilter, setGstDirectoryFilter] = useState<"all" | "active" | "inactive">("all");
  const [gstSearch, setGstSearch] = useState("");
  const [gstSelectedGstin, setGstSelectedGstin] = useState<string>("all");
  const [gstSelectedReturnType, setGstSelectedReturnType] = useState<string>("all");
  const [gstSelectedStatus, setGstSelectedStatus] = useState<string>("all");
  const [gstFilingSearch, setGstFilingSearch] = useState("");
  const [gstPage, setGstPage] = useState(1);
  const [gstPageSize, setGstPageSize] = useState<number | "all">(50);
  const [copiedGstin, setCopiedGstin] = useState<string | null>(null);

  const [chargesSearch, setChargesSearch] = useState("");
  const [structureSearch, setStructureSearch] = useState("");
  const [rptSearch, setRptSearch] = useState("");
  const [rptMaterialOnly, setRptMaterialOnly] = useState(false);

  // Memoized full filings ledger from all GSTINs
  const allFilings = useMemo(() => {
    if (!extractedData?.gstins) return [];
    const list: Array<{
      gstin: string;
      state?: string;
      returnType: string;
      financialYear: string;
      taxPeriod: string;
      dueDate?: string;
      filingDate?: string;
      status: string;
    }> = [];

    for (const g of extractedData.gstins) {
      for (const f of g.filings || []) {
        list.push({
          gstin: g.gstin,
          state: g.state,
          ...f,
        });
      }
    }
    return list;
  }, [extractedData]);

  const totalGstins = extractedData?.gstins?.length || 0;
  const activeGstinsCount = (extractedData?.gstins || []).filter(
    (g) => g.status?.toLowerCase() === "active",
  ).length;
  const inactiveGstinsCount = totalGstins - activeGstinsCount;
  const totalFilingsCount = allFilings.length;
  const onTimeFilingsCount = allFilings.filter((f) => f.status?.toLowerCase().includes("time")).length;
  const lateFilingsCount = allFilings.filter(
    (f) => f.status?.toLowerCase().includes("after") || f.status?.toLowerCase().includes("late"),
  ).length;
  const complianceRate =
    totalFilingsCount > 0 && onTimeFilingsCount + lateFilingsCount > 0
      ? ((onTimeFilingsCount / (onTimeFilingsCount + lateFilingsCount)) * 100).toFixed(1)
      : "100.0";
  const statesCovered = useMemo(() => {
    if (!extractedData?.gstins) return 0;
    return new Set(extractedData.gstins.map((g) => g.state).filter(Boolean)).size;
  }, [extractedData]);

  // Filtered GSTIN Directory
  const filteredGstins = useMemo(() => {
    if (!extractedData?.gstins) return [];
    return extractedData.gstins.filter((g) => {
      const isAct = g.status?.toLowerCase() === "active";
      if (gstDirectoryFilter === "active" && !isAct) return false;
      if (gstDirectoryFilter === "inactive" && isAct) return false;
      if (gstSearch.trim()) {
        const q = gstSearch.toLowerCase();
        const matchGstin = g.gstin.toLowerCase().includes(q);
        const matchState = g.state?.toLowerCase().includes(q);
        const matchJuris =
          g.centreJurisdiction?.toLowerCase().includes(q) ||
          g.stateJurisdiction?.toLowerCase().includes(q);
        const matchLegal = g.legalName?.toLowerCase().includes(q);
        if (!matchGstin && !matchState && !matchJuris && !matchLegal) return false;
      }
      return true;
    });
  }, [extractedData, gstDirectoryFilter, gstSearch]);

  // Filtered Annexure Filings
  const filteredFilings = useMemo(() => {
    return allFilings.filter((f) => {
      if (gstSelectedGstin !== "all" && f.gstin !== gstSelectedGstin) return false;
      if (gstSelectedReturnType !== "all") {
        const r = f.returnType.toUpperCase();
        if (!r.includes(gstSelectedReturnType.toUpperCase())) return false;
      }
      if (gstSelectedStatus !== "all") {
        const s = f.status.toLowerCase();
        if (gstSelectedStatus === "on_time" && !s.includes("time")) return false;
        if (gstSelectedStatus === "delayed" && !s.includes("after") && !s.includes("late")) return false;
        if (gstSelectedStatus === "pending" && !s.includes("pending")) return false;
      }
      if (gstFilingSearch.trim()) {
        const q = gstFilingSearch.toLowerCase();
        const matchPeriod = f.taxPeriod.toLowerCase().includes(q);
        const matchFy = f.financialYear.toLowerCase().includes(q);
        const matchGstin = f.gstin.toLowerCase().includes(q);
        const matchState = f.state?.toLowerCase().includes(q);
        if (!matchPeriod && !matchFy && !matchGstin && !matchState) return false;
      }
      return true;
    });
  }, [allFilings, gstSelectedGstin, gstSelectedReturnType, gstSelectedStatus, gstFilingSearch]);

  const effectivePageSize = gstPageSize === "all" ? filteredFilings.length || 1 : gstPageSize;
  const totalPages = gstPageSize === "all" ? 1 : Math.ceil(filteredFilings.length / effectivePageSize) || 1;
  const paginatedFilings = useMemo(() => {
    if (gstPageSize === "all") return filteredFilings;
    const start = (gstPage - 1) * effectivePageSize;
    return filteredFilings.slice(start, start + effectivePageSize);
  }, [filteredFilings, gstPage, gstPageSize, effectivePageSize]);

  function exportFilingsCsv() {
    if (!filteredFilings.length) return;
    const headers = [
      "GSTIN",
      "State",
      "Return Form",
      "Financial Year",
      "Tax Period",
      "Due Date",
      "Filing Date",
      "Compliance Status",
    ];
    const rows = filteredFilings.map((f) => [
      `"${f.gstin}"`,
      `"${f.state || ""}"`,
      `"${f.returnType}"`,
      `"${f.financialYear}"`,
      `"${f.taxPeriod}"`,
      `"${f.dueDate || ""}"`,
      `"${f.filingDate || ""}"`,
      `"${f.status}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST_Annexure_Filings_${borrowerId || "preview"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleCopyGstin(gstin: string) {
    navigator.clipboard.writeText(gstin);
    setCopiedGstin(gstin);
    setTimeout(() => setCopiedGstin(null), 2000);
  }

  // Filtered Open Charges (without slicing!)
  const filteredCharges = useMemo(() => {
    if (!extractedData?.openCharges) return [];
    if (!chargesSearch.trim()) return extractedData.openCharges;
    const q = chargesSearch.toLowerCase();
    return extractedData.openCharges.filter(
      (c) =>
        c.holder_name.toLowerCase().includes(q) ||
        c.charge_id.toLowerCase().includes(q) ||
        c.property_type.toLowerCase().includes(q),
    );
  }, [extractedData, chargesSearch]);

  // Filtered Group Structure (without slicing!)
  const filteredStructure = useMemo(() => {
    if (!extractedData?.groupStructure) return [];
    if (!structureSearch.trim()) return extractedData.groupStructure;
    const q = structureSearch.toLowerCase();
    return extractedData.groupStructure.filter(
      (s) =>
        s.entity_name.toLowerCase().includes(q) ||
        s.relationship_type.toLowerCase().includes(q) ||
        s.cin_or_registration?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q),
    );
  }, [extractedData, structureSearch]);

  // Filtered RPT (with FY, description, amounts)
  const filteredRpt = useMemo(() => {
    if (!extractedData?.rpt) return [];
    return extractedData.rpt.filter((item) => {
      if (rptMaterialOnly && !item.isMaterial) return false;
      if (rptSearch.trim()) {
        const q = rptSearch.toLowerCase();
        const matchName = item.partyName.toLowerCase().includes(q);
        const matchType = item.transactionType.toLowerCase().includes(q);
        const matchRel = item.relationship.toLowerCase().includes(q);
        const matchFy = item.financialYear?.toLowerCase().includes(q);
        if (!matchName && !matchType && !matchRel && !matchFy) return false;
      }
      return true;
    });
  }, [extractedData, rptMaterialOnly, rptSearch]);

  // If this is an existing saved profile and no new upload has been initiated, hide completely
  if (hasExistingData && !extractedData) {
    return null;
  }

  const hasData = Boolean(extractedData);
  // Default to de-expanded (collapsed) when corporate document/dossier is already uploaded/extracted
  const isUploaderOpen = manuallyToggled !== null ? manuallyToggled : !hasData;

  const [activeDossierTab, setActiveDossierTab] = useState<
    "about" | "directors" | "charges" | "structure" | "financials" | "peers" | "compliance" | "rpt" | "gst"
  >("about");

  async function handlePdfUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setStatusMessage(null);

    const formData = new FormData();
    formData.set("file", file);
    if (borrowerId) {
      formData.set("borrower_id", borrowerId);
    }

    startTransition(async () => {
      try {
        const res = await parseAndIngestCorporatePdf(null, formData);
        if (res.success && res.data) {
          setExtractedData(res.data);
          setManuallyToggled(false); // auto de-expand!
          setStatusMessage({
            type: "success",
            text: res.message || "Corporate PDF parsed and ingested successfully!",
          });
          if (onPdfExtracted) {
            onPdfExtracted(res.data);
          }
        } else {
          setStatusMessage({
            type: "error",
            text: res.error || "Failed to parse corporate report PDF.",
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error processing PDF.";
        setStatusMessage({ type: "error", text: msg });
      }
    });

    e.target.value = "";
  }

  async function handleExcelUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        if (borrowerId) {
          const formData = new FormData();
          formData.set("file", file);
          formData.set("borrower_id", borrowerId);
          const res: FinancialUploadState = await uploadFinancialReport({ error: null, extracted: null }, formData);
          if (res.error) {
            setStatusMessage({ type: "error", text: res.error });
          } else {
            setManuallyToggled(false); // auto de-expand!
            setStatusMessage({
              type: "success",
              text: `Excel extracted ${res.extracted?.length ?? 0} statement periods.`,
            });
            if (onExcelExtracted && res.extracted) {
              onExcelExtracted(res.extracted);
            }
          }
        } else {
          const buffer = Buffer.from(await file.arrayBuffer());
          const statements = parseFinancialReport(buffer);
          setManuallyToggled(false); // auto de-expand!
          setStatusMessage({
            type: "success",
            text: `Extracted ${statements.length} financial statement periods from Excel.`,
          });
          if (onExcelExtracted) {
            onExcelExtracted(
              statements.map((s) => ({
                statementType: s.statementType,
                financialYearEnding: s.financialYearEnding,
              })),
            );
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error reading Excel file.";
        setStatusMessage({ type: "error", text: msg });
      }
    });

    e.target.value = "";
  }

  return (
    <Card className={`overflow-hidden border-primary/25 bg-primary/5 shadow-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/15 bg-primary/10 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Quick Ingest Corporate Data
          </span>
          {hasData && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="size-3" /> Dossier Ingested
            </span>
          )}
        </div>

        {/* Tab Selection, Expand/Collapse Toggle & Erase Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasData && (
            <Button
              type="button"
              size="sm"
              variant={isUploaderOpen ? "secondary" : "outline"}
              onClick={() => setManuallyToggled(!isUploaderOpen)}
              className="h-7 text-xs gap-1.5"
            >
              {isUploaderOpen ? (
                <>
                  <ChevronUp className="size-3.5" />
                  <span>Collapse Uploader</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5 text-primary" />
                  <span>Upload / Replace File</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </>
              )}
            </Button>
          )}

          {isUploaderOpen && (
            <div className="inline-flex rounded-lg border bg-background/80 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("pdf");
                  setStatusMessage(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "pdf"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="size-3.5" /> 1. PDF Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("excel");
                  setStatusMessage(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === "excel"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet className="size-3.5" /> 2. Excel
              </button>
            </div>
          )}

          <EraseProfileButton
            borrowerId={borrowerId}
            onClearLocalForm={() => {
              setSelectedFileName(null);
              setStatusMessage(null);
              setExtractedData(null);
              setManuallyToggled(null);
              if (onClearForm) onClearForm();
            }}
          />
        </div>
      </div>

      {(isUploaderOpen || statusMessage || extractedData) && (
        <CardContent className="p-4 space-y-3">
        {isUploaderOpen && (
          <>
            {activeTab === "pdf" ? (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Upload an <strong>MCA / Corporate Company Report PDF</strong> to extract About Company,
              Directors, Open Charges, Group Structure, Financials, Peer Comparison, Compliance Checks, Related Party Transactions (RPT), and GST Filings with 0 external API tokens.
            </p>

            <label className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-background/60 p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-background/90 transition-colors">
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={handlePdfUpload}
                disabled={isProcessing}
              />
              {isProcessing ? (
                <div className="flex items-center gap-2 text-primary font-medium text-xs">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Parsing Corporate PDF &amp; Extracting Intelligence Dossier Locally...</span>
                </div>
              ) : (
                <>
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                    <Upload className="size-5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    Click or drag &amp; drop MCA / Corporate Report PDF
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Extracts About Company, Directors, Charges, Financials, Peers, Structure, and Compliance
                  </span>
                  {selectedFileName && (
                    <span className="mt-2 font-mono text-[11px] text-primary underline">
                      {selectedFileName}
                    </span>
                  )}
                </>
              )}
            </label>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Upload a <strong>Company Financial Export (.xlsx, .xls)</strong> containing Standalone / Consolidated Balance Sheets and P&amp;L schedules.
            </p>

            <label className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-500/30 bg-background/60 p-6 text-center cursor-pointer hover:border-emerald-500/60 hover:bg-background/90 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={handleExcelUpload}
                disabled={isProcessing}
              />
              {isProcessing ? (
                <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Extracting financial statements from spreadsheet...</span>
                </div>
              ) : (
                <>
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
                    <FileSpreadsheet className="size-5" />
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    Click or drag &amp; drop Excel spreadsheet
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Populates balance sheet, EBITDA, revenue, liabilities, and debt ratios
                  </span>
                  {selectedFileName && (
                    <span className="mt-2 font-mono text-[11px] text-emerald-600 underline">
                      {selectedFileName}
                    </span>
                  )}
                </>
              )}
            </label>
          </div>
        )}
      </>
    )}

        {statusMessage && (
          <div
            className={`flex items-start gap-2 rounded-lg p-3 text-xs leading-snug font-medium ${
              statusMessage.type === "success"
                ? "border border-emerald-500/30 bg-emerald-50/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* 9-Section Extracted Corporate Dossier Preview */}
        {extractedData && (
          <div className="mt-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden text-card-foreground">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <span className="text-sm font-semibold">
                  {extractedData.profile.legal_name || "Corporate Intelligence Dossier"}
                </span>
                {extractedData.highlights.company_status && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                    {extractedData.highlights.company_status}
                  </Badge>
                )}
                {extractedData.highlights.listing_status && (
                  <Badge variant="secondary" className="text-[10px]">
                    {extractedData.highlights.listing_status}
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDossier(!showDossier)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showDossier ? (
                  <>
                    <span>Hide Details</span>
                    <ChevronUp className="size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Show Dossier Sections</span>
                    <ChevronDown className="size-3.5" />
                  </>
                )}
              </button>
            </div>

            {showDossier && (
              <div className="p-4 space-y-4">
                {/* Dossier Navigation Tabs */}
                <div className="flex flex-wrap gap-1.5 border-b pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("about")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "about"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Info className="size-3" /> About &amp; Highlights
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("directors")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "directors"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="size-3" /> Directors ({extractedData.associates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("charges")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "charges"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CreditCard className="size-3" /> Open Charges ({extractedData.openCharges.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("structure")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "structure"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Network className="size-3" /> Structure ({extractedData.groupStructure.length} Subs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("financials")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "financials"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <BarChart3 className="size-3" /> Financials ({extractedData.financials.length} periods)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("peers")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "peers"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TrendingUp className="size-3" /> Peer Comparison
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("compliance")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "compliance"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ShieldCheck className="size-3" /> Compliance Checks
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("rpt")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "rpt"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ArrowRightLeft className="size-3" /> RPT ({extractedData.rpt?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDossierTab("gst")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      activeDossierTab === "gst"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ReceiptText className="size-3" /> GST ({extractedData.gstins?.length || 0})
                  </button>
                </div>

                {/* Tab 1: About & Highlights */}
                {activeDossierTab === "about" && (
                  <div className="space-y-4 text-xs">
                    {extractedData.profile.about && (
                      <div className="rounded-lg bg-muted/30 p-3 border leading-relaxed">
                        <span className="font-semibold text-foreground block mb-1">About the Company:</span>
                        <p className="text-muted-foreground">{extractedData.profile.about}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">CIN</span>
                        <span className="font-mono font-semibold">{extractedData.profile.cin || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">PAN</span>
                        <span className="font-mono font-semibold">{extractedData.profile.pan || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Incorporation Date</span>
                        <span className="font-semibold">{extractedData.profile.incorporation_date || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Entity Type</span>
                        <span className="capitalize font-semibold">{extractedData.profile.business_type?.replace(/_/g, " ") || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Paid-up Capital</span>
                        <span className="font-semibold text-primary">{extractedData.highlights.paid_up_capital || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Authorized Capital</span>
                        <span className="font-semibold">{extractedData.highlights.authorized_capital || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Total Sum of Charges</span>
                        <span className="font-semibold text-destructive">{extractedData.highlights.sum_of_charges || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Active Compliance</span>
                        <span className="font-semibold text-emerald-600">{extractedData.highlights.active_compliance || "-"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">Registered Office Address</span>
                        <p className="text-xs">{extractedData.profile.registered_office_address || "-"}</p>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block mb-0.5">Business / Corporate Office</span>
                        <p className="text-xs">{extractedData.profile.corporate_office_address || "-"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Directors */}
                {activeDossierTab === "directors" && (
                  <div className="space-y-2">
                    <div className="max-h-60 overflow-y-auto rounded-lg border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b">
                          <tr>
                            <th className="p-2">Name</th>
                            <th className="p-2">Designation</th>
                            <th className="p-2">DIN</th>
                            <th className="p-2">Appointed</th>
                            <th className="p-2">Holding %</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {extractedData.associates.map((dir, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2 font-medium">{dir.full_name}</td>
                              <td className="p-2 text-muted-foreground">{dir.designation || dir.associate_role}</td>
                              <td className="p-2 font-mono text-[11px]">{dir.din || "-"}</td>
                              <td className="p-2 text-[11px]">{dir.appointment_date || "-"}</td>
                              <td className="p-2 font-medium">{dir.shareholding_percent ? `${dir.shareholding_percent}%` : "-"}</td>
                              <td className="p-2">
                                {dir.is_active ? (
                                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Active</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">Ceased {dir.cessation_date}</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 3: Open Charges & Lenders */}
                {activeDossierTab === "charges" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span>Total Identified Open Charges: <strong className="text-foreground">{extractedData.openCharges.length}</strong></span>
                        <span>Total Sum: <strong className="text-primary">{extractedData.highlights.sum_of_charges || "-"}</strong></span>
                      </div>
                      <div className="relative sm:w-64">
                        <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <Input
                          placeholder="Search lender, charge ID, property..."
                          value={chargesSearch}
                          onChange={(e) => setChargesSearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-lg border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/60 text-[11px] text-muted-foreground border-b sticky top-0 bg-background z-10">
                          <tr>
                            <th className="p-2">Holder / Lender</th>
                            <th className="p-2">Amount (₹ Cr)</th>
                            <th className="p-2">Charge ID</th>
                            <th className="p-2">Creation Date</th>
                            <th className="p-2">Property / Security</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredCharges.map((charge, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2 font-medium">{charge.holder_name}</td>
                              <td className="p-2 font-mono font-semibold text-primary">₹{charge.amount_crore.toFixed(2)}</td>
                              <td className="p-2 font-mono text-[11px]">{charge.charge_id}</td>
                              <td className="p-2 text-[11px]">{charge.date}</td>
                              <td className="p-2 text-[11px] text-muted-foreground max-w-xs truncate" title={charge.property_type}>
                                {charge.property_type}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex justify-between">
                      <span>Showing {filteredCharges.length} of {extractedData.openCharges.length} open charges</span>
                    </div>
                  </div>
                )}

                {/* Tab 4: Structure & Subsidiaries */}
                {activeDossierTab === "structure" && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Promoter Holding</span>
                        <span className="font-semibold text-emerald-600">{extractedData.structure.promoter_percent ? `${extractedData.structure.promoter_percent}%` : "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Public Holding</span>
                        <span className="font-semibold">{extractedData.structure.public_percent ? `${extractedData.structure.public_percent}%` : "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Total Shareholders</span>
                        <span className="font-semibold">{extractedData.structure.total_shareholders?.toLocaleString() || "-"}</span>
                      </div>
                      <div className="rounded-md border p-2.5 bg-background">
                        <span className="text-[10px] text-muted-foreground block">Total Equity Shares</span>
                        <span className="font-semibold">{extractedData.structure.total_equity_shares?.toLocaleString() || "-"}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="font-semibold">Subsidiaries &amp; Associate Entities ({extractedData.groupStructure.length}):</span>
                        <div className="relative sm:w-64">
                          <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                          <Input
                            placeholder="Search entity, CIN, city..."
                            value={structureSearch}
                            onChange={(e) => setStructureSearch(e.target.value)}
                            className="h-8 pl-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-lg border">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/60 text-[11px] text-muted-foreground border-b sticky top-0 bg-background z-10">
                            <tr>
                              <th className="p-2">Entity Name</th>
                              <th className="p-2">Type</th>
                              <th className="p-2">CIN</th>
                              <th className="p-2">Holding %</th>
                              <th className="p-2">City</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {filteredStructure.map((ent, idx) => (
                              <tr key={idx} className="hover:bg-muted/20">
                                <td className="p-2 font-medium">{ent.entity_name}</td>
                                <td className="p-2 capitalize text-muted-foreground">{ent.relationship_type.replace(/_/g, " ")}</td>
                                <td className="p-2 font-mono text-[11px]">{ent.cin_or_registration || "-"}</td>
                                <td className="p-2 font-medium">{ent.percentage_holding ? `${ent.percentage_holding}%` : "-"}</td>
                                <td className="p-2 text-muted-foreground">{ent.city || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Showing {filteredStructure.length} of {extractedData.groupStructure.length} entities
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 5: Financial Data */}
                {activeDossierTab === "financials" && (
                  <div className="space-y-3 text-xs">
                    <div className="max-h-64 overflow-y-auto rounded-lg border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b">
                          <tr>
                            <th className="p-2">Type</th>
                            <th className="p-2">FY Ending</th>
                            <th className="p-2">Net Revenue (₹ Cr)</th>
                            <th className="p-2">EBITDA (₹ Cr)</th>
                            <th className="p-2">PAT (₹ Cr)</th>
                            <th className="p-2">EBITDA Margin</th>
                            <th className="p-2">Debt/Equity</th>
                            <th className="p-2">Current Ratio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {extractedData.financials.map((fin, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2 font-medium capitalize">{fin.statementType}</td>
                              <td className="p-2 font-mono">{fin.financialYearEnding}</td>
                              <td className="p-2 font-mono">{fin.fields.net_revenue !== null ? `₹${fin.fields.net_revenue?.toFixed(2)}` : "-"}</td>
                              <td className="p-2 font-mono font-medium text-emerald-600">{fin.fields.ebitda !== null ? `₹${fin.fields.ebitda?.toFixed(2)}` : "-"}</td>
                              <td className="p-2 font-mono">{fin.fields.profit_after_tax !== null ? `₹${fin.fields.profit_after_tax?.toFixed(2)}` : "-"}</td>
                              <td className="p-2 font-mono">{fin.fields.ebitda_margin_percent !== null ? `${fin.fields.ebitda_margin_percent}%` : "-"}</td>
                              <td className="p-2 font-mono">{fin.fields.debt_to_equity !== null ? `${fin.fields.debt_to_equity}x` : "-"}</td>
                              <td className="p-2 font-mono">{fin.fields.current_ratio !== null ? `${fin.fields.current_ratio}x` : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 6: Peer Comparison */}
                {activeDossierTab === "peers" && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded-md border p-2.5 bg-muted/20 flex items-center justify-between">
                      <span>Industry: <strong>{extractedData.peerComparison.industry || "Power / Renewable"}</strong></span>
                      <span>Segment: <strong>{extractedData.peerComparison.segment || "EPC, BoP and BTG"}</strong></span>
                    </div>
                    <div>
                      <span className="font-semibold block mb-1.5">5 Closest Peers by Revenue:</span>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/50 text-[11px] text-muted-foreground border-b">
                            <tr>
                              <th className="p-2">Rank</th>
                              <th className="p-2">Company Name</th>
                              <th className="p-2">City</th>
                              <th className="p-2">Revenue (₹ Crore)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {extractedData.peerComparison.closest_peers.map((peer, idx) => {
                              const isSelf = peer.name.toUpperCase().includes(extractedData.profile.legal_name?.toUpperCase() || "ORIANA");
                              return (
                                <tr key={idx} className={isSelf ? "bg-primary/10 font-semibold" : "hover:bg-muted/20"}>
                                  <td className="p-2">{idx + 1}</td>
                                  <td className="p-2 flex items-center gap-1.5">
                                    {peer.name}
                                    {isSelf && <Badge variant="default" className="text-[9px] py-0">Subject</Badge>}
                                  </td>
                                  <td className="p-2 text-muted-foreground">{peer.city}</td>
                                  <td className="p-2 font-mono font-semibold">₹{peer.revenue_crore.toFixed(2)} Cr</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 7: Compliance Checks */}
                {activeDossierTab === "compliance" && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-md border p-3 bg-background">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold mb-1">
                          <ShieldCheck className="size-4" /> ROC Sec 248(5) Removal Check
                        </div>
                        <p className="text-muted-foreground">{extractedData.complianceChecks.roc_name_removal || "Never removed under section 248(5) by ROC."}</p>
                      </div>
                      <div className="rounded-md border p-3 bg-background">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold mb-1">
                          <ShieldCheck className="size-4" /> BIFR History
                        </div>
                        <p className="text-muted-foreground">{extractedData.complianceChecks.bifr_history || "No BIFR cases on record."}</p>
                      </div>
                      <div className="rounded-md border p-3 bg-background">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold mb-1">
                          <ShieldCheck className="size-4" /> Corporate Debt Restructuring (CDR)
                        </div>
                        <p className="text-muted-foreground">{extractedData.complianceChecks.cdr_history || "No CDR history found."}</p>
                      </div>
                      <div className="rounded-md border p-3 bg-background">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold mb-1">
                          <ShieldCheck className="size-4" /> Suit Filed Cases (Bureaus)
                        </div>
                        <p className="text-muted-foreground">{extractedData.complianceChecks.suit_filed_cases || "No suit filed cases reported."}</p>
                      </div>
                    </div>

                    {extractedData.complianceChecks.epfo_establishments.length > 0 && (
                      <div className="rounded-md border p-3 bg-background">
                        <span className="font-semibold block mb-1">EPFO Registrations:</span>
                        {extractedData.complianceChecks.epfo_establishments.map((ep, i) => (
                          <div key={i} className="text-muted-foreground flex gap-3">
                            <span className="font-mono text-foreground font-medium">{ep.id}</span>
                            <span>{ep.name}</span>
                            <span>({ep.city})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 8: Related Party Transactions (RPT) */}
                {activeDossierTab === "rpt" && (
                  <div className="space-y-3 text-xs">
                    {extractedData.rpt && extractedData.rpt.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 border">
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Disclosed Transactions</span>
                            <span className="font-bold text-sm text-foreground">{extractedData.rpt.length} Records</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Material Transactions</span>
                            <span className="font-bold text-sm text-amber-600">
                              {extractedData.rpt.filter((r) => r.isMaterial).length} Flagged
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Cumulative Disclosed Value</span>
                            <span className="font-bold text-sm text-primary">
                              ₹{(
                                extractedData.rpt.reduce((sum, r) => sum + (r.amountCrore || 0), 0)
                              ).toFixed(2)} Cr
                            </span>
                          </div>
                        </div>

                        {/* Search & Material Filter */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="relative sm:w-72">
                            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                            <Input
                              placeholder="Search party name, type, relation..."
                              value={rptSearch}
                              onChange={(e) => setRptSearch(e.target.value)}
                              className="h-8 pl-8 text-xs"
                            />
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rptMaterialOnly}
                              onChange={(e) => setRptMaterialOnly(e.target.checked)}
                              className="size-3.5 rounded"
                            />
                            <span>Show Material Transactions Only</span>
                          </label>
                        </div>

                        <div className="overflow-x-auto rounded-lg border max-h-80">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/60 sticky top-0 border-b z-10 bg-background">
                              <tr>
                                <th className="p-2 text-left font-medium">Party Name &amp; Relationship</th>
                                <th className="p-2 text-left font-medium">Category</th>
                                <th className="p-2 text-left font-medium">Type</th>
                                <th className="p-2 text-left font-medium">FY</th>
                                <th className="p-2 text-right font-medium">Amount</th>
                                <th className="p-2 text-left font-medium">Terms / Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {filteredRpt.map((item, idx) => (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="p-2 font-medium">
                                    <div className="flex items-center gap-1.5">
                                      <span>{item.partyName}</span>
                                      {item.isMaterial && (
                                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">
                                          Material
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={item.relationship}>
                                      {item.relationship}
                                    </div>
                                  </td>
                                  <td className="p-2 capitalize text-muted-foreground">{item.category}</td>
                                  <td className="p-2">
                                    <Badge variant="outline" className="text-[10px] font-normal">
                                      {item.transactionType}
                                    </Badge>
                                  </td>
                                  <td className="p-2 text-muted-foreground font-mono">{item.financialYear || "FY 2024-25"}</td>
                                  <td className="p-2 text-right font-mono font-semibold text-primary whitespace-nowrap">
                                    {item.amountCrore !== null
                                      ? `₹${item.amountCrore.toFixed(2)} Cr`
                                      : item.amountInr
                                      ? `₹${item.amountInr.toLocaleString("en-IN")}`
                                      : "Undisclosed"}
                                  </td>
                                  <td className="p-2 text-muted-foreground text-[11px] max-w-[220px] truncate" title={`${item.transactionType} (${item.relationship})`}>
                                    {item.amountCrore !== null ? `₹${item.amountCrore.toFixed(2)} Cr (${item.transactionType})` : item.transactionType}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Showing {filteredRpt.length} of {extractedData.rpt.length} records
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground italic">No Related Party Transactions reported in the document.</p>
                    )}
                  </div>
                )}

                {/* Tab 9: GST Intelligence & Complete Annexure Filings */}
                {activeDossierTab === "gst" && (
                  <div className="space-y-4 text-xs">
                    {extractedData.gstins && extractedData.gstins.length > 0 ? (
                      <>
                        {/* Pan-India KPI Overview Ribbon */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-lg bg-muted/40 border">
                          <div className="p-2 rounded bg-background border">
                            <span className="text-muted-foreground block text-[10px]">Registered GSTINs</span>
                            <span className="font-bold text-sm text-foreground mt-0.5 block font-mono">
                              {totalGstins} Registrations
                            </span>
                          </div>
                          <div className="p-2 rounded bg-background border">
                            <span className="text-muted-foreground block text-[10px]">Active vs Inactive</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1 py-0">
                                {activeGstinsCount} Active
                              </Badge>
                              {inactiveGstinsCount > 0 && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1 py-0">
                                  {inactiveGstinsCount} Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="p-2 rounded bg-background border">
                            <span className="text-muted-foreground block text-[10px]">Annexure Filings</span>
                            <span className="font-bold text-sm text-foreground mt-0.5 block">
                              {totalFilingsCount} Returns
                            </span>
                          </div>
                          <div className="p-2 rounded bg-background border">
                            <span className="text-muted-foreground block text-[10px]">Filing Timeliness</span>
                            <span className="font-bold text-sm text-emerald-600 flex items-center gap-1 mt-0.5">
                              <ShieldCheck className="size-3.5" /> {complianceRate}%
                            </span>
                          </div>
                          <div className="p-2 rounded bg-background border">
                            <span className="text-muted-foreground block text-[10px]">States / UTs</span>
                            <span className="font-bold text-sm text-foreground flex items-center gap-1 mt-0.5">
                              <Globe className="size-3.5 text-primary" /> {statesCovered} Jurisdictions
                            </span>
                          </div>
                        </div>

                        {/* View Sub-Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
                            <button
                              type="button"
                              onClick={() => setGstViewMode("both")}
                              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                                gstViewMode === "both"
                                  ? "bg-background text-foreground shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              All-in-One Overview
                            </button>
                            <button
                              type="button"
                              onClick={() => setGstViewMode("directory")}
                              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                                gstViewMode === "directory"
                                  ? "bg-background text-foreground shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              GSTIN Directory ({totalGstins})
                            </button>
                            <button
                              type="button"
                              onClick={() => setGstViewMode("annexure")}
                              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                                gstViewMode === "annexure"
                                  ? "bg-background text-foreground shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Annexure Filings ({totalFilingsCount})
                            </button>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={exportFilingsCsv}
                            disabled={filteredFilings.length === 0}
                            className="h-7 text-xs gap-1.5"
                          >
                            <Download className="size-3.5" /> Download Filings CSV
                          </Button>
                        </div>

                        {/* SECTION A: GSTIN MASTER DIRECTORY */}
                        {(gstViewMode === "both" || gstViewMode === "directory") && (
                          <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="font-semibold flex items-center gap-1.5">
                                <Building2 className="size-3.5 text-primary" /> Registered GSTINs Directory ({totalGstins})
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="relative sm:w-56">
                                  <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                                  <Input
                                    placeholder="Search GSTIN, state..."
                                    value={gstSearch}
                                    onChange={(e) => setGstSearch(e.target.value)}
                                    className="h-7 pl-8 text-xs"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant={gstDirectoryFilter === "all" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setGstDirectoryFilter("all")}
                                    className="text-[11px] h-6 px-2"
                                  >
                                    All
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={gstDirectoryFilter === "active" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setGstDirectoryFilter("active")}
                                    className="text-[11px] h-6 px-2"
                                  >
                                    Active ({activeGstinsCount})
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={gstDirectoryFilter === "inactive" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setGstDirectoryFilter("inactive")}
                                    className="text-[11px] h-6 px-2"
                                  >
                                    Inactive ({inactiveGstinsCount})
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="overflow-x-auto rounded-lg border max-h-64">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/60 sticky top-0 border-b z-10 bg-background">
                                  <tr>
                                    <th className="p-2 text-left font-medium">GSTIN &amp; State</th>
                                    <th className="p-2 text-left font-medium">Status</th>
                                    <th className="p-2 text-left font-medium">Registration Date</th>
                                    <th className="p-2 text-left font-medium">Jurisdictions</th>
                                    <th className="p-2 text-center font-medium">Filings</th>
                                    <th className="p-2 text-right font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {filteredGstins.map((g) => {
                                    const isAct = g.status?.toLowerCase() === "active";
                                    return (
                                      <tr key={g.gstin} className="hover:bg-muted/20">
                                        <td className="p-2 font-mono">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-foreground">{g.gstin}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleCopyGstin(g.gstin)}
                                              className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                              title="Copy GSTIN"
                                            >
                                              {copiedGstin === g.gstin ? (
                                                <Check className="size-3 text-emerald-600" />
                                              ) : (
                                                <Copy className="size-3" />
                                              )}
                                            </button>
                                          </div>
                                          <span className="text-[10px] text-muted-foreground font-sans block">{g.state || "—"}</span>
                                        </td>
                                        <td className="p-2">
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] ${
                                              isAct
                                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                                : "text-amber-700 border-amber-500/20"
                                            }`}
                                          >
                                            {g.status || "Active"}
                                          </Badge>
                                        </td>
                                        <td className="p-2 text-muted-foreground text-[11px] whitespace-nowrap">
                                          {g.dateOfRegistration || "—"}
                                        </td>
                                        <td className="p-2 text-muted-foreground text-[10px] max-w-[200px] truncate">
                                          {g.stateJurisdiction || g.centreJurisdiction || "—"}
                                        </td>
                                        <td className="p-2 text-center">
                                          <Badge variant="secondary" className="font-mono text-[10px]">
                                            {g.filings?.length || 0}
                                          </Badge>
                                        </td>
                                        <td className="p-2 text-right whitespace-nowrap">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setGstSelectedGstin(g.gstin);
                                              setGstViewMode("annexure");
                                              setGstPage(1);
                                            }}
                                            className="h-6 text-xs px-1.5 text-primary hover:text-primary gap-0.5"
                                          >
                                            View Filings <ChevronRight className="size-3" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* SECTION B: COMPLETE ANNEXURE FILINGS LEDGER */}
                        {(gstViewMode === "both" || gstViewMode === "annexure") && (
                          <div className="space-y-3 pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t pt-3">
                              <span className="font-semibold flex items-center gap-1.5">
                                <ReceiptText className="size-3.5 text-primary" /> Annexure Filings Ledger ({totalFilingsCount} Returns)
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-[11px]">Rows per page:</span>
                                <Select
                                  value={String(gstPageSize)}
                                  onValueChange={(v) => {
                                    setGstPageSize(v === "all" ? "all" : Number(v));
                                    setGstPage(1);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="text-xs">
                                    <SelectItem value="25">25 rows</SelectItem>
                                    <SelectItem value="50">50 rows</SelectItem>
                                    <SelectItem value="100">100 rows</SelectItem>
                                    <SelectItem value="all">All ({filteredFilings.length})</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Filters Bar */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-muted/40 border text-xs">
                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Filter GSTIN</Label>
                                <Select
                                  value={gstSelectedGstin}
                                  onValueChange={(val) => {
                                    setGstSelectedGstin(val || "all");
                                    setGstPage(1);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs bg-background">
                                    <SelectValue placeholder="All GSTINs" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60 text-xs">
                                    <SelectItem value="all">All GSTINs ({allFilings.length})</SelectItem>
                                    {extractedData.gstins.map((g) => (
                                      <SelectItem key={g.gstin} value={g.gstin}>
                                        {g.gstin} ({g.filings?.length || 0})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Return Form</Label>
                                <Select
                                  value={gstSelectedReturnType}
                                  onValueChange={(val) => {
                                    setGstSelectedReturnType(val || "all");
                                    setGstPage(1);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs bg-background">
                                    <SelectValue placeholder="All Forms" />
                                  </SelectTrigger>
                                  <SelectContent className="text-xs">
                                    <SelectItem value="all">All Forms</SelectItem>
                                    <SelectItem value="GSTR1">GSTR-1</SelectItem>
                                    <SelectItem value="GSTR3B">GSTR-3B</SelectItem>
                                    <SelectItem value="GSTR6">GSTR-6</SelectItem>
                                    <SelectItem value="GSTR9">GSTR-9</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Compliance Status</Label>
                                <Select
                                  value={gstSelectedStatus}
                                  onValueChange={(val) => {
                                    setGstSelectedStatus(val || "all");
                                    setGstPage(1);
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs bg-background">
                                    <SelectValue placeholder="All Statuses" />
                                  </SelectTrigger>
                                  <SelectContent className="text-xs">
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="on_time">Filed on Time ({onTimeFilingsCount})</SelectItem>
                                    <SelectItem value="delayed">Filed Late ({lateFilingsCount})</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Search Period / FY</Label>
                                <div className="relative">
                                  <Search className="size-3.5 absolute left-2 top-2 text-muted-foreground" />
                                  <Input
                                    placeholder="e.g. August, 2025-2026..."
                                    value={gstFilingSearch}
                                    onChange={(e) => {
                                      setGstFilingSearch(e.target.value);
                                      setGstPage(1);
                                    }}
                                    className="h-7 pl-7 text-xs bg-background"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Filings Count & Reset */}
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                Showing <strong className="text-foreground">{paginatedFilings.length}</strong> of{" "}
                                <strong className="text-foreground">{filteredFilings.length}</strong> filtered filings
                                (Total {allFilings.length})
                              </span>
                              {gstSelectedGstin !== "all" && (
                                <button
                                  type="button"
                                  onClick={() => setGstSelectedGstin("all")}
                                  className="text-primary hover:underline text-[11px]"
                                >
                                  Clear GSTIN filter
                                </button>
                              )}
                            </div>

                            {/* Filings Table */}
                            {paginatedFilings.length > 0 ? (
                              <div className="overflow-x-auto rounded-lg border max-h-80">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/60 sticky top-0 border-b z-10 bg-background">
                                    <tr>
                                      <th className="p-2 text-left font-medium">GSTIN &amp; State</th>
                                      <th className="p-2 text-left font-medium">Return Form</th>
                                      <th className="p-2 text-left font-medium">Tax Period</th>
                                      <th className="p-2 text-left font-medium">Financial Year</th>
                                      <th className="p-2 text-left font-medium">Due Date</th>
                                      <th className="p-2 text-left font-medium">Filing Date</th>
                                      <th className="p-2 text-left font-medium">Compliance</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {paginatedFilings.map((f, idx) => {
                                      const isTime = f.status.toLowerCase().includes("time");
                                      const isLate = f.status.toLowerCase().includes("after") || f.status.toLowerCase().includes("late");

                                      return (
                                        <tr key={`${f.gstin}-${f.returnType}-${f.financialYear}-${f.taxPeriod}-${idx}`} className="hover:bg-muted/20">
                                          <td className="p-2 font-mono text-[11px]">
                                            <span className="font-semibold text-foreground">{f.gstin}</span>
                                            <span className="block text-[10px] text-muted-foreground font-sans">{f.state}</span>
                                          </td>
                                          <td className="p-2">
                                            <Badge
                                              variant="outline"
                                              className={`text-[9px] font-bold uppercase ${
                                                f.returnType.includes("3B")
                                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                                  : f.returnType.includes("1")
                                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                                  : f.returnType.includes("6")
                                                  ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                                                  : "bg-slate-50 text-slate-700 border-slate-200"
                                              }`}
                                            >
                                              {f.returnType}
                                            </Badge>
                                          </td>
                                          <td className="p-2 font-medium">{f.taxPeriod}</td>
                                          <td className="p-2 text-muted-foreground font-mono">{f.financialYear}</td>
                                          <td className="p-2 text-muted-foreground whitespace-nowrap">{f.dueDate || "—"}</td>
                                          <td className="p-2 font-medium whitespace-nowrap">{f.filingDate || "—"}</td>
                                          <td className="p-2">
                                            <Badge
                                              variant="outline"
                                              className={`text-[9px] gap-1 px-1 py-0 ${
                                                isTime
                                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                  : isLate
                                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                                  : "bg-muted text-muted-foreground"
                                              }`}
                                            >
                                              {isTime && <CheckCircle2 className="size-2.5" />}
                                              {isLate && <AlertTriangle className="size-2.5" />}
                                              {f.status}
                                            </Badge>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                                <p className="text-xs">No returns match the selected filters.</p>
                              </div>
                            )}

                            {/* Pagination Controls */}
                            {gstPageSize !== "all" && totalPages > 1 && (
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-muted-foreground">
                                  Page {gstPage} of {totalPages}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={gstPage <= 1}
                                    onClick={() => setGstPage((p) => Math.max(1, p - 1))}
                                    className="h-6 text-xs px-2 gap-1"
                                  >
                                    <ChevronLeft className="size-3" /> Prev
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={gstPage >= totalPages}
                                    onClick={() => setGstPage((p) => Math.min(totalPages, p + 1))}
                                    className="h-6 text-xs px-2 gap-1"
                                  >
                                    Next <ChevronRight className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground italic">No GST registrations found in the document.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}
