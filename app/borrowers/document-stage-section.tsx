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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [, startLoad] = useTransition();

  function refresh() {
    startLoad(async () => {
      const docs = await getBorrowerDocuments(borrowerId, stage);
      setDocuments(docs);
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
  onChange,
}: {
  borrowerId: string;
  stage: DocumentStage;
  category: string;
  documents: BorrowerDocument[];
  onChange: () => void;
}) {
  const [state, formAction, pending] = useActionState(uploadBorrowerDocument, initialState);
  const [lastHandled, setLastHandled] = useState(state);

  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.error === null) onChange();
  }

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">{CATEGORY_LABELS[category] ?? category}</p>

      {documents.length > 0 && (
        <ul className="mb-3 space-y-1">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} document={doc} borrowerId={borrowerId} onChange={onChange} />
          ))}
        </ul>
      )}

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="borrower_id" value={borrowerId} />
        <input type="hidden" name="stage" value={stage} />
        <input type="hidden" name="category" value={category} />
        <input
          type="file"
          name="file"
          required
          className="flex-1 text-xs file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Uploading..." : "Upload"}
        </Button>
      </form>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
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
    <li className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs">
      <button type="button" onClick={handleView} className="truncate text-left hover:underline">
        {document.file_name}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="ml-2 shrink-0 text-destructive hover:underline"
      >
        Remove
      </button>
    </li>
  );
}
