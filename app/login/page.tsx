"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, ShieldCheck, Lock, ArrowRight, ArrowLeft } from "lucide-react";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 overflow-hidden">
      {/* Subtle Background Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(50% 40% at 50% 10%, color-mix(in oklch, var(--primary), transparent 90%), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.25] [mask-image:radial-gradient(60%_50%_at_50%_30%,black,transparent)]"
      />

      {/* Navigation to Home */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Home
        </Link>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-4 ring-primary/10">
            <Landmark className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            LRSD Capital
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enterprise Loan Management &middot; Authorized Personnel
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border-border/80 shadow-md backdrop-blur-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Employee Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your enterprise credentials to access loan appraisal &amp; borrower records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Work Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="officer@lrsdcapital.com"
                  autoComplete="email"
                  required
                  className="h-10 text-xs"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold">
                    Password
                  </Label>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-10 text-xs"
                />
              </div>

              {state.error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive font-medium">
                  {state.error}
                </div>
              )}

              <Button
                type="submit"
                disabled={pending}
                className="w-full h-10 text-xs font-semibold gap-2 shadow-xs"
              >
                {pending ? (
                  "Verifying Credentials..."
                ) : (
                  <>
                    Sign In to Console <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Trust Badges */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            256-Bit SSL Encrypted
          </span>
          <span>&middot;</span>
          <span className="flex items-center gap-1">
            <Lock className="size-3.5 text-blue-600" />
            Role-Based Access
          </span>
        </div>
      </div>
    </div>
  );
}
