import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/layout/nav-bar";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="mx-auto max-w-6xl p-6">
        <PageHeader
          title="Dashboard"
          description="Manage borrower profiles and loan applications."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Borrowers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Create and manage Individual, Corporate, and Other borrower profiles.
              </p>
              <Link href="/borrowers" className={cn(buttonVariants())}>
                View borrowers
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Loan Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Originate new loan applications and track their approval status.
              </p>
              <Link href="/loans" className={cn(buttonVariants({ variant: "outline" }))}>
                View loan applications
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
