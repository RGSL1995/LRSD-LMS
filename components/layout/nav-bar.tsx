import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/borrowers", label: "Borrowers" },
  { href: "/loans", label: "Loan Applications" },
];

export async function NavBar() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single()
      ).data
    : null;

  return (
    <header className="sticky top-0 z-10 border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold tracking-tight">LRSD Capital</span>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {profile && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium leading-none">{profile.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{profile.role}</p>
            </div>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
