"use client";

import { useState, useRef, useTransition } from "react";
import { getInternalDocumentUrl, uploadStaffDocument } from "@/app/portal/portal-actions";
import { DOCUMENT_GROUPS, type DocumentGroupKey, ALL_CATEGORY_LABELS } from "@/app/portal/document-categories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SharePortalDialog } from "./share-portal-dialog";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Clock,
  UserCheck,
  Building,
  UploadCloud,
  Loader2,
} from "lucide-react";

export type BorrowerDocumentItem = {
  id: string;
  borrower_id?: string;
  stage: string;
  category: string;
  file_name: string;
  storage_path: string;
  file_size?: number | null;
  uploaded_at: string;
  uploaded_by_borrower?: boolean;
};

export type DocumentParty = { id: string; name: string; role: string };

interface BorrowerDocumentsCardProps {
  applicationId: string;
  applicationCode: string;
  borrowerName: string;
  portalStatus: string;
  borrowerReviewedAt?: string | null;
  borrowerReviewNotes?: string | null;
  documents: BorrowerDocumentItem[];
  parties: DocumentParty[];
  isCorporate: boolean;
}

// Legacy categories from the pre-4-group flow, kept so older uploads still show a friendly label.
const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  identity_proof: "Identity Proof (Aadhaar/Passport)",
  address_proof: "Address Proof",
  photograph: "Photograph",
  company_incorporation_docs: "Incorporation / MOA / AOA",
  shareholder_director_list: "Shareholder / Director List",
  itr_or_form16: "ITR / Computations",
  salary_slips: "Salary Slips",
  bank_statement: "Bank Account Statement",
  balance_sheet_pl: "Audited Balance Sheet & P&L",
  other: "Supporting Document",
};

function categoryLabel(category: string): string {
  const match = ALL_CATEGORY_LABELS.find((c) => c.value === category);
  return match?.label || LEGACY_CATEGORY_NAMES[category] || category;
}

