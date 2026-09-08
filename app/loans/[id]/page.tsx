import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitLoanApplication } from "@/app/loans/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { unwrapRelation } from "@/lib/utils";

type EmbeddedBorrower = {
  id: string;
  borrower_code?: string;
  borrower_type: string;
  individual_profiles: any;
  corporate_profiles: any;
  other_profiles: any;
};

function displayName(borrowers: any) {
  const borrower = unwrapRelation<EmbeddedBorrower>(borrowers);
  if (!borrower) return "—";
  const ind = unwrapRelation<{ full_name: string }>(borrower.individual_profiles);
  const corp = unwrapRelation<{ legal_name: string }>(borrower.corporate_profiles);
  const oth = unwrapRelation<{ entity_name: string }>(borrower.other_profiles);
  return (
    ind?.full_name ??
    corp?.legal_name ??
    oth?.entity_name ??
    borrower.borrower_code ??
    "—"
  );
}

export default async function LoanApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, purpose, status, submitted_at, created_at,
       borrower_id,
       borrowers (
         id, borrower_code, borrower_type,
         individual_profiles ( full_name ),
         corporate_profiles ( legal_name ),
         other_profiles ( entity_name )
       )`,
    )
    .eq("id", id)
    .single();

  if (!application) notFound();

  const borrower = unwrapRelation<EmbeddedBorrower>(application.borrowers);
  const submitAction = submitLoanApplication.bind(null, application.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <Link href="/loans" className="text-sm font-medium text-muted-foreground hover:underline">
          &larr; Loan applications
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="font-mono text-lg font-semibold tracking-tight">
            {application.application_code}
          </h1>
          <Badge variant="secondary" className="capitalize">
            {application.status.replace("_", " ")}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Borrower</dt>
                <dd className="text-sm">
                  {borrower ? (
                    <Link href={`/borrowers/${borrower.id}`} className="font-medium hover:underline">
                      {displayName(application.borrowers)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Borrower type</dt>
                <dd className="text-sm capitalize">{borrower?.borrower_type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Requested amount</dt>
                <dd className="text-sm">
                  {Number(application.requested_amount).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Purpose</dt>
                <dd className="text-sm">{application.purpose ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {application.status === "draft" && (
          <form action={submitAction}>
            <Button type="submit">Submit for approval</Button>
          </form>
        )}
      </main>
    </div>
  );
}
