"use client";

import { useState, useTransition, useRef } from "react";
import {
  type PortalApplicationDetails,
  uploadPortalDocument,
  deletePortalDocument,
  getPortalDocumentUrl,
  confirmPortalReview,
} from "@/app/portal/portal-actions";
import {
  DOCUMENT_GROUPS,
  type DocumentGroupKey,
  ALL_CATEGORY_LABELS,
  CORPORATE_REQUIRED,
} from "@/app/portal/document-categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Landmark,
  ShieldCheck,
  FileCheck2,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileImage,
  Trash2,
  ExternalLink,
  Clock,
  Calendar,
  Building2,
  User,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface BorrowerReviewClientProps {
  initialData: PortalApplicationDetails;
  token: string;
}

function formatCurrency(amount: number) {
  if (isNaN(amount) || amount <= 0) return "₹ 0";
  if (amount >= 10000000) {
    return `₹ ${amount.toLocaleString("en-IN")} (₹ ${(amount / 10000000).toFixed(2)} Cr)`;
  }
  if (amount >= 100000) {
    return `₹ ${amount.toLocaleString("en-IN")} (₹ ${(amount / 100000).toFixed(2)} Lakh)`;
  }
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return <FileText className="size-4 text-rose-500 shrink-0" />;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    return <FileSpreadsheet className="size-4 text-emerald-600 shrink-0" />;
  }
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
    return <FileImage className="size-4 text-blue-500 shrink-0" />;
  }
  return <FileText className="size-4 text-slate-500 shrink-0" />;
}

