import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/layout/nav-bar";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, unwrapRelation, type Relation } from "@/lib/utils";

type EmbeddedBorrower = {
  individual_profiles: Relation<{ full_name: string }>;
  corporate_profiles: Relation<{ legal_name: string }>;
  other_profiles: Relation<{ entity_name: string }>;
};

function displayName(borrowers: Relation<EmbeddedBorrower>) {
  const borrower = unwrapRelation<EmbeddedBorrower>(borrowers);
  if (!borrower) return "—";
  const ind = unwrapRelation<{ full_name: string }>(borrower.individual_profiles);
  const corp = unwrapRelation<{ legal_name: string }>(borrower.corporate_profiles);
  const oth = unwrapRelation<{ entity_name: string }>(borrower.other_profiles);
  return (
    ind?.full_name ??
    corp?.legal_name ??
    oth?.entity_name ??
    "—"
  );
}

export default async function LoanApplicationsPage() {
  const supabase = await createClient();

  const { data: applications, error } = await supabase
    .from("loan_applications")
    .select(
      `id, application_code, requested_amount, status, created_at,
       borrowers (
         individual_profiles ( full_name ),
         corporate_profiles ( legal_name ),
         other_profiles ( entity_name )
       )`,
    )
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Loan Applications"
          description="Origination pipeline"
          actions={
            <Link href="/loans/new" className={cn(buttonVariants())}>
              + New origination
            </Link>
          }
        />

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {applications && applications.length === 0 && (
          <p className="text-sm text-muted-foreground">No loan applications yet.</p>
        )}

        {applications && applications.length > 0 && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application #</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Link
                        href={`/loans/${application.id}`}
                        className="font-mono text-xs font-medium hover:underline"
                      >
                        {application.application_code}
                      </Link>
                    </TableCell>
                    <TableCell>{displayName(application.borrowers)}</TableCell>
                    <TableCell>
                      {Number(application.requested_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {application.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
