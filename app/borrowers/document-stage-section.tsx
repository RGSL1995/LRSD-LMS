"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  uploadBorrowerDocument,
  deleteBorrowerDocument,
  getBorrowerDocuments,
  getDocumentUrl,
  type DocumentUploadState,
  type BorrowerDocument,
} from "@/app/borrowers/documents-actions";
import { CATEGORY_LABELS, categoriesFor, type BorrowerType, type DocumentStage } from "./document-categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ChevronDown, ChevronUp, Upload, Loader2, FileText, Trash2 } from "lucide-react";

const initialState: DocumentUploadState = { error: null };

export function DocumentStageSection({
  borrowerId,
  borrowerType,
  stage,
  title,
  bare = false,
}: {
  borrowerId: string;
  borrowerType: BorrowerType;
  stage: DocumentStage;
  title: string;
  bare?: boolean;
}) {
  const [documents, setDocuments] = useState<BorrowerDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, startLoad] = useTransition();

  function refresh() {
    startLoad(async () => {
      const docs = await getBorrowerDocuments(borrowerId, stage);
      setDocuments(docs);
      setLoaded(true);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId, stage]);

  const categories = categoriesFor(stage, borrowerType);

  const rows = categories.map((category) => (
    <CategoryRow
      key={category}
      borrowerId={borrowerId}
      stage={stage}
      category={category}
      documents={documents.filter((d) => d.category === category)}
      isInitialLoading={!loaded}
      onChange={refresh}
    />
  ));

  if (bare) {
    return <div className="space-y-4">{rows}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{rows}</CardContent>
    </Card>
  );
}

function CategoryRow({
  borrowerId,
  stage,
  category,
  documents,
  isInitialLoading = false,
  onChange,
}: {
  borrowerId: string;
  stage: DocumentStage;
  category: string;
  documents: BorrowerDocument[];
  isInitialLoading?: boolean;
  onChange: () => void;
}) {
  const [state, formAction, pending] = useActionState(uploadBorrowerDocument, initialState);
  const [lastHandled, setLastHandled] = useState(state);
  const [manuallyToggled, setManuallyToggled] = useState<boolean | null>(null);

  const hasDocuments = documents.length > 0;
  // If user explicitly toggled, respect user action.
  // When loading saved profiles, keep de-expanded until docs are retrieved to prevent UI flicker.
  // Once loaded, de-expand if documents exist, or expand if pending upload.
  const isExpanded =
    manuallyToggled !== null
      ? manuallyToggled
      : isInitialLoading
      ? false
      : !hasDocuments;

  useEffect(() => {
    if (documents.length === 0) {
      setManuallyToggled(null);
    }
  }, [documents.length]);

  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.error === null) {
      // Auto de-expand upon successful upload
      setManuallyToggled(false);
      onChange();
    }
  }

  return (
    <div className="rounded-md border p-3 bg-background">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </span>
          {hasDocuments ? (
            <Badge
              variant="outline"
              className="text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 gap-1 font-medium"
            >
              <CheckCircle2 className="size-3" /> Uploaded ({documents.length})
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground font-normal">
              Pending Upload
            </Badge>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant={isExpanded ? "secondary" : "outline"}
          onClick={() => setManuallyToggled(!isExpanded)}
          className="h-7 px-2.5 text-xs gap-1.5 shrink-0 self-start sm:self-auto"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-3.5" />
              <span>Collapse</span>
            </>
          ) : (
            <>
              <Upload className="size-3.5 text-primary" />
              <span>{hasDocuments ? "Upload Another" : "Upload File"}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </>
          )}
        </Button>
      </div>

      {hasDocuments && (
        <ul className="mt-2.5 space-y-1.5">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} document={doc} borrowerId={borrowerId} onChange={onChange} />
          ))}
        </ul>
      )}

      {isExpanded && (
        <div className="mt-3 pt-3 border-t">
          <form action={formAction} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input type="hidden" name="borrower_id" value={borrowerId} />
            <input type="hidden" name="stage" value={stage} />
            <input type="hidden" name="category" value={category} />
            <input
              type="file"
              name="file"
              required
              className="flex-1 text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/50 cursor-pointer"
            />
            <div className="flex items-center gap-1.5">
              <Button type="submit" size="sm" disabled={pending} className="gap-1.5 text-xs h-8">
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    <span>Upload</span>
                  </>
                )}
              </Button>
              {hasDocuments && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setManuallyToggled(false)}
                  className="text-xs text-muted-foreground h-8"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
          {state.error && <p className="mt-1.5 text-xs text-destructive">{state.error}</p>}
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  document,
  borrowerId,
  onChange,
}: {
  document: BorrowerDocument;
  borrowerId: string;
  onChange: () => void;
}) {
  async function handleView() {
    const url = await getDocumentUrl(document.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    const formData = new FormData();
    formData.set("document_id", document.id);
    formData.set("borrower_id", borrowerId);
    formData.set("storage_path", document.storage_path);
    await deleteBorrowerDocument(formData);
    onChange();
  }

  return (
    <li className="flex items-center justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
      <button
        type="button"
        onClick={handleView}
        className="flex items-center gap-1.5 truncate text-left font-medium text-foreground hover:text-primary hover:underline"
      >
        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{document.file_name}</span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="ml-2 inline-flex items-center gap-1 shrink-0 text-muted-foreground hover:text-destructive text-xs transition-colors"
      >
        <Trash2 className="size-3" />
        <span>Remove</span>
      </button>
    </li>
  );
}
