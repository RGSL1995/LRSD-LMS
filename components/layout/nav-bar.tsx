import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavLinks } from "./nav-links";
import { Landmark, LogOut } from "lucide-react";

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

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "LC";

  return (
    <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-2.5">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs group-hover:scale-105 transition-transform duration-150">
              <Landmark className="size-4.5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  LRSD Capital
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 h-3.5 font-semibold bg-primary/5 text-primary border-primary/20 uppercase"
                >
                  LMS
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground -mt-0.5 hidden sm:block">
                Loan Management System
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <NavLinks />
        </div>

        {/* User Profile & Actions */}
        {profile && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-border/80">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                {initials}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-tight text-foreground">
                  {profile.full_name}
                </p>
                <span className="text-[10px] capitalize text-muted-foreground font-medium block">
                  {profile.role.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                title="Sign out of system"
              >
                <LogOut className="size-3.5" />
                <span className="hidden md:inline">Sign out</span>
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