function formatBytes(bytes?: number | null) {
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

function DocRow({
  doc,
  openingId,
  onOpen,
}: {
  doc: BorrowerDocumentItem;
  openingId: string | null;
  onOpen: (docId: string, storagePath: string) => void;
}) {
  const friendlyCat = categoryLabel(doc.category);

  return (
    <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="size-9 rounded-lg bg-muted/40 border flex items-center justify-center shrink-0">
          {getFileIcon(doc.file_name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-xs text-foreground truncate max-w-xs sm:max-w-md">
              {doc.file_name}
            </span>
            <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wider">
              {doc.stage}
            </Badge>
            {doc.uploaded_by_borrower ? (
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 gap-1">
                <UserCheck className="size-2.5" />
                Customer Upload
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                <Building className="size-2.5" />
                Staff Upload
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{friendlyCat}</span>
            {doc.file_size && <span>• {formatBytes(doc.file_size)}</span>}
            <span>• {new Date(doc.uploaded_at).toLocaleDateString("en-IN")}</span>
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={openingId === doc.id}
        onClick={() => onOpen(doc.id, doc.storage_path)}
        className="h-8 px-3 text-xs gap-1.5 font-medium shrink-0 self-end sm:self-center"
      >
        <ExternalLink className="size-3" />
        {openingId === doc.id ? "Opening..." : "View Document"}
      </Button>
    </div>
  );
}

export function BorrowerDocumentsCard({
  applicationId,
  applicationCode,
  borrowerName,
  portalStatus,
  borrowerReviewedAt,
  borrowerReviewNotes,
  documents: initialDocuments,
  parties,
  isCorporate,
}: BorrowerDocumentsCardProps) {
  const [documents, setDocuments] = useState<BorrowerDocumentItem[]>(initialDocuments);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const primaryParty = parties[0];
  const [docGroup, setDocGroup] = useState<DocumentGroupKey>("kyc");
  const [category, setCategory] = useState<string>(DOCUMENT_GROUPS.kyc.items[0].value);
  const [partyId, setPartyId] = useState<string>(primaryParty?.id || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleGroups = (Object.keys(DOCUMENT_GROUPS) as DocumentGroupKey[]).filter(
    (key) => key !== "corporate" || isCorporate,
  );

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
        const response = await fetch("/api/documents/upload", {
          method: "POST",
          headers: {
            "x-application-id": applicationId,
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

        setDocuments((prev) => [
          {
            id: res.document!.id,
            borrower_id: res.document!.borrowerId,
            stage: res.document!.stage,
            category: res.document!.category,
            file_name: res.document!.fileName,
            storage_path: res.document!.storagePath,
            file_size: res.document!.fileSize,
            uploaded_at: res.document!.uploadedAt,
            uploaded_by_borrower: false,
          },
          ...prev,
        ]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        setUploadError(errorObj?.message || "Upload failed. Please try again.");
      }
    });
  };

  const handleOpenDoc = async (docId: string, storagePath: string) => {
    setOpeningId(docId);
    try {
      const res = await getInternalDocumentUrl(storagePath);
      if (res.success && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        alert(res.error || "Failed to open document.");
      }
    } finally {
      setOpeningId(null);
    }
  };

  const borrowerUploadedCount = documents.filter((d) => d.uploaded_by_borrower).length;

  return (
    <Card className="shadow-xs border-border/80">
      <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Document Compliance &amp; Verification
            </span>
            <Badge variant="secondary" className="font-mono text-[10px]">
              {documents.length} Files
            </Badge>
          </div>
          <CardTitle className="text-lg mt-0.5">
            Supported Documents &amp; Borrower Submissions
          </CardTitle>
          <CardDescription>
            KYC proofs, financial statements, and documents submitted by {borrowerName} via the review portal.
          </CardDescription>
        </div>

        <SharePortalDialog
          applicationId={applicationId}
          applicationCode={applicationCode}
          borrowerName={borrowerName}
          portalStatus={portalStatus}
        />
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Portal Status Alert Box */}
        {portalStatus === "confirmed" ? (
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-start gap-3 text-xs">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <div className="font-semibold flex items-center gap-2">
                <span>Borrower Verified &amp; Confirmed Facility</span>
                {borrowerReviewedAt && (
                  <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400 font-mono">
                    ({new Date(borrowerReviewedAt).toLocaleString("en-IN")})
                  </span>
                )}
              </div>
              {borrowerReviewNotes && (
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic bg-card/60 p-2 rounded-lg border border-emerald-500/20">
                  Borrower Remarks: &ldquo;{borrowerReviewNotes}&rdquo;
                </p>
              )}
            </div>
          </div>
        ) : portalStatus === "documents_uploaded" ? (
          <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 flex items-start gap-3 text-xs">
            <FileCheck2 className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Borrower Has Uploaded Supporting Documents</span>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                {borrowerUploadedCount} files uploaded by customer. Final sign-off is pending from borrower side.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-dashed bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-500 shrink-0" />
              <span>
                Review link not yet confirmed. Share the secure portal link with the borrower to cross-check terms &amp; collect KYC/Financial docs.
              </span>
            </div>
            <SharePortalDialog
              applicationId={applicationId}
              applicationCode={applicationCode}
              borrowerName={borrowerName}
              portalStatus={portalStatus}
              triggerVariant="secondary"
              triggerSize="xs"
              className="shrink-0 text-xs"
            />
          </div>
        )}

        {/* Staff Upload Panel */}
        <div className="p-4 rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 dark:bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Upload on Behalf of Borrower</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {visibleGroups.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleGroupChange(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  docGroup === key
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground border"
                }`}
              >
                {DOCUMENT_GROUPS[key].label}
              </button>
            ))}
          </div>

          <div className={`grid grid-cols-1 gap-3 ${parties.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {parties.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Document Belongs To</label>
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
              <label className="text-xs font-semibold text-foreground block mb-1">Document Category</label>
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
              <label className="text-xs font-semibold text-foreground block mb-1">Select File</label>
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

        {/* Documents Table / List */}
        {documents.length === 0 ? (
          <div className="text-center py-8 rounded-xl border border-dashed text-xs text-muted-foreground bg-muted/5 space-y-1.5">
            <FileText className="size-8 mx-auto text-muted-foreground/40 mb-1" />
            <p className="font-semibold text-foreground">No documents uploaded for this facility yet</p>
            <p className="text-[11px]">
              Use &ldquo;Share with Borrower&rdquo; to send a self-service upload link, or upload directly above.
            </p>
          </div>
        ) : parties.length > 1 ? (
          <div className="space-y-4">
            {parties.map((p) => {
              const partyDocs = documents.filter((d) => d.borrower_id === p.id);
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
                      <DocRow key={doc.id} doc={doc} openingId={openingId} onOpen={handleOpenDoc} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {documents.map((doc) => (
              <DocRow key={doc.id} doc={doc} openingId={openingId} onOpen={handleOpenDoc} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
