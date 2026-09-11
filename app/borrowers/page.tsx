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
import { DeleteBorrowerButton } from "./[id]/delete-borrower-button";

function displayName(borrower: {
  borrower_type: string;
  individual_profiles: Relation<{ full_name: string }>;
  corporate_profiles: Relation<{ legal_name: string }>;
  other_profiles: Relation<{ entity_name: string }>;
}) {
  const ind = unwrapRelation<{ full_name: string }>(borrower.individual_profiles);
  const corp = unwrapRelation<{ legal_name: string }>(borrower.corporate_profiles);
  const oth = unwrapRelation<{ entity_name: string }>(borrower.other_profiles);

  if (borrower.borrower_type === "individual") {
    return ind?.full_name ?? "—";
  }
  if (borrower.borrower_type === "corporate") {
    return corp?.legal_name ?? "—";
  }
  return oth?.entity_name ?? "—";
}

export default async function BorrowersPage() {
  const supabase = await createClient();

  const { data: borrowers, error } = await supabase
    .from("borrowers")
    .select(
      `id, borrower_code, borrower_type, status, created_at,
       individual_profiles ( full_name ),
       corporate_profiles ( legal_name ),
       other_profiles ( entity_name )`,
    )
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Borrowers"
          description="All borrower profiles"
          actions={
            <Link href="/borrowers/new" className={cn(buttonVariants())}>
              + New borrower
            </Link>
          }
        />

        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {borrowers && borrowers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No borrowers yet. Create the first one.
          </p>
        )}

        {borrowers && borrowers.length > 0 && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {borrowers.map((borrower) => (
                  <TableRow key={borrower.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {borrower.borrower_code}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/borrowers/${borrower.id}`}
                        className="font-medium hover:underline"
                      >
                        {displayName(borrower)}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {borrower.borrower_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {borrower.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/borrowers/${borrower.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          View / Edit
                        </Link>
                        <DeleteBorrowerButton borrowerId={borrower.id} variant="destructive" size="sm" />
                      </div>
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
