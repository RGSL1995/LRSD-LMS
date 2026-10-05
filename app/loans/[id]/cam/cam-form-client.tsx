"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  saveCamManualData,
  generateCamDocument,
  refreshCamSecurityPrices,
  saveCamSecurities,
} from "./cam-actions";
import {
  saveCamApprovers,
  sendCamApprovalEmailAction,
  sendAllCamApprovalEmailsAction,
  deleteCamApproverAction,
} from "./cam-approval-actions";
import {
  type CamAutoData,
  type CamManualData,
  type CamPartyManualData,
  type CamBankingRow,
  type CamCreditFacilityRow,
  type CamItrRow,
  type CamApproverItem,
  emptyCamPartyData,
} from "./cam-types";
import {
  fetchLiveStockPrice,
  lookupSecurityDetails,
  searchSecuritiesAction,
  type LiveStockPriceResult,
} from "@/app/loans/market-actions";
import { type SecurityRecord } from "@/lib/securities-directory";
import { AddSecurityDialog } from "@/app/loans/new/add-security-dialog";
import { type LASSecurityItem, type SecurityProviderOption, formatIndianNumber } from "@/app/loans/las-types";
import {
  Loader2,
  Save,
  FileDown,
  Plus,
  Trash2,
  ShieldCheck,
  Users,
  Landmark,
  Search,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Eye,
  TrendingUp,
  Percent,
  Layers,
  Scale,
  Building2,
  RefreshCw,
  Sparkles,
  Zap,
  Check,
  FileCheck,
  ArrowRight,
  Mail,
  Send,
  Copy,
  ExternalLink,
  UserPlus,
  UserCheck,
  XCircle,
  Clock,
} from "lucide-react";

interface CamFormClientProps {
  applicationId: string;
  autoData: CamAutoData;
  initialManualData: CamManualData;
}

type TabType =
  | "overview"
  | "borrower"
  | "collateral"
  | "financials"
  | "bureau"
  | "due_diligence"
  | "risks_signoff"
  | "approvals"
  | "preview";

const QUICK_LOOKUP_CHIPS = [
  { label: "TCS", name: "Tata Consultancy Services Limited", isin: "INE467B01029" },
  { label: "Reliance", name: "Reliance Industries Limited", isin: "INE002A01018" },
  { label: "HDFC Bank", name: "HDFC Bank Limited", isin: "INE040A01034" },
  { label: "Infosys", name: "Infosys Limited", isin: "INE009A01021" },
  { label: "ITC", name: "ITC Limited", isin: "INE154A01025" },
  { label: "SBI", name: "State Bank of India", isin: "INE062A01020" },
];

