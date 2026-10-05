import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Calendar, Landmark } from "lucide-react";
import { getLoanServicingSummary } from "./repayment-actions";
import { RepaymentClient } from "./repayment-client";

export default async function RepaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const summary = await getLoanServicingSummary(id);
  if (!summary) notFound();

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
                <Link href={`/loans/${id}`} className="hover:underline">{summary.applicationCode}</Link>
                <ChevronRight className="size-3" />
                <Link href={`/loans/${id}/cam`} className="hover:underline">CAM</Link>
                <ChevronRight className="size-3" />
                <Link href={`/loans/${id}/sanction`} className="hover:underline">Sanction</Link>
                <ChevronRight className="size-3" />
                <span className="text-foreground font-semibold">Repayment & Servicing</span>
              </div>
              <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                Repayment Schedule & Servicing — {summary.borrowerName}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
        <RepaymentClient applicationId={id} initialSummary={summary} />
      </main>
    </div>
  );
}
