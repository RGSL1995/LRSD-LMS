import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Landmark, ShieldCheck, Users, FileCheck2 } from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Borrower Profiles",
    description: "Individual, corporate, and other entity profiles in one place.",
  },
  {
    icon: FileCheck2,
    title: "Loan Origination",
    description: "PAN-based lookup, application tracking, and structured workflows.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Approvals",
    description: "Role-based review and approval with a full audit trail.",
  },
];

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary), transparent 92%), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.35] [mask-image:radial-gradient(60%_50%_at_50%_20%,black,transparent)]"
      />

      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm ring-1 ring-black/5">
          <Landmark className="size-7" />
        </div>

        <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Internal Use Only
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          LRSD Capital
        </h1>
        <p className="mt-4 max-w-md text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
          The internal Loan Management System for LRSD Capital — manage borrower
          profiles, originate loans, and route approvals in one secure workspace.
        </p>

        <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "mt-8 px-8")}>
          Employee sign in
        </Link>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border bg-card/60 p-4 text-left shadow-sm backdrop-blur-sm"
            >
              <Icon className="size-5 text-primary" />
              <p className="mt-3 text-sm font-medium">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="absolute bottom-6 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} LRSD Capital. Internal system — authorized
        employees only.
      </p>
    </div>
  );
}