function DocumentRow({
  doc,
  onView,
  onDelete,
}: {
  doc: PortalApplicationDetails["documents"][number];
  onView: (storagePath: string) => void;
  onDelete: (docId: string, storagePath: string) => void;
}) {
  const matchedCat = ALL_CATEGORY_LABELS.find((c) => c.value === doc.category);
  const categoryLabel = matchedCat?.label || doc.category;

  return (
    <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="size-9 rounded-lg bg-muted/40 border flex items-center justify-center shrink-0">
          {getFileIcon(doc.fileName)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-foreground truncate max-w-xs sm:max-w-md">
              {doc.fileName}
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider">
              {doc.stage}
            </Badge>
            {doc.uploadedByBorrower && (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                Borrower Upload
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span>{categoryLabel}</span>
            {doc.fileSize && <span>• {formatBytes(doc.fileSize)}</span>}
            <span>• {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(doc.storagePath)}
          className="h-8 px-2.5 text-xs gap-1 font-medium"
        >
          <ExternalLink className="size-3" />
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(doc.id, doc.storagePath)}
          className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// Short labels for the compact checklist chips - CORPORATE_REQUIRED's full
// labels (from DOCUMENT_GROUPS) are too long to render as small pills.
const CORPORATE_CHIP_LABELS = [
  { value: "moa", label: "MOA" },
  { value: "aoa", label: "AOA" },
  { value: "gst_certificate", label: "GST Cert." },
  { value: "mca_documents", label: "MCA Docs" },
  { value: "lei_certificate", label: "LEI" },
];

function ChecklistChip({
  done,
  label,
  optional,
}: {
  done: boolean;
  label: string;
  optional?: boolean;
}) {
  return (
    <span
      title={done ? `${label} - uploaded` : optional ? `${label} - recommended` : `${label} - required`}
      className={`inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap ${done
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : optional
            ? "border-sky-500/25 bg-sky-500/5 text-sky-700 dark:text-sky-400"
            : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        }`}
    >
      {done ? <CheckCircle2 className="size-3 shrink-0" /> : <AlertCircle className="size-3 shrink-0" />}
      {label}
    </span>
  );
}

type Party = {
  id: string;
  name: string;
  role: "Primary Borrower" | "Co-Borrower" | "Guarantor";
  borrowerType?: string;
};

export function BorrowerReviewClient({ initialData, token }: BorrowerReviewClientProps) {
  const [data, setData] = useState<PortalApplicationDetails>(initialData);
  const isCorporate = data.primaryBorrower.borrowerType === "corporate";

  // Every party this loan application is linked to - used both to segregate
  // uploaded documents and to let the uploader pick who a document is for.
  const parties: Party[] = [
    { id: data.primaryBorrower.id, name: data.primaryBorrower.displayName, role: "Primary Borrower", borrowerType: data.primaryBorrower.borrowerType },
    ...data.coBorrowers.map((cb): Party => ({ id: cb.id, name: cb.name, role: "Co-Borrower", borrowerType: cb.borrowerType })),
    ...data.guarantors.map((g): Party => ({ id: g.id, name: g.name, role: "Guarantor", borrowerType: g.borrowerType })),
  ];

  const [docGroup, setDocGroup] = useState<DocumentGroupKey>("kyc");
  const [category, setCategory] = useState<string>(DOCUMENT_GROUPS.kyc.items[0].value);
  const [partyId, setPartyId] = useState<string>(data.primaryBorrower.id);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [notes, setNotes] = useState<string>(initialData.borrowerReviewNotes || "");
  const [acknowledged, setAcknowledged] = useState<boolean>(initialData.portalStatus === "confirmed");
  const [documentConsent, setDocumentConsent] = useState<boolean>(initialData.portalStatus === "confirmed");
  const [isConfirming, startConfirmTransition] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<boolean>(initialData.portalStatus === "confirmed");

  // Mandatory-document checks apply to the primary borrower's own uploads -
  // co-borrower/guarantor documents are tracked separately and don't gate submission.
  const primaryDocs = data.documents.filter((d) => d.borrowerId === data.primaryBorrower.id);
  const hasPan = primaryDocs.some((d) => d.category === "pan_card");
  const hasIdProof = primaryDocs.some((d) =>
    (["aadhaar_masked", "passport", "driving_license"] as const).includes(
      d.category as "aadhaar_masked" | "passport" | "driving_license",
    ),
  );
  const kycComplete = hasPan && hasIdProof;

  // All four corporate documents are mandatory when the applicant is a corporate entity.
  const missingCorporateDocs = isCorporate
    ? CORPORATE_REQUIRED.filter((cat) => !primaryDocs.some((d) => d.category === cat))
    : [];
  const corporateComplete = !isCorporate || missingCorporateDocs.length === 0;

  const allRequiredDocsComplete = kycComplete && corporateComplete;

  // Net Worth / Financials are shown in the checklist for visibility but are
  // not currently mandatory, so they don't gate submission.
  const hasNetWorth = primaryDocs.some((d) => d.category === "net_worth_certificate");
  const hasFinancials = primaryDocs.some((d) => d.category === "itr_signed_stamped");

  const mandatoryTotal = 2 + (isCorporate ? CORPORATE_REQUIRED.length : 0);
  const mandatoryDone =
    (hasPan ? 1 : 0) + (hasIdProof ? 1 : 0) + (isCorporate ? CORPORATE_REQUIRED.length - missingCorporateDocs.length : 0);

  const [expandedSection, setExpandedSection] = useState<{ [key: string]: boolean }>({
    terms: true,
    parties: true,
    collaterals: true,
    documents: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleGroupChange = (newGroup: DocumentGroupKey) => {
    setDocGroup(newGroup);
    setCategory(DOCUMENT_GROUPS[newGroup].items[0].value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 50 * 1024 * 1024) {
        setUploadError("File size exceeds 50MB limit. Please upload a smaller file.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setUploadError(null);
    startUploadTransition(async () => {
      try {
        const response = await fetch("/api/portal/upload", {
          method: "POST",
          headers: {
            "x-token": token,
            "x-stage": DOCUMENT_GROUPS[docGroup].dbStage,
            "x-category": category,
            "x-party-id": partyId,
            "x-filename": encodeURIComponent(selectedFile.name),
            "content-type": selectedFile.type || "application/octet-stream",
          },
          body: selectedFile,
        });

        const res = await response.json();
        if (!res.success || !res.document) {
          setUploadError(res.error || "Upload failed. Please try again.");
          return;
        }

        // Prepend uploaded doc
        setData((prev) => ({
          ...prev,
          portalStatus: prev.portalStatus === "confirmed" ? "confirmed" : "documents_uploaded",
          documents: [res.document!, ...prev.documents],
        }));
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        setUploadError(errorObj?.message || "Upload failed. Please try again.");
      }
    });
  };

  const handleDelete = async (docId: string, storagePath: string) => {
    if (!confirm("Are you sure you want to remove this document?")) return;

    const res = await deletePortalDocument(docId, storagePath, token);
    if (!res.success) {
      alert(res.error || "Failed to delete document.");
      return;
    }

    setData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== docId),
    }));
  };

  const handleView = async (storagePath: string) => {
    const res = await getPortalDocumentUrl(storagePath, token);
    if (res.success && res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      alert(res.error || "Could not retrieve document URL.");
    }
  };

  const handleConfirmReview = () => {
    if (!hasPan) {
      setConfirmError("PAN Card is mandatory. Please upload it under the KYC section before submitting.");
      return;
    }
    if (!hasIdProof) {
      setConfirmError(
        "Please upload one identity document under KYC: Aadhaar (Masked), Passport, or Driving License.",
      );
      return;
    }
    if (missingCorporateDocs.length > 0) {
      const labels = DOCUMENT_GROUPS.corporate.items
        .filter((i) => (missingCorporateDocs as readonly string[]).includes(i.value))
        .map((i) => i.label);
      setConfirmError(`All Corporate documents are mandatory. Missing: ${labels.join(", ")}.`);
      return;
    }
    if (!documentConsent) {
      setConfirmError("Please accept the document sharing consent before submitting.");
      return;
    }
    if (!acknowledged) {
      setConfirmError("Please accept the acknowledgment checkbox before submitting.");
      return;
    }

    setConfirmError(null);
    startConfirmTransition(async () => {
      const res = await confirmPortalReview(token, notes);
      if (!res.success) {
        setConfirmError(res.error || "Failed to submit review. Please try again.");
        return;
      }

      setConfirmSuccess(true);
      setData((prev) => ({
        ...prev,
        portalStatus: "confirmed",
        borrowerReviewedAt: new Date().toISOString(),
        borrowerReviewNotes: notes,
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* Top Security & Institution Navigation */}
      <header className="border-b bg-card px-4 sm:px-8 py-3.5 sticky top-0 z-20 shadow-xs backdrop-blur-md bg-card/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Landmark className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Wholesale Lending Portal
                </span>
                <span className="text-muted-foreground/40 hidden sm:inline">|</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {data.applicationCode}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Borrower Facility Review &amp; Document Upload
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
              <Lock className="size-3" />
              <span>256-bit Encrypted Session</span>
            </div>
            {data.portalStatus === "confirmed" ? (
              <Badge className="bg-emerald-600 text-white border-0 text-xs gap-1 py-1">
                <CheckCircle2 className="size-3" />
                Review Confirmed
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 text-xs">
                Awaiting Borrower Review
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 pt-6">
        {/* Success Notice Banner if Submitted */}
        {confirmSuccess && (
          <div className="p-4 sm:p-5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 flex items-start gap-3.5 shadow-xs">
            <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-sm sm:text-base text-emerald-950 dark:text-emerald-200">
                Facility Terms Verified &amp; Documents Submitted Successfully!
              </h2>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Your confirmation and supporting documentation have been transmitted directly to our credit underwriting desk.
                Your relationship manager will reach out if any additional clarifications are required.
              </p>
              {data.borrowerReviewedAt && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono pt-1">
                  Confirmed on: {new Date(data.borrowerReviewedAt).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Hero Facility Overview */}
        <Card className="shadow-xs border-border/80 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs font-semibold">
                    {data.applicationCode}
                  </Badge>
                  <Badge className="bg-primary text-primary-foreground text-xs">
                    {data.facilityType}
                  </Badge>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {data.primaryBorrower.displayName}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>Primary Obligor PAN:</span>
                  <span className="font-mono font-semibold text-foreground">{data.primaryBorrower.pan}</span>
                  {data.primaryBorrower.city && (
                    <>
                      <span>•</span>
                      <span>{data.primaryBorrower.city}</span>
                    </>
                  )}
                </p>
              </div>

              <div className="sm:text-right bg-card/60 backdrop-blur-sm p-3.5 rounded-lg border border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Requested Facility Amount
                </span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-primary block mt-0.5">
                  {formatCurrency(data.requestedAmount)}
                </span>
                <span className="text-xs text-muted-foreground flex items-center sm:justify-end gap-1 mt-0.5">
                  <Clock className="size-3 text-muted-foreground" />
                  Tenure: {data.tenureMonths} Months
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible Facility Details */}
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Facility Type</span>
                <p className="font-semibold text-foreground text-sm">{data.facilityType}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Repayment Tenure</span>
                <p className="font-semibold text-foreground text-sm">{data.tenureMonths} Months</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Application Status</span>
                <p className="font-semibold text-foreground capitalize text-sm">{data.status.replace("_", " ")}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium">Application Date</span>
                <p className="font-semibold text-foreground text-sm flex items-center gap-1">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {new Date(data.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {data.purpose && (
              <div className="pt-3 border-t text-xs">
                <span className="font-semibold text-foreground mr-1.5">Stated Facility Purpose:</span>
                <span className="text-muted-foreground">{data.purpose}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Obligor Structure (Co-Borrowers, Guarantors, Collaterals) */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Obligor Hierarchy &amp; Guarantee Structure
              </CardTitle>
              <CardDescription className="text-xs">
                Review all entities, co-obligors, and personal/corporate guarantors bound to this facility.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection("parties")}
              className="size-8 p-0 text-muted-foreground"
            >
              {expandedSection.parties ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </CardHeader>

          {expandedSection.parties && (
            <CardContent className="p-5 space-y-5">
              {/* Primary Borrower Card */}
              <div className="p-3.5 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Primary Borrower
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                    {data.primaryBorrower.borrowerType}
                  </Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{data.primaryBorrower.legalName}</h3>
                    <p className="text-xs font-mono text-muted-foreground">PAN: {data.primaryBorrower.pan}</p>
                  </div>
                  {(data.primaryBorrower.email || data.primaryBorrower.phone) && (
                    <div className="text-xs text-muted-foreground sm:text-right">
                      {data.primaryBorrower.email && <div>{data.primaryBorrower.email}</div>}
                      {data.primaryBorrower.phone && <div>{data.primaryBorrower.phone}</div>}
                    </div>
                  )}
                </div>
                {(data.primaryBorrower.cin || data.primaryBorrower.gstin || data.primaryBorrower.occupationOrBusinessType) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground pt-1">
                    {data.primaryBorrower.occupationOrBusinessType && (
                      <span className="capitalize">
                        {data.primaryBorrower.borrowerType === "individual" ? "Occupation" : "Business Type"}:{" "}
                        <span className="text-foreground font-medium">
                          {data.primaryBorrower.occupationOrBusinessType.replace(/_/g, " ")}
                        </span>
                      </span>
                    )}
                    {data.primaryBorrower.cin && (
                      <span>
                        CIN: <span className="text-foreground font-mono font-medium">{data.primaryBorrower.cin}</span>
                      </span>
                    )}
                    {data.primaryBorrower.gstin && (
                      <span>
                        GSTIN: <span className="text-foreground font-mono font-medium">{data.primaryBorrower.gstin}</span>
                      </span>
                    )}
                  </div>
                )}
                {data.primaryBorrower.address && (
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    📍 {data.primaryBorrower.address}
                    {data.primaryBorrower.city && `, ${data.primaryBorrower.city}`}
                  </p>
                )}
              </div>

              {/* Co-Borrowers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Co-Borrowers ({data.coBorrowers.length})
                  </span>
                </div>
                {data.coBorrowers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed">
                    No co-borrowers assigned to this facility.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.coBorrowers.map((cb, idx) => (
                      <div key={cb.id || idx} className="p-3 rounded-lg border bg-card space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">{cb.name}</span>
                          {cb.borrowerType && (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {cb.borrowerType}
                            </Badge>
                          )}
                        </div>
                        {cb.pan && (
                          <p className="text-[11px] font-mono text-muted-foreground">PAN: {cb.pan}</p>
                        )}
                        {(cb.email || cb.phone) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[cb.email, cb.phone].filter(Boolean).join(" • ")}
                          </p>
                        )}
                        {cb.address && (
                          <p className="text-[11px] text-muted-foreground">
                            📍 {cb.address}
                            {cb.city && `, ${cb.city}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Guarantors & Security Providers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Guarantors &amp; Security Providers ({data.guarantors.length})
                  </span>
                </div>
                {data.guarantors.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic bg-muted/10 p-3 rounded-lg border border-dashed">
                    No individual or corporate guarantors attached to this facility.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.guarantors.map((g, idx) => (
                      <div key={g.id || idx} className="p-3 rounded-lg border bg-card space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">{g.name}</span>
                          <div className="flex items-center gap-1">
                            {g.isSecurityProvider && (
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                Security Provider
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {g.guaranteeType}
                            </Badge>
                          </div>
                        </div>
                        {g.pan && (
                          <p className="text-[11px] font-mono text-muted-foreground">PAN: {g.pan}</p>
                        )}
                        {(g.email || g.phone) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[g.email, g.phone].filter(Boolean).join(" • ")}
                          </p>
                        )}
                        {g.address && (
                          <p className="text-[11px] text-muted-foreground">
                            📍 {g.address}
                            {g.city && `, ${g.city}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Collaterals (if any) */}
              {data.collaterals.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pledged Collateral Assets ({data.collaterals.length})
                  </span>
                  <div className="space-y-2">
                    {data.collaterals.map((c, idx) => (
                      <div key={c.id || idx} className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">{c.collateralType}</span>
                            {c.chargeType && <Badge variant="secondary" className="text-[10px]">{c.chargeType}</Badge>}
                            {c.propertyStatus && <Badge variant="outline" className="text-[10px]">{c.propertyStatus}</Badge>}
                          </div>
                          {c.address && <p className="text-xs text-muted-foreground">📍 {c.address}</p>}
                        </div>
                        {c.estimatedValue > 0 && (
                          <div className="text-right shrink-0">
                            <div className="text-[11px] text-muted-foreground">Estimated Value</div>
                            <div className="text-xs font-bold font-mono text-primary">
                              ₹ {c.estimatedValue.toLocaleString("en-IN")}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Supported Documents Upload Center */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary" />
                  Supported Documents Center (KYC &amp; Financials)
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload all required regulatory KYC identifiers, financial statements, and supporting schedules.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {data.documents.length} Uploaded
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-6">
            {/* Required Documents Checklist */}
            <div className="rounded-xl border bg-muted/10 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Documents Checklist
                </h3>
                <Badge
                  className={`text-[10px] font-mono ${mandatoryDone === mandatoryTotal
                      ? "bg-emerald-600 text-white border-0"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    }`}
                >
                  {mandatoryDone}/{mandatoryTotal} Mandatory
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <ChecklistChip done={hasPan} label="PAN" />
                <ChecklistChip done={hasIdProof} label="Aadhaar/Passport/DL" />
                <ChecklistChip done={hasNetWorth} label="Net Worth Cert." optional />
                <ChecklistChip done={hasFinancials} label="ITR (Signed)" optional />
                {isCorporate &&
                  CORPORATE_CHIP_LABELS.map(({ value, label }) => (
                    <ChecklistChip
                      key={value}
                      done={primaryDocs.some((d) => d.category === value)}
                      label={label}
                    />
                  ))}
              </div>
            </div>

            {/* Upload Selector Box */}
            <div className="p-4 sm:p-5 rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 dark:bg-primary/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(DOCUMENT_GROUPS) as DocumentGroupKey[])
                    .filter((key) => key !== "corporate" || isCorporate)
                    .map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleGroupChange(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${docGroup === key
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-card text-muted-foreground hover:text-foreground border"
                          }`}
                      >
                        {DOCUMENT_GROUPS[key].label}
                      </button>
                    ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Accepted formats: <span className="font-medium text-foreground">PDF, JPEG, PNG, Excel</span> (Max 30MB)
                </div>
              </div>

              {/* Party / Category Dropdowns */}
              <div className={`grid grid-cols-1 gap-3 ${parties.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {parties.length > 1 && (
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Document Belongs To
                    </label>
                    <select
                      value={partyId}
                      onChange={(e) => setPartyId(e.target.value)}
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium text-foreground shadow-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Document Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium text-foreground shadow-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    {DOCUMENT_GROUPS[docGroup].items.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Select File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                    className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 shadow-xs cursor-pointer"
                  />
                </div>
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-muted-foreground truncate max-w-sm">
                  {selectedFile ? (
                    <span className="text-foreground font-medium">
                      Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                    </span>
                  ) : (
                    <span>No file selected yet.</span>
                  )}
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  size="sm"
                  className="gap-1.5 text-xs font-semibold h-9 px-4 shadow-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="size-3.5" />
                      Upload Document
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* List of Uploaded Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Uploaded Facility Documents ({data.documents.length})
              </h3>

              {data.documents.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed text-xs text-muted-foreground bg-muted/5 space-y-1.5">
                  <FileCheck2 className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-foreground">No documents uploaded yet</p>
                  <p className="text-[11px]">
                    Use the upload box above to attach your PAN, Aadhaar/Passport, Bank Statements, and Financials.
                  </p>
                </div>
              ) : parties.length > 1 ? (
                <div className="space-y-4">
                  {parties.map((p) => {
                    const partyDocs = data.documents.filter((d) => d.borrowerId === p.id);
                    if (partyDocs.length === 0) return null;
                    return (
                      <div key={p.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{p.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {p.role}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">({partyDocs.length})</span>
                        </div>
                        <div className="divide-y rounded-xl border bg-card overflow-hidden">
                          {partyDocs.map((doc) => (
                            <DocumentRow
                              key={doc.id}
                              doc={doc}
                              onView={handleView}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y rounded-xl border bg-card overflow-hidden">
                  {data.documents.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} onView={handleView} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Review Confirmation & Sign-Off Section */}
        <Card className="shadow-xs border-primary/25 bg-card">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Borrower Sign-Off &amp; Facility Acknowledgment
            </CardTitle>
            <CardDescription className="text-xs">
              Confirm that facility terms have been cross-checked and documentation submitted is authentic.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {confirmSuccess ? (
              <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                  <CheckCircle2 className="size-4" />
                  Review was confirmed on {data.borrowerReviewedAt ? new Date(data.borrowerReviewedAt).toLocaleString("en-IN") : "Record"}
                </div>
                {data.borrowerReviewNotes && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground mr-1">Your Submission Notes:</span>
                    <p className="mt-1 p-2.5 rounded-lg bg-card border text-foreground italic">
                      &ldquo;{data.borrowerReviewNotes}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground block">
                    Review Notes / Remarks for Underwriting Team (Optional)
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    // placeholder="e.g. Attached bank statements for ICICI & HDFC accounts. Q4 audited financials will be provided by Friday."
                    rows={3}
                    className="text-xs resize-none"
                  />
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={documentConsent}
                      onChange={(e) => setDocumentConsent(e.target.checked)}
                      className="mt-0.5 size-4 rounded-md border-primary text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-foreground leading-relaxed">
                      I consent to sharing the KYC, net worth, financial, and corporate documents uploaded above with
                      the lending institution for the purpose of credit assessment, underwriting, and compliance
                      with applicable KYC / AML regulations.
                    </span>
                  </label>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="mt-0.5 size-4 rounded-md border-primary text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-foreground leading-relaxed">
                      I have reviewed the wholesale facility terms, obligor structure, and collateral details stated above.
                      I confirm that all uploaded documents and financial declarations are genuine, accurate, and complete.
                    </span>
                  </label>
                </div>

                {confirmError && (
                  <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{confirmError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end pt-2">
                  <Button
                    onClick={handleConfirmReview}
                    disabled={!acknowledged || !documentConsent || !allRequiredDocsComplete || isConfirming}
                    className="gap-2 text-xs font-semibold h-10 px-5 shadow-xs"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Submitting Confirmation...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4" />
                        Confirm Facility Terms &amp; Submit Documents
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