export function CamFormClient({ applicationId, autoData: initialAutoData, initialManualData }: CamFormClientProps) {
  const [autoData, setAutoData] = useState<CamAutoData>(initialAutoData);
  const [manual, setManual] = useState<CamManualData>(() => {
    const parties = { ...initialManualData.parties };
    for (const p of initialAutoData.parties) {
      if (!parties[p.borrowerId]) parties[p.borrowerId] = emptyCamPartyData(p.borrowerId);
    }
    return { ...initialManualData, parties };
  });

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [activePartyId, setActivePartyId] = useState<string>(autoData.parties[0]?.borrowerId || "");
  const [isSaving, startSaveTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Credit Committee Approvers state
  const [approvers, setApprovers] = useState<CamApproverItem[]>(initialAutoData.approvers || []);
  const [isSavingApprovers, setIsSavingApprovers] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newApproverName, setNewApproverName] = useState("");
  const [newApproverEmail, setNewApproverEmail] = useState("");
  const [newApproverRole, setNewApproverRole] = useState("Credit Committee Member");

  // Add Security Dialog state
  const [isAddSecurityOpen, setIsAddSecurityOpen] = useState(false);
  const [editingSecurity, setEditingSecurity] = useState<LASSecurityItem | null>(null);

  // Live ISIN & CMP Finder Widget State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);
  const [marketSearchResult, setMarketSearchResult] = useState<LiveStockPriceResult | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<SecurityRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const activeParty = autoData.parties.find((p) => p.borrowerId === activePartyId);
  const activePartyData = manual.parties[activePartyId] || emptyCamPartyData(activePartyId);

  const isLAS =
    autoData.facilityType?.toLowerCase().includes("las") ||
    autoData.facilityType?.toLowerCase().includes("share") ||
    autoData.securities.length > 0;

  // Providers list for AddSecurityDialog
  const securityProviders: SecurityProviderOption[] = autoData.parties.map((p, idx) => ({
    id: p.borrowerId,
    name: p.name,
    pan: p.pan,
    isPrimary: idx === 0,
    isGuarantor: idx > 0,
  }));

  function updateParty(borrowerId: string, updater: (p: CamPartyManualData) => CamPartyManualData) {
    setManual((prev) => ({
      ...prev,
      parties: {
        ...prev.parties,
        [borrowerId]: updater(prev.parties[borrowerId] || emptyCamPartyData(borrowerId)),
      },
    }));
  }

  const handleAddApprover = () => {
    if (!newApproverName.trim() || !newApproverEmail.trim()) return;
    const newApp: CamApproverItem = {
      id: crypto.randomUUID(),
      loanApplicationId: applicationId,
      approverName: newApproverName.trim(),
      approverEmail: newApproverEmail.trim().toLowerCase(),
      approverRole: newApproverRole.trim() || "Credit Committee Member",
      approvalStatus: "pending",
      approvalToken: "",
      orderIndex: approvers.length,
    };
    const updated = [...approvers, newApp];
    setApprovers(updated);
    setNewApproverName("");
    setNewApproverEmail("");
    setNewApproverRole("Credit Committee Member");
    handleSaveApproversList(updated);
  };

  const handleSaveApproversList = async (listToSave = approvers) => {
    setIsSavingApprovers(true);
    try {
      const res = await saveCamApprovers(
        applicationId,
        listToSave.map((a) => ({
          id: a.id,
          approverName: a.approverName,
          approverEmail: a.approverEmail,
          approverRole: a.approverRole,
        })),
      );
      if (res.success && res.approvers) {
        setApprovers(res.approvers);
        setAutoData((p) => ({ ...p, approvers: res.approvers }));
        setSaveMessage({ text: "Credit Committee approvers successfully updated!" });
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage({ text: res.error || "Failed to save approvers.", isError: true });
      }
    } finally {
      setIsSavingApprovers(false);
    }
  };

  const handleSendApprovalEmail = async (approverId: string, approverEmail: string) => {
    setSendingEmailId(approverId);
    try {
      const res = await sendCamApprovalEmailAction(applicationId, approverId);
      if (res.success) {
        setSaveMessage({
          text: res.simulated
            ? `Approval request logged for ${approverEmail} (Direct review link ready)`
            : `Approval request email sent to ${approverEmail}!`,
        });
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        setSaveMessage({ text: res.error || "Failed to send approval email.", isError: true });
      }
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSendAllEmails = async () => {
    setSendingEmailId("all");
    try {
      const res = await sendAllCamApprovalEmailsAction(applicationId);
      if (res.success) {
        setSaveMessage({ text: `Approval requests dispatched to ${res.sentCount} committee members!` });
        setTimeout(() => setSaveMessage(null), 5000);
      } else {
        setSaveMessage({ text: res.error || "Failed to send emails.", isError: true });
      }
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleCopyReviewLink = (token: string) => {
    if (!token) return;
    const url = `${window.location.origin}/cam/review/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const handleDeleteApprover = async (approverId: string) => {
    const updated = approvers.filter((a) => a.id !== approverId);
    setApprovers(updated);
    await deleteCamApproverAction(approverId, applicationId);
  };

  const handleApplyPreset = (type: "trio" | "dual") => {
    let preset: CamApproverItem[] = [];
    if (type === "trio") {
      preset = [
        {
          id: crypto.randomUUID(),
          loanApplicationId: applicationId,
          approverName: "Head of Credit Risk",
          approverEmail: "head.credit@lrsd-lms.com",
          approverRole: "Head of Credit",
          approvalStatus: "pending",
          approvalToken: "",
          orderIndex: 0,
        },
        {
          id: crypto.randomUUID(),
          loanApplicationId: applicationId,
          approverName: "Chief Risk Officer",
          approverEmail: "cro@lrsd-lms.com",
          approverRole: "Chief Risk Officer (CRO)",
          approvalStatus: "pending",
          approvalToken: "",
          orderIndex: 1,
        },
        {
          id: crypto.randomUUID(),
          loanApplicationId: applicationId,
          approverName: "Managing Director",
          approverEmail: "md@lrsd-lms.com",
          approverRole: "Managing Director / IC Chair",
          approvalStatus: "pending",
          approvalToken: "",
          orderIndex: 2,
        },
      ];
    } else {
      preset = [
        {
          id: crypto.randomUUID(),
          loanApplicationId: applicationId,
          approverName: "Credit Sanction Manager",
          approverEmail: "credit.manager@lrsd-lms.com",
          approverRole: "Credit Sanction Manager",
          approvalStatus: "pending",
          approvalToken: "",
          orderIndex: 0,
        },
        {
          id: crypto.randomUUID(),
          loanApplicationId: applicationId,
          approverName: "Chief Risk Officer",
          approverEmail: "cro@lrsd-lms.com",
          approverRole: "Chief Risk Officer",
          approvalStatus: "pending",
          approvalToken: "",
          orderIndex: 1,
        },
      ];
    }
    setApprovers(preset);
    handleSaveApproversList(preset);
  };

  const handleSave = () => {
    setSaveMessage(null);
    startSaveTransition(async () => {
      const res = await saveCamManualData(applicationId, manual);
      if (res.success) {
        setSaveMessage({ text: "All CAM sections successfully saved!" });
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage({ text: res.error || "Failed to save CAM data.", isError: true });
      }
    });
  };

  const handleGenerate = () => {
    setGenerateError(null);
    startGenerateTransition(async () => {
      const saveRes = await saveCamManualData(applicationId, manual);
      if (!saveRes.success) {
        setGenerateError(saveRes.error || "Failed to save before generating.");
        return;
      }
      const res = await generateCamDocument(applicationId);
      if (!res.success || !res.url) {
        setGenerateError(res.error || "Failed to generate CAM DOCX.");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  // Refresh live CMPs for all pledged securities in CAM
  const handleRefreshAllPrices = async () => {
    setIsRefreshingPrices(true);
    setSaveMessage(null);
    try {
      const res = await refreshCamSecurityPrices(applicationId);
      if (res.success && res.autoData) {
        setAutoData(res.autoData);
        setSaveMessage({
          text: `Refreshed live market prices for ${res.updatedCount ?? autoData.securities.length} scrip(s) from NSE/BSE.`,
        });
        setTimeout(() => setSaveMessage(null), 4000);
      } else {
        setSaveMessage({ text: res.error || "Failed to refresh market prices.", isError: true });
      }
    } catch {
      setSaveMessage({ text: "Failed to connect to market data service.", isError: true });
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  // Handle saving security from AddSecurityDialog
  const handleSaveSecurity = async (item: LASSecurityItem) => {
    const currentList = autoData.securities.map((s) => ({
      scripName: s.scripName,
      quantity: Number(s.quantityNum || s.quantity.replace(/,/g, "")) || 0,
      cmp: Number(s.priceNum || s.price.replace(/,/g, "")) || 0,
      isin: s.isin,
      pledgorName: s.pledgorName,
      pledgorBorrowerId: s.pledgorBorrowerId,
      securityCover: 2.5,
    }));

    let updatedList;
    if (editingSecurity) {
      updatedList = currentList.map((s) =>
        s.scripName === editingSecurity.security_name ? {
          scripName: item.security_name,
          quantity: item.quantity,
          cmp: item.cmp,
          isin: item.isin,
          pledgorName: item.pledgor_name,
          pledgorBorrowerId: item.pledgor_borrower_id,
          securityCover: item.security_cover || 2.5,
        } : s
      );
    } else {
      updatedList = [
        ...currentList,
        {
          scripName: item.security_name,
          quantity: item.quantity,
          cmp: item.cmp,
          isin: item.isin,
          pledgorName: item.pledgor_name,
          pledgorBorrowerId: item.pledgor_borrower_id,
          securityCover: item.security_cover || 2.5,
        },
      ];
    }

    const res = await saveCamSecurities(applicationId, updatedList);
    if (res.success && res.autoData) {
      setAutoData(res.autoData);
      setIsAddSecurityOpen(false);
      setEditingSecurity(null);
      setSaveMessage({ text: "Collateral schedule updated successfully." });
      setTimeout(() => setSaveMessage(null), 4000);
    } else {
      setSaveMessage({ text: res.error || "Failed to save security.", isError: true });
    }
  };

  // Delete scrip from collateral
  const handleDeleteSecurity = async (scripName: string) => {
    const updatedList = autoData.securities
      .filter((s) => s.scripName !== scripName)
      .map((s) => ({
        scripName: s.scripName,
        quantity: Number(s.quantityNum || s.quantity.replace(/,/g, "")) || 0,
        cmp: Number(s.priceNum || s.price.replace(/,/g, "")) || 0,
        isin: s.isin,
        pledgorName: s.pledgorName,
        pledgorBorrowerId: s.pledgorBorrowerId,
        securityCover: 2.5,
      }));

    const res = await saveCamSecurities(applicationId, updatedList);
    if (res.success && res.autoData) {
      setAutoData(res.autoData);
      setSaveMessage({ text: `Removed ${scripName} from pledged collateral.` });
      setTimeout(() => setSaveMessage(null), 4000);
    } else {
      setSaveMessage({ text: res.error || "Failed to remove security.", isError: true });
    }
  };

  // Perform ISIN and CMP search in the interactive Finder widget
  const handlePerformMarketSearch = async (queryToSearch: string) => {
    if (!queryToSearch.trim()) return;
    setIsSearchingMarket(true);
    setMarketSearchResult(null);
    setShowSuggestions(false);
    try {
      const priceRes = await fetchLiveStockPrice(queryToSearch.trim());
      if (priceRes.success) {
        setMarketSearchResult(priceRes);
      } else {
        const details = await lookupSecurityDetails(queryToSearch.trim());
        if (details.found) {
          setMarketSearchResult({
            success: true,
            companyName: details.companyName,
            symbol: details.symbol,
            isin: details.isin,
            cmp: 0,
            exchange: "NSE",
          });
        } else {
          setMarketSearchResult({
            success: false,
            error: priceRes.error || `No listed security found for "${queryToSearch}".`,
          });
        }
      }
    } catch {
      setMarketSearchResult({ success: false, error: "Market search service timed out." });
    } finally {
      setIsSearchingMarket(false);
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; count?: number }> = [
    { id: "overview", label: "1. Overview & Terms", icon: <Layers className="size-4" /> },
    { id: "borrower", label: "2. Borrower & Promoters", icon: <Building2 className="size-4" /> },
    { id: "collateral", label: "3. Collateral & LTV", icon: <Scale className="size-4" />, count: autoData.securities.length },
    { id: "financials", label: "4. Financials & ITR", icon: <TrendingUp className="size-4" /> },
    { id: "bureau", label: "5. Credit Bureau & Banking", icon: <ShieldCheck className="size-4" />, count: autoData.parties.length },
    { id: "due_diligence", label: "6. Due Diligence & Checks", icon: <Search className="size-4" /> },
    { id: "risks_signoff", label: "7. Risk & Mitigants", icon: <AlertTriangle className="size-4" /> },
    {
      id: "approvals",
      label: "8. Credit Committee Approvals",
      icon: <UserCheck className="size-4" />,
      count: approvers.filter((a) => a.approvalStatus === "approved" || a.approvalStatus === "approved_with_conditions").length,
    },
    { id: "preview", label: "👁️ Live CAM Preview", icon: <Eye className="size-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Key Highlights & Action Buttons */}
      <div className="rounded-xl border bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold tracking-wider bg-white/10 text-white px-2.5 py-1 rounded-md border border-white/20">
                {autoData.applicationCode}
              </span>
              <span className="text-xs bg-indigo-500/20 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-400/30 font-medium">
                {autoData.facilityType}
              </span>
              {isLAS && (
                <span className="text-xs bg-emerald-500/20 text-emerald-200 px-2.5 py-1 rounded-md border border-emerald-400/30 flex items-center gap-1 font-medium">
                  <Zap className="size-3 text-emerald-300" /> Live CMP & ISIN Active
                </span>
              )}
              <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-1 rounded-md border border-white/10">
                Tenor: {autoData.tenureMonths}M
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              {autoData.borrower.name}
            </h2>
            <p className="text-xs text-slate-300 max-w-xl line-clamp-1">
              {autoData.purpose}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2 px-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Sanction Limit</span>
                <span className="font-bold text-white">{autoData.sanctionAmountText}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2 px-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Collateral Cover</span>
                <span
                  className={`font-bold ${
                    autoData.securityCoverRatio >= 2.5
                      ? "text-emerald-400"
                      : autoData.securityCoverRatio > 0
                      ? "text-amber-400"
                      : "text-slate-300"
                  }`}
                >
                  {autoData.securityCoverRatio > 0 ? `${autoData.securityCoverRatio}x` : "—"}{" "}
                  {autoData.ltvPercent > 0 && `(${autoData.ltvPercent}% LTV)`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-9 gap-1.5 text-xs"
              >
                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 gap-1.5 text-xs shadow-sm"
              >
                {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
                Download CAM (.docx)
              </Button>
              <Link href={`/loans/${applicationId}/sanction`}>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white h-9 gap-1.5 text-xs font-semibold shadow-sm"
                >
                  <FileCheck className="size-3.5" />
                  Sanction Letter
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`mt-3 p-2 px-3 rounded text-xs flex items-center gap-2 ${
              saveMessage.isError
                ? "bg-destructive/20 text-destructive-foreground border border-destructive/30"
                : "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
            }`}
          >
            <CheckCircle2 className="size-3.5 shrink-0" />
            {saveMessage.text}
          </div>
        )}

        {generateError && (
          <div className="mt-3 p-2 px-3 rounded text-xs bg-destructive/20 text-destructive-foreground border border-destructive/30 flex items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            {generateError}
          </div>
        )}
      </div>

      {/* Tabs Header Navigation */}
      <div className="flex overflow-x-auto gap-1 border-b pb-2 text-xs no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview & Loan Terms */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              icon={<Landmark className="size-4 text-indigo-500" />}
              title="Requested Sanction"
              value={autoData.sanctionAmountText}
              subtitle={`Tenor: ${autoData.tenureMonths} Months`}
            />
            <MetricCard
              icon={<Scale className="size-4 text-emerald-500" />}
              title="Collateral Value"
              value={autoData.totalSecurityMarketValue}
              subtitle={`${autoData.securities.length} Pledged Scrip(s)`}
            />
            <MetricCard
              icon={<Percent className="size-4 text-blue-500" />}
              title="Security Cover & LTV"
              value={autoData.securityCoverRatio > 0 ? `${autoData.securityCoverRatio}x Cover` : "—"}
              subtitle={autoData.ltvPercent > 0 ? `${autoData.ltvPercent}% LTV (Target: <= 40%)` : "No cover calculated"}
            />
          </div>

          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Facility & Appraisal Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <InfoItem label="Facility Type" value={autoData.facilityType} />
                <InfoItem label="Application Ref" value={autoData.applicationCode} />
                <InfoItem label="Primary Borrower" value={autoData.borrower.name} />
                <InfoItem label="Borrower PAN" value={autoData.borrower.pan || "—"} />
                <InfoItem label="Borrower CIN" value={autoData.borrower.cin || "—"} />
                <InfoItem label="GSTIN" value={autoData.borrower.gstin || "—"} />
                <InfoItem label="Margin Call Threshold" value={autoData.marginCallThreshold} />
                <InfoItem label="Liquidation Threshold" value={autoData.liquidationThreshold} />
                <InfoItem label="Guarantors" value={autoData.guarantorSummaries.join("; ") || "None"} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <InfoItem label="Purpose of Loan" value={autoData.purpose} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Underwriting Justification & Merits
              </CardTitle>
              <CardDescription className="text-xs">
                Key underwriting rationale, strengths, covenants, and repayment capacity (one bullet point per line).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Textarea
                value={manual.underwritingJustification}
                onChange={(e) => setManual((p) => ({ ...p, underwritingJustification: e.target.value }))}
                rows={6}
                className="text-xs font-sans leading-relaxed"
                placeholder={"Enter underwriting justification points (one per line)..."}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Borrower Profile & Promoters */}
      {activeTab === "borrower" && (
        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Borrower Corporate Identity (Auto-Fetched)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <InfoItem label="Legal Name" value={autoData.borrower.name} />
                <InfoItem label="Trade Name" value={autoData.borrower.tradeName || "—"} />
                <InfoItem label="CIN" value={autoData.borrower.cin || "—"} />
                <InfoItem label="PAN" value={autoData.borrower.pan || "—"} />
                <InfoItem label="GSTIN" value={autoData.borrower.gstin || "—"} />
                <InfoItem label="Registered Address" value={autoData.borrower.address || "—"} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                About the Company & Business Background
              </CardTitle>
              <CardDescription className="text-xs">
                Provide an executive overview of the company, operational model, market position, and industry standing.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <Textarea
                value={manual.aboutCompanyText}
                onChange={(e) => setManual((p) => ({ ...p, aboutCompanyText: e.target.value }))}
                rows={6}
                className="text-xs leading-relaxed"
                placeholder="Overview of business operations, group profile, market standing, financial strength, and industry outlook..."
              />
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Key Promoters & Directors Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Background, DIN, qualifications, and experience of the key promoters and directors.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  setManual((p) => ({
                    ...p,
                    promoterProfiles: [...p.promoterProfiles, { name: "", din: "", text: "" }],
                  }))
                }
              >
                <Plus className="size-3" /> Add Promoter
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {manual.promoterProfiles.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
                  No promoter profiles added yet. Click &quot;Add Promoter&quot; to describe key management personnel.
                </div>
              ) : (
                manual.promoterProfiles.map((promoter, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg border bg-muted/20 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        value={promoter.name}
                        onChange={(e) =>
                          setManual((p) => ({
                            ...p,
                            promoterProfiles: p.promoterProfiles.map((x, i) =>
                              i === idx ? { ...x, name: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="Promoter / Director Name"
                        className="h-8 text-xs font-medium"
                      />
                      <Input
                        value={promoter.din}
                        onChange={(e) =>
                          setManual((p) => ({
                            ...p,
                            promoterProfiles: p.promoterProfiles.map((x, i) =>
                              i === idx ? { ...x, din: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="DIN Number"
                        className="h-8 text-xs w-36 font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() =>
                          setManual((p) => ({
                            ...p,
                            promoterProfiles: p.promoterProfiles.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={promoter.text}
                      onChange={(e) =>
                        setManual((p) => ({
                          ...p,
                          promoterProfiles: p.promoterProfiles.map((x, i) =>
                            i === idx ? { ...x, text: e.target.value } : x,
                          ),
                        }))
                      }
                      rows={2}
                      className="text-xs"
                      placeholder="Role, shareholding %, experience, business track record, and past associations..."
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Collateral & Security Cover (with Live ISIN Finder & CMP Tools for LAS) */}
      {activeTab === "collateral" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              icon={<Scale className="size-4 text-indigo-500" />}
              title="Total Collateral Market Value"
              value={autoData.totalSecurityMarketValue}
              subtitle={`${autoData.securities.length} Scrips Pledged`}
            />
            <MetricCard
              icon={<TrendingUp className="size-4 text-emerald-500" />}
              title="Security Coverage Ratio"
              value={autoData.securityCoverRatio > 0 ? `${autoData.securityCoverRatio}x` : "—"}
              subtitle={`Policy Threshold: >= 2.50x (${autoData.securityCoverRatio >= 2.5 ? "Compliant" : "Under Cover"})`}
            />
            <MetricCard
              icon={<Percent className="size-4 text-blue-500" />}
              title="Effective LTV %"
              value={autoData.ltvPercent > 0 ? `${autoData.ltvPercent}%` : "—"}
              subtitle="Max Permitted LTV: 40.0%"
            />
          </div>

          {/* Interactive ISIN & Live CMP Finder Tool (Especially for LAS Loans) */}
          <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-card to-card shadow-xs">
            <CardHeader className="pb-3 border-b border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-200">
                  <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
                  Live ISIN & Real-Time CMP Finder (NSE / BSE)
                </CardTitle>
                <CardDescription className="text-xs">
                  Search any listed equity by Company Name, Stock Ticker, or ISIN code to fetch live market price and official ISIN.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[10px] w-fit">
                2,500+ NSE Equities Directory
              </Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Search Box */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="size-3.5 text-muted-foreground absolute left-3 top-2.5" />
                    <Input
                      value={searchQuery}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        if (val.trim().length >= 2) {
                          const list = await searchSecuritiesAction(val);
                          setSearchSuggestions(list);
                          setShowSuggestions(true);
                        } else {
                          setSearchSuggestions([]);
                          setShowSuggestions(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handlePerformMarketSearch(searchQuery);
                        }
                      }}
                      placeholder="Type Company Name (e.g. Tata Motors), Symbol (e.g. INFY), or ISIN (e.g. INE002A01018)..."
                      className="pl-8 text-xs h-9 bg-card"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePerformMarketSearch(searchQuery)}
                    disabled={isSearchingMarket || !searchQuery.trim()}
                    className="h-9 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isSearchingMarket ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                    Lookup & Price
                  </Button>
                </div>

                {/* Autocomplete Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-10 left-0 right-0 z-30 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y text-xs">
                    {searchSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(item.companyName);
                          setShowSuggestions(false);
                          handlePerformMarketSearch(item.isin || item.companyName);
                        }}
                        className="w-full p-2 text-left hover:bg-muted/50 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold block text-foreground">{item.companyName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {item.symbol} • ISIN: {item.isin}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          NSE
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Search Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold text-muted-foreground mr-1">Quick Scrips:</span>
                {QUICK_LOOKUP_CHIPS.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setSearchQuery(chip.name);
                      handlePerformMarketSearch(chip.isin);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted/60 hover:bg-muted border transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Search Result Box */}
              {marketSearchResult && (
                <div
                  className={`p-3 rounded-lg border text-xs transition-all ${
                    marketSearchResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {marketSearchResult.success ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Check className="size-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-sm text-foreground">
                            {marketSearchResult.companyName}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 font-mono">
                            {marketSearchResult.exchange || "NSE"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                          <span>
                            ISIN: <strong className="text-foreground">{marketSearchResult.isin || "—"}</strong>
                          </span>
                          <span>
                            Ticker: <strong className="text-foreground">{marketSearchResult.symbol || "—"}</strong>
                          </span>
                          {marketSearchResult.previousClose !== undefined && (
                            <span>
                              Prev Close: Rs. {formatIndianNumber(marketSearchResult.previousClose)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground block">Current Market Price (CMP)</span>
                          <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            Rs. {formatIndianNumber(marketSearchResult.cmp)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingSecurity({
                              id: crypto.randomUUID(),
                              security_name: marketSearchResult.companyName || searchQuery,
                              isin: marketSearchResult.isin || "",
                              quantity: 0,
                              cmp: marketSearchResult.cmp || 0,
                              market_value: 0,
                              security_cover: 2.5,
                              loan_value: 0,
                              pledgor_name: autoData.borrower.name,
                              pledgor_borrower_id: autoData.borrower.name,
                            });
                            setIsAddSecurityOpen(true);
                          }}
                          className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs"
                        >
                          <Plus className="size-3.5" /> Add to Collateral
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-destructive">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>{marketSearchResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pledged Securities Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Scale className="size-4 text-primary" />
                  Pledged Securities & Collateral Schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  Live pledged scrips breakdown for this loan application.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshAllPrices}
                  disabled={isRefreshingPrices || autoData.securities.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  <RefreshCw className={`size-3.5 ${isRefreshingPrices ? "animate-spin" : ""}`} />
                  Refresh Live CMP (NSE/BSE)
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingSecurity(null);
                    setIsAddSecurityOpen(true);
                  }}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="size-3.5" /> Add Pledged Security
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {autoData.securities.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg space-y-2">
                  <Scale className="size-6 text-muted-foreground mx-auto" />
                  <p>No collateral or pledged shares recorded for this application yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingSecurity(null);
                      setIsAddSecurityOpen(true);
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="size-3" /> Add First Pledged Security
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-2 text-left font-semibold text-muted-foreground">#</th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">Scrip Name</th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">ISIN</th>
                        <th className="p-2 text-right font-semibold text-muted-foreground">Quantity</th>
                        <th className="p-2 text-right font-semibold text-muted-foreground">CMP (Rs.)</th>
                        <th className="p-2 text-right font-semibold text-muted-foreground">Market Value (Rs.)</th>
                        <th className="p-2 text-left font-semibold text-muted-foreground">Pledgor</th>
                        <th className="p-2 text-center font-semibold text-muted-foreground w-16">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {autoData.securities.map((sec, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2 text-muted-foreground">{idx + 1}</td>
                          <td className="p-2 font-medium">
                            <span className="font-semibold block text-foreground">{sec.scripName}</span>
                          </td>
                          <td className="p-2 font-mono text-[11px] text-muted-foreground">{sec.isin || "—"}</td>
                          <td className="p-2 text-right font-mono">{sec.quantity}</td>
                          <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                            {sec.price}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">{sec.marketValue}</td>
                          <td className="p-2 text-muted-foreground">{sec.pledgorName || "—"}</td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                title="Delete Scrip"
                                onClick={() => handleDeleteSecurity(sec.scripName)}
                                className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-bold border-t">
                        <td colSpan={5} className="p-2 text-right">
                          Total Security Market Value:
                        </td>
                        <td className="p-2 text-right font-mono text-primary text-sm">
                          {autoData.totalSecurityMarketValue}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Maintenance & Margin Management Covenants */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Security Maintenance & Margin Management Covenants
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
                  <span className="font-bold text-amber-700 dark:text-amber-300 block mb-1">
                    Margin Call Level (2.00x Cover / 50% LTV)
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    If security coverage drops below 2.00x, borrower must pledge additional eligible shares or deposit cash margin within 24 hours.
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-destructive/5 border-destructive/20">
                  <span className="font-bold text-destructive block mb-1">
                    Liquidation Trigger Level (1.75x Cover / 57% LTV)
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    If coverage falls to 1.75x or below, lender retains full right to invoke pledge and liquidate underlying shares in open market without notice.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Financials & ITR */}
      {activeTab === "financials" && (
        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                Corporate Financial Track Record (3-Year Trend)
              </CardTitle>
              <CardDescription className="text-xs">
                Auto-extracted from verified corporate financial balance sheet & P&L statements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              {autoData.corporateFinancials.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-lg">
                  No structured multi-year financial statements uploaded for this borrower. You can upload financial reports in the Borrower Details tab.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-2 text-left font-semibold text-muted-foreground">Financial Parameter</th>
                        {autoData.corporateFinancials.map((f, i) => (
                          <th key={i} className="p-2 text-right font-semibold text-foreground">
                            {f.financialYear}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">Net Revenue</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right">{f.netRevenue}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">EBITDA</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right">{f.ebitda}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">EBITDA Margin (%)</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right">{f.ebitdaMargin}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">Profit After Tax (PAT)</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right font-bold text-foreground">{f.pat}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">Net Margin (%)</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right">{f.netMargin}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">Net Worth / Total Equity</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right font-bold text-foreground">{f.totalEquity}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">Debt to Equity (D/E)</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right">{f.debtToEquity}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-sans font-medium text-foreground">Interest Coverage Ratio (ICR)</td>
                        {autoData.corporateFinancials.map((f, i) => (
                          <td key={i} className="p-2 text-right">{f.interestCoverageRatio}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 5: Credit Bureau & Banking */}
      {activeTab === "bureau" && (
        <div className="space-y-5">
          {/* Party Switcher */}
          <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 border rounded-lg">
            <span className="text-xs font-semibold text-muted-foreground px-2">Select Party:</span>
            {autoData.parties.map((p) => (
              <button
                key={p.borrowerId}
                type="button"
                onClick={() => setActivePartyId(p.borrowerId)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activePartyId === p.borrowerId
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground border"
                }`}
              >
                {p.name} ({p.roleLabel})
              </button>
            ))}
          </div>

          {activeParty && (
            <div className="space-y-5">
              <Card className="shadow-xs">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-primary" />
                      Credit Bureau (CIBIL) & Risk Parameters — {activeParty.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {activeParty.roleLabel}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <LabeledInput
                      label="CIBIL Score / CMR"
                      value={activePartyData.cibilScore}
                      placeholder="e.g. 785 or CMR-2"
                      onChange={(v) => updateParty(activePartyId, (p) => ({ ...p, cibilScore: v }))}
                    />
                    <LabeledInput
                      label="Overdue Amount (Rs.)"
                      value={activePartyData.cibilOverdue}
                      placeholder="e.g. Nil / 0"
                      onChange={(v) => updateParty(activePartyId, (p) => ({ ...p, cibilOverdue: v }))}
                    />
                    <LabeledInput
                      label="Max DPD (Days Past Due)"
                      value={activePartyData.cibilDpd}
                      placeholder="e.g. 0 DPD"
                      onChange={(v) => updateParty(activePartyId, (p) => ({ ...p, cibilDpd: v }))}
                    />
                    <LabeledInput
                      label="Bureau Enquiries (Last 3M)"
                      value={activePartyData.cibilEnquiries3m}
                      placeholder="e.g. 1"
                      onChange={(v) => updateParty(activePartyId, (p) => ({ ...p, cibilEnquiries3m: v }))}
                    />
                    <LabeledInput
                      label="Loans Availed (Last 3M)"
                      value={activePartyData.cibilLoans3m}
                      placeholder="e.g. 0"
                      onChange={(v) => updateParty(activePartyId, (p) => ({ ...p, cibilLoans3m: v }))}
                    />
                    <LabeledInput
                      label="Credit Remarks"
                      value={activePartyData.cibilRemarks}
                      placeholder="e.g. Clean track record, no write-offs"
                      onChange={(v) => updateParty(activePartyId, (p) => ({ ...p, cibilRemarks: v }))}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Banking Analysis */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Landmark className="size-4 text-primary" />
                    Bank Statement Balance Analysis (5th, 15th, 25th, Month-End)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <DynamicTable
                    title="Monthly Balance Analysis"
                    columns={["Month (e.g. Jan 2026)", "5th Balance", "15th Balance", "25th Balance", "Month-End Balance"]}
                    rows={activePartyData.bankingAnalysis}
                    onAdd={() =>
                      updateParty(activePartyId, (p) => ({
                        ...p,
                        bankingAnalysis: [
                          ...p.bankingAnalysis,
                          { month: "", day5: "", day15: "", day25: "", monthEndBalance: "" },
                        ],
                      }))
                    }
                    onRemove={(idx) =>
                      updateParty(activePartyId, (p) => ({
                        ...p,
                        bankingAnalysis: p.bankingAnalysis.filter((_, i) => i !== idx),
                      }))
                    }
                    renderRow={(row: CamBankingRow, idx, onChange) => (
                      <>
                        <TableInputCell value={row.month} placeholder="Month" onChange={(v) => onChange({ ...row, month: v })} />
                        <TableInputCell value={row.day5} placeholder="5th Balance" onChange={(v) => onChange({ ...row, day5: v })} />
                        <TableInputCell value={row.day15} placeholder="15th Balance" onChange={(v) => onChange({ ...row, day15: v })} />
                        <TableInputCell value={row.day25} placeholder="25th Balance" onChange={(v) => onChange({ ...row, day25: v })} />
                        <TableInputCell
                          value={row.monthEndBalance}
                          placeholder="Closing Balance"
                          onChange={(v) => onChange({ ...row, monthEndBalance: v })}
                        />
                      </>
                    )}
                    onRowChange={(idx, row) =>
                      updateParty(activePartyId, (p) => ({
                        ...p,
                        bankingAnalysis: p.bankingAnalysis.map((r, i) => (i === idx ? row : r)),
                      }))
                    }
                  />
                </CardContent>
              </Card>

              {/* Credit Facilities Track Record */}
              <Card className="shadow-xs">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    Existing Credit Facilities (CIBIL Track Record)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <DynamicTable
                    title="Active Loans / Facilities"
                    columns={["Facility Type", "Ownership", "Sanction Date", "Sanction (Rs.)", "POS (Rs.)", "DPD"]}
                    rows={activePartyData.creditFacilities}
                    onAdd={() =>
                      updateParty(activePartyId, (p) => ({
                        ...p,
                        creditFacilities: [
                          ...p.creditFacilities,
                          { type: "", ownership: "", date: "", sanction: "", pos: "", dpd: "" },
                        ],
                      }))
                    }
                    onRemove={(idx) =>
                      updateParty(activePartyId, (p) => ({
                        ...p,
                        creditFacilities: p.creditFacilities.filter((_, i) => i !== idx),
                      }))
                    }
                    renderRow={(row: CamCreditFacilityRow, idx, onChange) => (
                      <>
                        <TableInputCell value={row.type} placeholder="Term Loan / OD" onChange={(v) => onChange({ ...row, type: v })} />
                        <TableInputCell value={row.ownership} placeholder="Individual / Joint" onChange={(v) => onChange({ ...row, ownership: v })} />
                        <TableInputCell value={row.date} placeholder="YYYY-MM" onChange={(v) => onChange({ ...row, date: v })} />
                        <TableInputCell value={row.sanction} placeholder="Sanction Amt" onChange={(v) => onChange({ ...row, sanction: v })} />
                        <TableInputCell value={row.pos} placeholder="Principal O/S" onChange={(v) => onChange({ ...row, pos: v })} />
                        <TableInputCell value={row.dpd} placeholder="0 DPD" onChange={(v) => onChange({ ...row, dpd: v })} />
                      </>
                    )}
                    onRowChange={(idx, row) =>
                      updateParty(activePartyId, (p) => ({
                        ...p,
                        creditFacilities: p.creditFacilities.map((r, i) => (i === idx ? row : r)),
                      }))
                    }
                  />
                </CardContent>
              </Card>

              {/* Individual ITR - For Individuals Only */}
              {!activeParty.isCompany && (
                <Card className="shadow-xs">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="size-4 text-primary" />
                      Individual ITR Income Details (Rs. in Lacs)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ItrTable
                      itrData={activePartyData.itrData}
                      onChange={(itrData) => updateParty(activePartyId, (p) => ({ ...p, itrData }))}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Due Diligence & Adverse Checks */}
      {activeTab === "due_diligence" && (
        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="size-4 text-primary" />
                Adverse Media & Background Search (Borrower & Guarantor)
              </CardTitle>
              <CardDescription className="text-xs">
                Checks conducted across MCA-21, courts, news media, SEBI orders, and wilful defaulter lists.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <RowListEditor
                items={manual.googleSearchResults}
                onChange={(googleSearchResults) => setManual((p) => ({ ...p, googleSearchResults }))}
                empty={{ partyName: "", result: "" }}
                fields={[
                  { key: "partyName", placeholder: "Party / Entity Name" },
                  { key: "result", placeholder: "Findings (e.g. No Adverse Media or Litigation Found)", multiline: true },
                ]}
              />
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Key Verification Parameters Checklist
              </CardTitle>
              <CardDescription className="text-xs">
                Underwriter verification observations across statutory and collateral parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <RowListEditor
                items={manual.verification}
                onChange={(verification) => setManual((p) => ({ ...p, verification }))}
                empty={{ particular: "", remark: "" }}
                fields={[
                  { key: "particular", placeholder: "Parameter (e.g. MCA DIN Check, Demat Pledge, AML/OFAC)" },
                  { key: "remark", placeholder: "Remarks & Observations", multiline: true },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 7: Risk & Approval */}
      {activeTab === "risks_signoff" && (
        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Risk Assessment & Mitigants Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Identify key deal and collateral risks along with structural mitigants.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <RowListEditor
                items={manual.risks}
                onChange={(risks) => setManual((p) => ({ ...p, risks }))}
                empty={{ risk: "", mitigate: "" }}
                fields={[
                  { key: "risk", placeholder: "Identified Risk Factor", multiline: true },
                  { key: "mitigate", placeholder: "Proposed Mitigant & Risk Controls", multiline: true },
                ]}
              />
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Credit Committee Sign-Off & Approvals
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <LabeledInput
                  label="Prepared / Appraised By"
                  value={manual.preparedBy}
                  placeholder="e.g. Underwriter Name, Credit Analyst"
                  onChange={(v) => setManual((p) => ({ ...p, preparedBy: v }))}
                />
                <LabeledInput
                  label="Recommended / Approved By"
                  value={manual.approvedBy}
                  placeholder="e.g. Head of Credit / Sanction Committee"
                  onChange={(v) => setManual((p) => ({ ...p, approvedBy: v }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 8: Credit Committee Approvals & Workflow */}
      {activeTab === "approvals" && (
        <div className="space-y-6">
          {/* Top Info & Summary Banner */}
          <Card className="border-primary/30 shadow-xs bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-transparent">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <UserCheck className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      Credit Committee Approvals &amp; Digital Sign-Off
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Add committee members with their email addresses. Each approver receives an executive email with the CAM and a 1-click digital sign-off link.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset("trio")}
                    className="text-xs h-8 gap-1.5"
                  >
                    <Sparkles className="size-3 text-primary" />
                    + 3-Member Committee
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyPreset("dual")}
                    className="text-xs h-8 gap-1.5"
                  >
                    <Sparkles className="size-3 text-primary" />
                    + Dual Sign-Off
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendAllEmails}
                    disabled={approvers.length === 0 || sendingEmailId === "all"}
                    className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-xs font-semibold"
                  >
                    {sendingEmailId === "all" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send All Approval Requests
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Committee Status Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-card border">
                  <span className="text-muted-foreground block text-[11px]">Total Approvers</span>
                  <span className="text-base font-bold font-mono text-foreground">{approvers.length}</span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-700 dark:text-emerald-300 block text-[11px]">Approved</span>
                  <span className="text-base font-bold font-mono text-emerald-800 dark:text-emerald-200">
                    {approvers.filter((a) => a.approvalStatus === "approved" || a.approvalStatus === "approved_with_conditions").length}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-700 dark:text-amber-300 block text-[11px]">Pending Review</span>
                  <span className="text-base font-bold font-mono text-amber-800 dark:text-amber-200">
                    {approvers.filter((a) => a.approvalStatus === "pending").length}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <span className="text-rose-700 dark:text-rose-300 block text-[11px]">Rejected</span>
                  <span className="text-base font-bold font-mono text-rose-800 dark:text-rose-200">
                    {approvers.filter((a) => a.approvalStatus === "rejected").length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add New Approver Row */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="size-4 text-primary" />
                Add Credit Committee Approver
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Approver Name *</Label>
                  <Input
                    value={newApproverName}
                    onChange={(e) => setNewApproverName(e.target.value)}
                    placeholder="e.g. Rajiv Mehra"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Email Address *</Label>
                  <Input
                    type="email"
                    value={newApproverEmail}
                    onChange={(e) => setNewApproverEmail(e.target.value)}
                    placeholder="e.g. rajiv.mehra@company.com"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Designation / Role</Label>
                  <Input
                    value={newApproverRole}
                    onChange={(e) => setNewApproverRole(e.target.value)}
                    placeholder="e.g. Chief Risk Officer"
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddApprover}
                  disabled={!newApproverName.trim() || !newApproverEmail.trim()}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Add Member
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configured Approvers List */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Configured Approvers &amp; Live Status ({approvers.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Review status, send/resend email requests, or copy direct magic links for verification.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveApproversList()}
                disabled={isSavingApprovers}
                className="text-xs h-7 gap-1"
              >
                {isSavingApprovers ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                Save Changes
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {approvers.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                  No committee approvers configured yet. Click above or choose a preset to add committee members.
                </div>
              ) : (
                <div className="space-y-3">
                  {approvers.map((app, idx) => (
                    <div
                      key={app.id || idx}
                      className="p-3.5 rounded-xl border bg-card hover:bg-muted/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-foreground">{app.approverName}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {app.approverRole || "Credit Committee"}
                          </Badge>
                          {app.approvalStatus === "approved" ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                              <CheckCircle2 className="size-3" /> Approved
                            </Badge>
                          ) : app.approvalStatus === "approved_with_conditions" ? (
                            <Badge className="bg-amber-500 text-white text-[10px] gap-1">
                              <AlertTriangle className="size-3" /> Approved w/ Conditions
                            </Badge>
                          ) : app.approvalStatus === "rejected" ? (
                            <Badge className="bg-rose-600 text-white text-[10px] gap-1">
                              <XCircle className="size-3" /> Rejected
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
                              <Clock className="size-3" /> Pending Review
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{app.approverEmail}</p>

                        {/* Conditions or Remarks display */}
                        {app.conditions && (
                          <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-md mt-1">
                            <strong>Conditions:</strong> {app.conditions}
                          </div>
                        )}
                        {app.comments && (
                          <div className="text-[11px] text-muted-foreground italic mt-0.5">
                            &quot;{app.comments}&quot; {app.digitalSignature && `— Signed by ${app.digitalSignature}`}
                          </div>
                        )}
                        {app.decisionAt && (
                          <div className="text-[10px] text-muted-foreground">
                            Decision Date:{" "}
                            {new Date(app.decisionAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendApprovalEmail(app.id, app.approverEmail)}
                          disabled={sendingEmailId === app.id}
                          className="h-8 text-xs gap-1.5"
                        >
                          {sendingEmailId === app.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Mail className="size-3.5 text-primary" />
                          )}
                          {app.sentAt ? "Resend Email" : "Send Email"}
                        </Button>

                        {app.approvalToken && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyReviewLink(app.approvalToken)}
                            className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            title="Copy Direct Review Link"
                          >
                            <Copy className="size-3.5" />
                            {copiedToken === app.approvalToken ? "Copied!" : "Copy Link"}
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteApprover(app.id)}
                          className="h-8 px-2 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 9: Live CAM Document Preview */}
      {activeTab === "preview" && (
        <Card className="shadow-lg border-2 border-primary/20">
          <CardHeader className="pb-3 border-b bg-muted/30 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Live CAM Document Preview (Exact Export Format)
              </CardTitle>
              <CardDescription className="text-xs">
                Preview the formatted Credit Appraisal Memo before downloading the DOCX file.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="gap-1.5 text-xs h-8 shadow-xs"
              >
                {isGenerating ? <Loader2 className="size-3 animate-spin" /> : <FileDown className="size-3" />}
                Export CAM DOCX
              </Button>
              <Link href={`/loans/${applicationId}/sanction`}>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs h-8 shadow-xs"
                >
                  <FileCheck className="size-3" />
                  Draft Sanction Letter
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6 font-serif bg-white text-slate-900 rounded-b-lg">
            {/* Header Banner */}
            <div className="text-center border-b pb-4 space-y-1">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase font-semibold block">
                CONFIDENTIAL — FOR CREDIT COMMITTEE USE ONLY
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
                CREDIT APPRAISAL MEMO (CAM)
              </h1>
              <p className="text-xs italic text-slate-500 font-sans">
                Wholesale Lending & Structured Credit Division
              </p>
            </div>

            {/* 1. Proposal Summary */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider font-sans text-indigo-950 border-b pb-1">
                1. Proposal & Facility Summary
              </h2>
              <table className="w-full text-xs border border-slate-300 font-sans">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold w-1/3 border-r border-slate-200">Application Reference</td>
                    <td className="p-2">{autoData.applicationCode}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold border-r border-slate-200">Borrower Name</td>
                    <td className="p-2 font-bold">{autoData.borrower.name}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold border-r border-slate-200">Facility Type</td>
                    <td className="p-2">{autoData.facilityType}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold border-r border-slate-200">Sanction Limit</td>
                    <td className="p-2 font-bold text-indigo-900">{autoData.sanctionAmountText}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold border-r border-slate-200">Tenor</td>
                    <td className="p-2">{autoData.tenureMonths} Months</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold border-r border-slate-200">Purpose</td>
                    <td className="p-2">{autoData.purpose}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold border-r border-slate-200">Security Cover Ratio</td>
                    <td className="p-2 font-bold text-emerald-800">
                      {autoData.securityCoverRatio > 0 ? `${autoData.securityCoverRatio}x (Target: >= 2.50x)` : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold border-r border-slate-200">Loan To Value (LTV)</td>
                    <td className="p-2">{autoData.ltvPercent > 0 ? `${autoData.ltvPercent}% (Max: 40%)` : "—"}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold border-r border-slate-200">Guarantors</td>
                    <td className="p-2">{autoData.guarantorSummaries.join("; ") || "None"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 2. Borrower & Promoters */}
            <div className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider font-sans text-indigo-950 border-b pb-1">
                2. Borrower Profile & Promoters
              </h2>
              <table className="w-full text-xs border border-slate-300 font-sans mb-3">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold w-1/3 border-r border-slate-200">CIN</td>
                    <td className="p-2 font-mono">{autoData.borrower.cin || "—"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold border-r border-slate-200">PAN</td>
                    <td className="p-2 font-mono">{autoData.borrower.pan || "—"}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold border-r border-slate-200">GSTIN</td>
                    <td className="p-2 font-mono">{autoData.borrower.gstin || "—"}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold border-r border-slate-200">Registered Office</td>
                    <td className="p-2">{autoData.borrower.address || "—"}</td>
                  </tr>
                </tbody>
              </table>

              {manual.aboutCompanyText && (
                <div className="pt-2">
                  <h3 className="text-xs font-bold font-sans text-slate-800 mb-1">About {autoData.borrower.name}</h3>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                    {manual.aboutCompanyText}
                  </p>
                </div>
              )}

              {manual.promoterProfiles.length > 0 && (
                <div className="pt-3 space-y-2 font-sans">
                  <h3 className="text-xs font-bold text-slate-800">Key Promoters & Directors</h3>
                  {manual.promoterProfiles.map((p, i) => (
                    <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5">
                      <span className="font-bold text-indigo-950">
                        {p.name} {p.din && `(DIN: ${p.din})`}
                      </span>
                      {p.text && <p className="text-slate-600">{p.text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Collateral & Security Schedule */}
            {autoData.securities.length > 0 && (
              <div className="space-y-2 font-sans">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 border-b pb-1">
                  3. Collateral & Security Schedule
                </h2>
                <table className="w-full text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Scrip Name</th>
                      <th className="p-2 text-left">ISIN</th>
                      <th className="p-2 text-right">Quantity</th>
                      <th className="p-2 text-right">CMP (Rs.)</th>
                      <th className="p-2 text-right">Market Value (Rs.)</th>
                      <th className="p-2 text-left">Pledgor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {autoData.securities.map((s, i) => (
                      <tr key={i}>
                        <td className="p-2 font-sans">{i + 1}</td>
                        <td className="p-2 font-sans font-semibold">{s.scripName}</td>
                        <td className="p-2 text-slate-500">{s.isin || "—"}</td>
                        <td className="p-2 text-right">{s.quantity}</td>
                        <td className="p-2 text-right">{s.price}</td>
                        <td className="p-2 text-right font-bold text-indigo-950">{s.marketValue}</td>
                        <td className="p-2 font-sans text-slate-600">{s.pledgorName || "—"}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold font-sans">
                      <td colSpan={5} className="p-2 text-right">Total Security Value:</td>
                      <td className="p-2 text-right font-mono text-indigo-900">{autoData.totalSecurityMarketValue}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. Financials */}
            {autoData.corporateFinancials.length > 0 && (
              <div className="space-y-2 font-sans">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 border-b pb-1">
                  4. Corporate Financial Highlights
                </h2>
                <table className="w-full text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 text-left">Metric</th>
                      {autoData.corporateFinancials.map((f, i) => (
                        <th key={i} className="p-2 text-right">{f.financialYear}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr>
                      <td className="p-2 font-sans font-medium">Net Revenue</td>
                      {autoData.corporateFinancials.map((f, i) => (
                        <td key={i} className="p-2 text-right">{f.netRevenue}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">EBITDA</td>
                      {autoData.corporateFinancials.map((f, i) => (
                        <td key={i} className="p-2 text-right">{f.ebitda}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">PAT</td>
                      {autoData.corporateFinancials.map((f, i) => (
                        <td key={i} className="p-2 text-right font-bold">{f.pat}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-2 font-sans font-medium">Net Worth</td>
                      {autoData.corporateFinancials.map((f, i) => (
                        <td key={i} className="p-2 text-right">{f.totalEquity}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. Underwriting Justification */}
            {manual.underwritingJustification && (
              <div className="space-y-2 font-sans">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 border-b pb-1">
                  5. Underwriting Justification
                </h2>
                <ul className="list-disc pl-5 text-xs space-y-1 text-slate-700">
                  {manual.underwritingJustification.split(/\n+/).filter(Boolean).map((bullet, i) => (
                    <li key={i}>{bullet.replace(/^[•\-\*]\s*/, "")}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. Adverse Checks */}
            {manual.googleSearchResults.length > 0 && (
              <div className="space-y-2 font-sans">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 border-b pb-1">
                  6. Adverse Media & Background Search (Borrower & Guarantor)
                </h2>
                <table className="w-full text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 text-left w-1/3">Party Name</th>
                      <th className="p-2 text-left">Findings / Observations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {manual.googleSearchResults.map((g, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold">{g.partyName}</td>
                        <td className="p-2 text-slate-700">{g.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 7. Risk & Mitigants */}
            {manual.risks.length > 0 && (
              <div className="space-y-2 font-sans">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 border-b pb-1">
                  7. Risk Assessment & Mitigants
                </h2>
                <table className="w-full text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 text-left w-2/5">Identified Risk Factor</th>
                      <th className="p-2 text-left">Proposed Mitigant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {manual.risks.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-semibold text-slate-800">{r.risk}</td>
                        <td className="p-2 text-slate-700">{r.mitigate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 8. Credit Committee Sign-Off Matrix */}
            <div className="pt-6 font-sans space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 border-b pb-1">
                8. Credit Committee Formal Sign-Off Matrix
              </h2>
              {approvers.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-50 border rounded">
                  No individual Credit Committee members assigned. Standard dual sign-off configured below.
                </div>
              ) : (
                <table className="w-full text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2 text-left">Committee Member</th>
                      <th className="p-2 text-left">Designation</th>
                      <th className="p-2 text-left">Decision / Status</th>
                      <th className="p-2 text-left">Date / Timestamp</th>
                      <th className="p-2 text-left">Remarks &amp; Conditions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {approvers.map((app, i) => (
                      <tr key={app.id || i}>
                        <td className="p-2 font-semibold">
                          {app.approverName}
                          <div className="text-[10px] text-slate-500 font-mono">{app.approverEmail}</div>
                        </td>
                        <td className="p-2">{app.approverRole || "Credit Committee Member"}</td>
                        <td className="p-2">
                          {app.approvalStatus === "approved" ? (
                            <span className="font-bold text-emerald-700">APPROVED</span>
                          ) : app.approvalStatus === "approved_with_conditions" ? (
                            <span className="font-bold text-amber-600">APPROVED W/ CONDITIONS</span>
                          ) : app.approvalStatus === "rejected" ? (
                            <span className="font-bold text-rose-600">REJECTED</span>
                          ) : (
                            <span className="text-slate-500 font-medium">AWAITING REVIEW</span>
                          )}
                        </td>
                        <td className="p-2 font-mono">
                          {app.decisionAt
                            ? new Date(app.decisionAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="p-2 text-slate-700">
                          {app.conditions && (
                            <div className="text-amber-800 font-medium">Cond: {app.conditions}</div>
                          )}
                          {app.comments && <div>{app.comments}</div>}
                          {!app.conditions && !app.comments && "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="grid grid-cols-2 gap-4 pt-3 text-xs">
                <div className="p-2 bg-slate-50 border rounded">
                  <span className="text-slate-500 block text-[10px]">Prepared By</span>
                  <span className="font-bold">{manual.preparedBy || "Credit Analyst / Underwriter"}</span>
                </div>
                <div className="p-2 bg-slate-50 border rounded">
                  <span className="text-slate-500 block text-[10px]">Appraised & Recommended By</span>
                  <span className="font-bold">{manual.approvedBy || "Credit Committee / Risk Head"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
        <div className="text-xs text-muted-foreground">
          {saveMessage && <span className="font-medium text-emerald-600">{saveMessage.text}</span>}
          {generateError && <span className="text-destructive">{generateError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving} className="gap-1.5 text-xs h-9">
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save Draft
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-1.5 text-xs h-9 bg-primary">
            {isGenerating ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
            Generate & Download CAM (.docx)
          </Button>
          <Link href={`/loans/${applicationId}/sanction`}>
            <Button className="gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              <FileCheck className="size-3.5" />
              Proceed to Sanction Letter
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Add / Edit Pledged Security Modal */}
      <AddSecurityDialog
        open={isAddSecurityOpen}
        onOpenChange={(open) => {
          setIsAddSecurityOpen(open);
          if (!open) setEditingSecurity(null);
        }}
        onSave={handleSaveSecurity}
        initialItem={editingSecurity}
        providers={securityProviders}
        defaultProviderId={autoData.borrower.name}
        primaryBorrower={securityProviders[0]}
      />
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted/50 border shrink-0">{icon}</div>
        <div className="space-y-0.5 overflow-hidden">
          <span className="text-[11px] font-semibold text-muted-foreground block">{title}</span>
          <p className="text-base font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <p className="font-medium text-foreground text-xs">{value}</p>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
    </div>
  );
}

function TableInputCell({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <td className="p-1">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-input bg-card px-2 py-1 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-primary"
      />
    </td>
  );
}

function DynamicTable<T>({
  title,
  columns,
  rows,
  onAdd,
  onRemove,
  onRowChange,
  renderRow,
}: {
  title: string;
  columns: string[];
  rows: T[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onRowChange: (idx: number, row: T) => void;
  renderRow: (row: T, idx: number, onChange: (row: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
          <Plus className="size-3" /> Add Row
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">
          No records added. Click &quot;Add Row&quot; to populate.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/50 border-b">
                {columns.map((c) => (
                  <th key={c} className="p-2 text-left font-semibold text-muted-foreground">
                    {c}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/10">
                  {renderRow(row, idx, (updated) => onRowChange(idx, updated))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="text-destructive hover:text-destructive/80 p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ItrTable({
  itrData,
  onChange,
}: {
  itrData: CamItrRow[];
  onChange: (data: CamItrRow[]) => void;
}) {
  const years = Array.from(new Set(itrData.flatMap((r) => Object.keys(r.values))));
  const [newYear, setNewYear] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-muted-foreground">ITR Head Breakdown</span>
        <div className="flex items-center gap-1.5">
          <input
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="e.g. 2025-26"
            className="h-7 w-24 rounded border border-input bg-card px-2 text-[11px]"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              if (!newYear.trim()) return;
              onChange(itrData.map((r) => ({ ...r, values: { ...r.values, [newYear]: r.values[newYear] || "" } })));
              setNewYear("");
            }}
          >
            <Plus className="size-3" /> Add Year
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onChange([...itrData, { incomeHead: "", values: {} }])}
          >
            <Plus className="size-3" /> Add Head
          </Button>
        </div>
      </div>
      {itrData.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">
          No ITR heads added. Click &quot;Add Head&quot; to begin.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="p-2 text-left font-semibold text-muted-foreground">Income Head</th>
                {years.map((y) => (
                  <th key={y} className="p-2 text-right font-semibold text-muted-foreground">
                    {y}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {itrData.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/10">
                  <TableInputCell
                    value={row.incomeHead}
                    placeholder="e.g. Salary, Business, Capital Gains"
                    onChange={(v) => onChange(itrData.map((r, i) => (i === idx ? { ...r, incomeHead: v } : r)))}
                  />
                  {years.map((y) => (
                    <TableInputCell
                      key={y}
                      value={row.values[y] || ""}
                      placeholder="Amount in Lacs"
                      onChange={(v) =>
                        onChange(
                          itrData.map((r, i) => (i === idx ? { ...r, values: { ...r.values, [y]: v } } : r)),
                        )
                      }
                    />
                  ))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => onChange(itrData.filter((_, i) => i !== idx))}
                      className="text-destructive hover:text-destructive/80 p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowListEditor<T extends Record<string, string>>({
  items,
  onChange,
  empty,
  fields,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  fields: Array<{ key: keyof T; placeholder: string; multiline?: boolean }>;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground border border-dashed rounded-lg">
          No records added. Click &quot;Add Item&quot; below.
        </div>
      ) : (
        items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/10">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fields.map((f) =>
                f.multiline ? (
                  <Textarea
                    key={String(f.key)}
                    value={item[f.key] as string}
                    onChange={(e) =>
                      onChange(items.map((it, i) => (i === idx ? { ...it, [f.key]: e.target.value } : it)))
                    }
                    placeholder={f.placeholder}
                    rows={2}
                    className="text-xs"
                  />
                ) : (
                  <Input
                    key={String(f.key)}
                    value={item[f.key] as string}
                    onChange={(e) =>
                      onChange(items.map((it, i) => (i === idx ? { ...it, [f.key]: e.target.value } : it)))
                    }
                    placeholder={f.placeholder}
                    className="h-8 text-xs font-medium"
                  />
                ),
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => onChange([...items, empty])}
      >
        <Plus className="size-3" /> Add Item
      </Button>
    </div>
  );
}
