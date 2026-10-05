import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDocumentSignedUrl } from "@/lib/storage";
import { NavBar } from "@/components/layout/nav-bar";
import { buttonVariants } from "@/components/ui/button";
import { BorrowersTable, type BorrowerRow } from "./borrowers-table";
import { cn } from "@/lib/utils";
import { PlusCircle, Building2, ArrowLeft } from "lucide-react";

export default async function BorrowersPage() {
  const supabase = await createClient();

  const { data: rawBorrowers, error } = await supabase
    .from("borrowers")
    .select(
      `id, borrower_code, borrower_type, status, created_at,
       individual_profiles ( full_name ),
       corporate_profiles ( legal_name ),
       other_profiles ( entity_name )`,
    )
    .order("created_at", { ascending: false });

  // Resolve avatars / logos in batch for directory list
  const borrowerIds = (rawBorrowers ?? []).map((b) => b.id);
  const avatarUrlMap: Record<string, string> = {};

  if (borrowerIds.length > 0) {
    const { data: avatarDocs } = await supabase
      .from("borrower_documents")
      .select("borrower_id, storage_path, file_name, category")
      .in("borrower_id", borrowerIds)
      .in("category", ["photograph", "other"])
      .order("uploaded_at", { ascending: false });

    if (avatarDocs && avatarDocs.length > 0) {
      const BUCKET = "borrower-documents";
      const latestDocPerBorrower = new Map<string, string>();

      for (const doc of avatarDocs) {
        if (!latestDocPerBorrower.has(doc.borrower_id)) {
          if (
            doc.category === "photograph" ||
            doc.file_name.toLowerCase().includes("logo") ||
            doc.storage_path.includes("/avatar/")
          ) {
            latestDocPerBorrower.set(doc.borrower_id, doc.storage_path);
          }
        }
      }

      await Promise.all(
        Array.from(latestDocPerBorrower.entries()).map(async ([bId, path]) => {
          const res = await getDocumentSignedUrl(path, 60 * 60 * 24);
          if (res.success && res.url) {
            avatarUrlMap[bId] = res.url;
          }
        }),
      );
    }
  }

  const borrowers: BorrowerRow[] = (rawBorrowers ?? []).map((b) => ({
    ...b,
    avatar_url: avatarUrlMap[b.id] ?? null,
  }));

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="size-3" /> Dashboard
              </Link>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="text-xs font-semibold text-primary">Directory</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              Borrowers Directory
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage corporate legal entities, promoters, directors, and individual borrower records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/borrowers/new"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 h-9 text-xs font-semibold shadow-xs",
              )}
            >
              <PlusCircle className="size-3.5" />
              <span>New Borrower Onboarding</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium">
            {error.message}
          </div>
        )}

        {/* Borrowers Interactive Data Grid */}
        <BorrowersTable borrowers={(borrowers as unknown as BorrowerRow[]) || []} />
      </main>
    </div>
  );
}
