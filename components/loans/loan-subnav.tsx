"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Activity, FileText, Landmark } from "lucide-react";

export function LoanSubNav({
  pipelineCount,
  activeCount,
}: {
  pipelineCount?: number;
  activeCount?: number;
}) {
  const pathname = usePathname();
  const isRiskMonitor = pathname.startsWith("/loans/active/risk");
  const isActiveFacilities = pathname.startsWith("/loans/active") && !isRiskMonitor;

  return (
    <div className="inline-flex items-center p-1 bg-muted/70 rounded-xl border border-border/80 shadow-2xs">
      <Link
        href="/loans"
        className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
          !isActiveFacilities && !isRiskMonitor
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <FileText className="size-3.5" />
        <span>Originations Pipeline</span>
        {typeof pipelineCount === "number" && (
          <span
            className={cn(
              "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium",
              !isActiveFacilities && !isRiskMonitor
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {pipelineCount}
          </span>
        )}
      </Link>

      <Link
        href="/loans/active"
        className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
          isActiveFacilities
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Landmark className="size-3.5" />
        <span>Active Facilities (LMS)</span>
        {typeof activeCount === "number" && (
          <span
            className={cn(
              "ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium",
              isActiveFacilities
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                : "bg-muted text-muted-foreground"
            )}
          >
            {activeCount}
          </span>
        )}
      </Link>

      <Link
        href="/loans/active/risk"
        className={cn(
          "flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 sm:px-4",
          isRiskMonitor
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Activity className="size-3.5" />
        <span>LAS Risk Monitor</span>
      </Link>
    </div>
  );
}
