"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { FinancialReportUpload } from "@/app/borrowers/financial-report-upload";
import { DocumentStageSection } from "@/app/borrowers/document-stage-section";
import type {
  ExtractedCorporateData,
  ExtractedGstin,
} from "@/app/borrowers/corporate-types";
import { GST_STATE_MAP } from "@/app/borrowers/gst-constants";
import { getLatestCorporateReport } from "@/app/borrowers/corporate-ingest-actions";
import {
  addGstRecord,
  deleteGstRecord,
  getGstRecords,
  type GstRecordRow,
} from "@/app/borrowers/gst-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  ReceiptText,
  FileText,
  TrendingUp,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Globe,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  ExternalLink,
  Layers,
} from "lucide-react";
import type { BorrowerType } from "@/app/borrowers/document-categories";

interface FinancialsGstStepProps {
  borrowerId: string;
  borrowerType: BorrowerType;
  extractedData?: ExtractedCorporateData | null;
  activeSection?: "all" | "gst_only" | "financials_only";
}

export function FinancialsGstStep({
  borrowerId,
  borrowerType,
  extractedData,
  activeSection = "all",
}: FinancialsGstStepProps) {
  // Local state for extracted corporate data (can be updated dynamically on PDF upload)
  const [corporateData, setCorporateData] = useState<ExtractedCorporateData | null>(
    extractedData ?? null,
  );

  useEffect(() => {
    if (extractedData) {
      setCorporateData(extractedData);
    }
  }, [extractedData]);

  // Auto-fetch latest corporate report if not already provided in state
  useEffect(() => {
    if (!corporateData && borrowerId && borrowerType === "corporate") {
      getLatestCorporateReport(borrowerId).then((report) => {
        if (report) {
          setCorporateData(report);
        }
      });
    }
  }, [borrowerId, borrowerType, corporateData]);

  // Database manual GST records
  const [gstRecords, setGstRecords] = useState<GstRecordRow[]>([]);
  const [gstDialogOpen, setGstDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Active view tab for GST section: "both" (All-in-One), "directory", "annexure", or "manual"
  const [activeGstTab, setActiveGstTab] = useState<"both" | "directory" | "annexure" | "manual">("both");

  // Filter state for GSTIN Master Directory
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [directorySearch, setDirectorySearch] = useState("");
  const [copiedGstin, setCopiedGstin] = useState<string | null>(null);

  // Filter state for Annexure Filings Explorer
  const [selectedGstin, setSelectedGstin] = useState<string>("all");
  const [selectedReturnType, setSelectedReturnType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [filingSearch, setFilingSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(50);

  function refreshManual() {
    startTransition(async () => {
      const records = await getGstRecords(borrowerId);
      setGstRecords(records);
    });
  }

  useEffect(() => {
    refreshManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  async function handleAddGst(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addGstRecord(formData);
    setGstDialogOpen(false);
    refreshManual();
  }

  async function handleDeleteGst(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("borrower_id", borrowerId);
    await deleteGstRecord(formData);
    refreshManual();
  }

  function handleCopyGstin(gstin: string) {
    navigator.clipboard.writeText(gstin);
    setCopiedGstin(gstin);
    setTimeout(() => setCopiedGstin(null), 2000);
  }

  // Aggregate stats from extracted corporate GSTINs, or synthesize from database if needed
  const gstins = useMemo(() => {
    if (corporateData?.gstins && corporateData.gstins.length > 0) {
      return corporateData.gstins;
    }
    // Synthesize directory from database gstRecords if corporateData is not loaded yet
    if (gstRecords && gstRecords.length > 0) {
      const map = new Map<string, ExtractedGstin>();
      for (const r of gstRecords) {
        let entry = map.get(r.gstin);
        if (!entry) {
          entry = {
            gstin: r.gstin,
            state: GST_STATE_MAP[r.gstin.substring(0, 2)] || "India",
            status: "Active",
            filings: [],
          };
          map.set(r.gstin, entry);
        }
        if (!entry.filings) entry.filings = [];
        entry.filings.push({
          returnType: r.return_type.toUpperCase().replace(/_/g, "-"),
          financialYear: r.financial_year,
          taxPeriod: r.period_month,
          filingDate: r.filing_date || undefined,
          status: "Filed",
        });
      }
      return Array.from(map.values());
    }
    return [];
  }, [corporateData, gstRecords]);

  const totalGstins = gstins.length;
  const activeGstinsCount = gstins.filter((g) => g.status?.toLowerCase() === "active").length;
  const inactiveGstinsCount = totalGstins - activeGstinsCount;

  // Flatten all historical filings across all GSTINs
  const allFilings = useMemo(() => {
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

    for (const g of gstins) {
      for (const f of g.filings || []) {
        list.push({
          gstin: g.gstin,
          state: g.state,
          ...f,
        });
      }
    }
    return list;
  }, [gstins]);

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
    return new Set(gstins.map((g) => g.state).filter(Boolean)).size;
  }, [gstins]);

  // Filtered GSTIN Directory
  const filteredGstins = useMemo(() => {
    return gstins.filter((g) => {
      const isAct = g.status?.toLowerCase() === "active";
      if (directoryStatusFilter === "active" && !isAct) return false;
      if (directoryStatusFilter === "inactive" && isAct) return false;

      if (directorySearch.trim()) {
        const q = directorySearch.toLowerCase();
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
  }, [gstins, directoryStatusFilter, directorySearch]);

  // Filtered Annexure Filings
  const filteredFilings = useMemo(() => {
    return allFilings.filter((f) => {
      if (selectedGstin !== "all" && f.gstin !== selectedGstin) return false;
      if (selectedReturnType !== "all") {
        const r = f.returnType.toUpperCase();
        if (!r.includes(selectedReturnType.toUpperCase())) return false;
      }
      if (selectedStatus !== "all") {
        const s = f.status.toLowerCase();
        if (selectedStatus === "on_time" && !s.includes("time")) return false;
        if (selectedStatus === "delayed" && !s.includes("after") && !s.includes("late")) return false;
        if (selectedStatus === "pending" && !s.includes("pending")) return false;
      }
      if (filingSearch.trim()) {
        const q = filingSearch.toLowerCase();
        const matchPeriod = f.taxPeriod.toLowerCase().includes(q);
        const matchFy = f.financialYear.toLowerCase().includes(q);
        const matchGstin = f.gstin.toLowerCase().includes(q);
        const matchState = f.state?.toLowerCase().includes(q);
        if (!matchPeriod && !matchFy && !matchGstin && !matchState) return false;
      }
      return true;
    });
  }, [allFilings, selectedGstin, selectedReturnType, selectedStatus, filingSearch]);

  // Paginated filings
  const effectivePageSize = pageSize === "all" ? filteredFilings.length || 1 : pageSize;
  const totalPages = pageSize === "all" ? 1 : Math.ceil(filteredFilings.length / effectivePageSize) || 1;
  const paginatedFilings = useMemo(() => {
    if (pageSize === "all") return filteredFilings;
    const start = (currentPage - 1) * effectivePageSize;
    return filteredFilings.slice(start, start + effectivePageSize);
  }, [filteredFilings, currentPage, pageSize, effectivePageSize]);

  // CSV Export
  function exportFilingsToCsv() {
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
    link.setAttribute("download", `GST_Annexure_Filings_${borrowerId || "export"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Drill down from directory to annexure for a specific GSTIN
  function drilldownGstin(gstin: string) {
    setSelectedGstin(gstin);
    setActiveGstTab("annexure");
    setCurrentPage(1);
  }

  const totalGstTurnover = gstRecords.reduce((sum, r) => sum + Number(r.taxable_turnover || 0), 0);
  const totalGstPaid = gstRecords.reduce((sum, r) => sum + Number(r.total_tax_paid || 0), 0);

  return (
    <div className="space-y-8">
      {/* 1. FINANCIAL REPORT PARSER & EXCEL EXTRACTION */}
      {borrowerType === "corporate" && activeSection !== "gst_only" && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">1. Financial Statements &amp; Report Parsing</h3>
          </div>
          <FinancialReportUpload
            borrowerId={borrowerId}
            onExtracted={(data) => {
              setCorporateData(data);
            }}
          />
        </section>
      )}

      {/* 2. COMPREHENSIVE GST INTELLIGENCE & ANNEXURE FILINGS */}
      {borrowerType === "corporate" && activeSection !== "financials_only" && (
        <section className="space-y-4">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ReceiptText className="size-4 text-primary" /> 2. GST Intelligence &amp; Annexure Returns
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Multi-state GST registrations, Active/Inactive directories, and full historical Annexure filings
                  </CardDescription>
                </div>

                {/* Sub-Tabs Selector */}
                <div className="flex items-center gap-1 bg-muted/70 p-1 rounded-lg border text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveGstTab("both")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      activeGstTab === "both"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All-in-One Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGstTab("directory")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      activeGstTab === "directory"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    GSTIN Directory {totalGstins > 0 && `(${totalGstins})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGstTab("annexure")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      activeGstTab === "annexure"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Annexure Filings {totalFilingsCount > 0 && `(${totalFilingsCount})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGstTab("manual")}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      activeGstTab === "manual"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Manual Turnover {gstRecords.length > 0 && `(${gstRecords.length})`}
                  </button>
                </div>
              </div>

              {/* Pan-India KPI Overview Ribbon */}
              {totalGstins > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 mt-3 border-t text-xs">
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[11px]">Registered GSTINs</span>
                    <span className="font-bold text-base text-foreground mt-0.5 block font-mono">
                      {totalGstins} States/Registrations
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[11px]">Active vs Inactive</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 font-semibold">
                        {activeGstinsCount} Active
                      </Badge>
                      {inactiveGstinsCount > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-semibold">
                          {inactiveGstinsCount} Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[11px]">Annexure Filings Logged</span>
                    <span className="font-bold text-base text-foreground mt-0.5 block">
                      {totalFilingsCount} Returns
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[11px]">Filing Timeliness Score</span>
                    <span className="font-bold text-base text-emerald-600 flex items-center gap-1 mt-0.5">
                      <ShieldCheck className="size-4" /> {complianceRate}%
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({onTimeFilingsCount} on-time)
                      </span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border">
                    <span className="text-muted-foreground block text-[11px]">State / UT Footprint</span>
                    <span className="font-bold text-base text-foreground flex items-center gap-1 mt-0.5">
                      <Globe className="size-4 text-primary" /> {statesCovered} Jurisdictions
                    </span>
                  </div>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-6">
              {/* SECTION A: GSTIN MASTER DIRECTORY (Shown if activeGstTab is "both" or "directory") */}
              {(activeGstTab === "both" || activeGstTab === "directory") && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-primary" /> Pan-India Registered GSTINs Directory ({totalGstins})
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        All state tax registrations with jurisdictional commissionerates, taxpayer types, and registration dates
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-60">
                        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search GSTIN, state, jurisdiction..."
                          value={directorySearch}
                          onChange={(e) => setDirectorySearch(e.target.value)}
                          className="text-xs pl-8 h-8"
                        />
                      </div>
                      {directorySearch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDirectorySearch("")}
                          className="h-8 px-2 text-xs"
                        >
                          <X className="size-3" />
                        </Button>
                      )}

                      <div className="flex items-center gap-1">
                        <Button
                          variant={directoryStatusFilter === "all" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDirectoryStatusFilter("all")}
                          className="text-xs h-7 px-2"
                        >
                          All ({totalGstins})
                        </Button>
                        <Button
                          variant={directoryStatusFilter === "active" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDirectoryStatusFilter("active")}
                          className="text-xs h-7 px-2"
                        >
                          Active ({activeGstinsCount})
                        </Button>
                        <Button
                          variant={directoryStatusFilter === "inactive" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDirectoryStatusFilter("inactive")}
                          className="text-xs h-7 px-2"
                        >
                          Inactive ({inactiveGstinsCount})
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* GSTIN Directory Table */}
                  {filteredGstins.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border max-h-[380px]">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0 border-b shadow-2xs z-10">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">GSTIN &amp; State</th>
                            <th className="px-3 py-2 text-left font-semibold">Status</th>
                            <th className="px-3 py-2 text-left font-semibold">Registration Date</th>
                            <th className="px-3 py-2 text-left font-semibold">Taxpayer Type</th>
                            <th className="px-3 py-2 text-left font-semibold">Jurisdictions</th>
                            <th className="px-3 py-2 text-left font-semibold">Business Activities</th>
                            <th className="px-3 py-2 text-center font-semibold">Returns</th>
                            <th className="px-3 py-2 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredGstins.map((g) => {
                            const isAct = g.status?.toLowerCase() === "active";
                            const isSusp = g.status?.toLowerCase().includes("susp");
                            const isCanc = g.status?.toLowerCase().includes("canc");
                            const filingsCount = g.filings?.length || 0;

                            return (
                              <tr key={g.gstin} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-foreground text-[11px]">
                                      {g.gstin}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyGstin(g.gstin)}
                                      className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                                      title="Copy GSTIN"
                                    >
                                      {copiedGstin === g.gstin ? (
                                        <Check className="size-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="size-3" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="text-[11px] font-medium text-muted-foreground mt-0.5">
                                    {g.state || "State Not Specified"}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-semibold uppercase px-1.5 py-0 ${
                                      isAct
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : isSusp
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : isCanc
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {g.status || "Active"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                  {g.dateOfRegistration || "—"}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {g.taxpayerType || "Regular"}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[220px]">
                                  {g.centreJurisdiction && (
                                    <div className="truncate text-[10px]">
                                      <span className="font-medium text-foreground/80">Centre:</span>{" "}
                                      {g.centreJurisdiction}
                                    </div>
                                  )}
                                  {g.stateJurisdiction && (
                                    <div className="truncate text-[10px] text-muted-foreground/80">
                                      <span className="font-medium text-foreground/80">State:</span>{" "}
                                      {g.stateJurisdiction}
                                    </div>
                                  )}
                                  {!g.centreJurisdiction && !g.stateJurisdiction && "—"}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate" title={g.natureOfBusiness}>
                                  {g.natureOfBusiness || "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Badge variant="secondary" className="font-mono text-[10px]">
                                    {filingsCount}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => drilldownGstin(g.gstin)}
                                    className="h-7 text-xs px-2 text-primary hover:text-primary gap-1"
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
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                      <ReceiptText className="size-6 mx-auto text-muted-foreground/50 mb-1" />
                      <p className="text-xs font-medium">No GST registrations match the criteria.</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Upload a corporate financial report PDF above to automatically parse all Active and Inactive GSTINs.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION B: ANNEXURE - GST FILINGS & COMPLIANCE RECONCILIATION (Shown if activeGstTab is "both" or "annexure") */}
              {(activeGstTab === "both" || activeGstTab === "annexure") && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t pt-4">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <ReceiptText className="size-3.5 text-primary" /> Annexure - GST Returns &amp; Compliance Ledger ({totalFilingsCount})
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Historical return filings across all registrations with statutory due dates and filing timeliness
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={exportFilingsToCsv}
                        disabled={filteredFilings.length === 0}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Download className="size-3.5" /> Export Filings CSV
                      </Button>
                    </div>
                  </div>

                  {/* Filters Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-muted/40 border text-xs">
                    {/* GSTIN Selector */}
                    <div>
                      <Label htmlFor="gstin_filter" className="text-[11px] text-muted-foreground mb-1 block">
                        Filter by GSTIN ({gstins.length} Registered)
                      </Label>
                      <Select value={selectedGstin} onValueChange={(val) => { setSelectedGstin(val || "all"); setCurrentPage(1); }}>
                        <SelectTrigger id="gstin_filter" className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All GSTINs" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64 text-xs">
                          <SelectItem value="all">All GSTINs ({allFilings.length} Filings)</SelectItem>
                          {gstins.map((g) => (
                            <SelectItem key={g.gstin} value={g.gstin}>
                              {g.gstin} &ndash; {g.state || "India"} ({g.filings?.length || 0})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Return Type Selector */}
                    <div>
                      <Label htmlFor="return_filter" className="text-[11px] text-muted-foreground mb-1 block">
                        Return Form
                      </Label>
                      <Select value={selectedReturnType} onValueChange={(val) => { setSelectedReturnType(val || "all"); setCurrentPage(1); }}>
                        <SelectTrigger id="return_filter" className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Return Forms" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="all">All Forms (GSTR-1, 3B, 6, 9)</SelectItem>
                          <SelectItem value="GSTR1">GSTR-1 (Outward Supplies)</SelectItem>
                          <SelectItem value="GSTR3B">GSTR-3B (Monthly Summary)</SelectItem>
                          <SelectItem value="GSTR6">GSTR-6 (Input Service Dist.)</SelectItem>
                          <SelectItem value="GSTR9">GSTR-9 (Annual Return)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Compliance Status Selector */}
                    <div>
                      <Label htmlFor="status_filter" className="text-[11px] text-muted-foreground mb-1 block">
                        Compliance Status
                      </Label>
                      <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val || "all"); setCurrentPage(1); }}>
                        <SelectTrigger id="status_filter" className="h-8 text-xs bg-background">
                          <SelectValue placeholder="All Filing Statuses" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="all">All Filing Statuses</SelectItem>
                          <SelectItem value="on_time">Filed on Time ({onTimeFilingsCount})</SelectItem>
                          <SelectItem value="delayed">Filed After Due Date ({lateFilingsCount})</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Search by period / FY */}
                    <div>
                      <Label htmlFor="search_period" className="text-[11px] text-muted-foreground mb-1 block">
                        Search Period / FY
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                        <Input
                          id="search_period"
                          placeholder="e.g. August, 2025-2026..."
                          value={filingSearch}
                          onChange={(e) => { setFilingSearch(e.target.value); setCurrentPage(1); }}
                          className="h-8 text-xs pl-8 bg-background"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Showing count indicator */}
                  <div className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{filteredFilings.length}</span> of{" "}
                    <span className="font-semibold text-foreground">{allFilings.length}</span> historical filings
                    {selectedGstin !== "all" && (
                      <span className="ml-1 text-primary font-medium">
                        for {selectedGstin}
                        <button
                          type="button"
                          onClick={() => setSelectedGstin("all")}
                          className="ml-1 text-muted-foreground hover:text-destructive text-[11px] underline"
                        >
                          (show all)
                        </button>
                      </span>
                    )}
                  </div>

                  {/* Filings Table */}
                  {paginatedFilings.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border max-h-[500px]">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0 border-b shadow-2xs z-10">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">GSTIN &amp; State</th>
                            <th className="px-3 py-2 text-left font-semibold">Return Form</th>
                            <th className="px-3 py-2 text-left font-semibold">Tax Period</th>
                            <th className="px-3 py-2 text-left font-semibold">Financial Year</th>
                            <th className="px-3 py-2 text-left font-semibold">Due Date</th>
                            <th className="px-3 py-2 text-left font-semibold">Actual Filing Date</th>
                            <th className="px-3 py-2 text-left font-semibold">Compliance Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {paginatedFilings.map((f, idx) => {
                            const isTime = f.status.toLowerCase().includes("time");
                            const isLate = f.status.toLowerCase().includes("after") || f.status.toLowerCase().includes("late");
                            const isPending = f.status.toLowerCase().includes("pending");

                            return (
                              <tr key={`${f.gstin}-${f.returnType}-${f.financialYear}-${f.taxPeriod}-${idx}`} className="hover:bg-muted/30">
                                <td className="px-3 py-2 font-mono text-[11px]">
                                  <span className="font-semibold text-foreground">{f.gstin}</span>
                                  <span className="block text-[10px] text-muted-foreground font-sans">{f.state}</span>
                                </td>
                                <td className="px-3 py-2">
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
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {f.taxPeriod}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground font-mono">
                                  {f.financialYear}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                  {f.dueDate || "—"}
                                </td>
                                <td className="px-3 py-2 font-medium whitespace-nowrap text-foreground">
                                  {f.filingDate || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-medium gap-1 px-1.5 py-0 ${
                                      isTime
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : isLate
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : isPending
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {isTime && <CheckCircle2 className="size-3" />}
                                    {isLate && <AlertTriangle className="size-3" />}
                                    {isPending && <Clock className="size-3" />}
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
                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                      <p className="text-xs font-medium">No returns match the selected filters.</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Try clearing or relaxing the GSTIN, return form, or status filters.
                      </p>
                    </div>
                  )}

                  {/* Pagination Controls */}
                  {filteredFilings.length > 25 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">Rows per page:</span>
                        <Select
                          value={String(pageSize)}
                          onValueChange={(val) => {
                            if (val === "all") {
                              setPageSize("all");
                            } else {
                              setPageSize(Number(val));
                            }
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-7 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="250">250</SelectItem>
                            <SelectItem value="all">All ({filteredFilings.length})</SelectItem>
                          </SelectContent>
                        </Select>
                        {pageSize !== "all" && (
                          <span className="text-muted-foreground text-[11px]">
                            Page {currentPage} of {totalPages}
                          </span>
                        )}
                      </div>

                      {pageSize !== "all" && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <ChevronLeft className="size-3.5" /> Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            Next <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION C: MANUAL GST FILINGS & REVENUE RECONCILIATION */}
              {activeGstTab === "manual" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Custom GST Turnover &amp; Tax Records
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Record manually verified sales, annual returns, or audited GST turnover figures
                      </p>
                    </div>
                    <Dialog open={gstDialogOpen} onOpenChange={setGstDialogOpen}>
                      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" />}>
                        <Plus className="size-3.5" /> Add Manual Filing
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add GST Return Record</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddGst} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="gstin">GSTIN *</Label>
                              <Input id="gstin" name="gstin" placeholder="27AAACB1234C1Z5" required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="financial_year">Financial Year</Label>
                              <Input id="financial_year" name="financial_year" defaultValue="FY 2024-25" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="return_type">Return Form</Label>
                              <Select name="return_type" defaultValue="gstr_3b">
                                <SelectTrigger id="return_type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gstr_3b">GSTR-3B (Monthly Summary)</SelectItem>
                                  <SelectItem value="gstr_1">GSTR-1 (Outward Supplies)</SelectItem>
                                  <SelectItem value="gstr_9">GSTR-9 (Annual Return)</SelectItem>
                                  <SelectItem value="annual_aggregate">Annual Aggregate</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="period_month">Month / Period *</Label>
                              <Input id="period_month" name="period_month" placeholder="e.g. April 2024 / Q1" required />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="taxable_turnover">Taxable Turnover (₹) *</Label>
                              <Input
                                id="taxable_turnover"
                                name="taxable_turnover"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 1500000"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="total_tax_paid">Total Tax Paid (₹)</Label>
                              <Input
                                id="total_tax_paid"
                                name="total_tax_paid"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 270000"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="filing_date">Filing Date</Label>
                            <Input id="filing_date" name="filing_date" type="date" />
                          </div>
                          <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setGstDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Save GST Filing</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {gstRecords.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border max-h-96">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Period</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-3 py-2 text-left font-medium">GSTIN</th>
                            <th className="px-3 py-2 text-right font-medium">Turnover (₹)</th>
                            <th className="px-3 py-2 text-right font-medium">Tax Paid (₹)</th>
                            <th className="px-3 py-2 text-right font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {gstRecords.map((rec) => (
                            <tr key={rec.id} className="hover:bg-muted/30">
                              <td className="px-3 py-2 font-medium">
                                {rec.period_month}
                                <span className="text-[10px] text-muted-foreground block">{rec.financial_year}</span>
                                {rec.filing_date && (
                                  <span className="text-[10px] text-muted-foreground/75 block">Filed: {rec.filing_date}</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="secondary" className="uppercase text-[9px] font-semibold">
                                  {rec.return_type.replace(/_/g, "-")}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{rec.gstin}</td>
                              <td className="px-3 py-2 text-right font-semibold">
                                ₹{Number(rec.taxable_turnover).toLocaleString("en-IN")}
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {rec.total_tax_paid ? `₹${Number(rec.total_tax_paid).toLocaleString("en-IN")}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGst(rec.id)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                      <p className="text-xs">No manual GST return entries recorded. Click &ldquo;Add Manual Filing&rdquo; if needed.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 3. FINANCIAL DOCUMENTS UPLOAD */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {borrowerType === "corporate" ? "3. Financial Documents &amp; Statements" : "Financial Documents"}
          </h3>
        </div>
        <DocumentStageSection
          borrowerId={borrowerId}
          borrowerType={borrowerType}
          stage="financial"
          title="Financial Documents &amp; Audit Reports"
        />
      </section>
    </div>
  );
}
