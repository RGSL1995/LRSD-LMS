import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ChevronRight, ShieldCheck } from "lucide-react";
import { getSanctionAutoData, getSanctionManualData } from "./sanction-actions";
import { SanctionFormClient } from "./sanction-form-client";

export default async function SanctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const autoData = await getSanctionAutoData(id);
  if (!autoData) notFound();

  const manualData = await getSanctionManualData(id);

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 pb-20">
      <header className="border-b bg-card/95 backdrop-blur-sm px-4 sm:px-8 py-3.5 sticky top-0 z-20 shadow-xs">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/loans/${id}`}
              className="size-8 rounded-lg border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
              title="Back to Loan Application"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Link href="/loans" className="hover:underline">Loans</Link>
                <ChevronRight className="size-3" />
                <Link href={`/loans/${id}`} className="hover:underline">{autoData.applicationCode}</Link>
                <ChevronRight className="size-3" />
                <Link href={`/loans/${id}/cam`} className="hover:underline">CAM</Link>
                <ChevronRight className="size-3" />
                <span className="text-foreground font-semibold">Sanction Letter</span>
              </div>
              <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Sanction Letter — {autoData.borrower.name}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
        <SanctionFormClient applicationId={id} autoData={autoData} initialManualData={manualData} />
      </main>
    </div>
  );
}
