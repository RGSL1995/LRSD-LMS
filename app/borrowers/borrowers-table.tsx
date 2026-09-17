"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteBorrowerButton } from "./[id]/delete-borrower-button";
import { cn, unwrapRelation, type Relation } from "@/lib/utils";
import {
  Search,
  Building2,
  User,
  PlusCircle,
  CreditCard,
  Eye,
  Briefcase,
  Users,
} from "lucide-react";
import { BorrowerAvatar } from "@/components/ui/borrower-avatar";

export type BorrowerRow = {
  id: string;
  borrower_code: string;
  borrower_type: string;
  status: string;
  created_at: string;
  avatar_url?: string | null;
  individual_profiles: Relation<{ full_name: string }>;
  corporate_profiles: Relation<{ legal_name: string }>;
  other_profiles: Relation<{ entity_name: string }>;
};

function getDisplayName(borrower: BorrowerRow) {
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

export function BorrowersTable({ borrowers }: { borrowers: BorrowerRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "corporate" | "individual" | "other">("all");

  const corporateCount = borrowers.filter((b) => b.borrower_type === "corporate").length;
  const individualCount = borrowers.filter((b) => b.borrower_type === "individual").length;

  const filtered = borrowers.filter((b) => {
    const name = getDisplayName(b).toLowerCase();
    const code = (b.borrower_code || "").toLowerCase();
    const query = search.toLowerCase();
    const matchesQuery = name.includes(query) || code.includes(query);
    const matchesType = typeFilter === "all" || b.borrower_type === typeFilter;
    return matchesQuery && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-2xs">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            variant={typeFilter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("all")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            All <span className="opacity-70 text-[11px]">({borrowers.length})</span>
          </Button>
          <Button
            type="button"
            variant={typeFilter === "corporate" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("corporate")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            <Building2 className="size-3.5" /> Corporate
            <span className="opacity-70 text-[11px]">({corporateCount})</span>
          </Button>
          <Button
            type="button"
            variant={typeFilter === "individual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setTypeFilter("individual")}
            className="h-8 text-xs font-semibold px-3 gap-1.5"
          >
            <User className="size-3.5" /> Individual
            <span className="opacity-70 text-[11px]">({individualCount})</span>
          </Button>
        </div>

        {/* Live Search */}
        <div className="relative w-full sm:w-64">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or code..."
            className="h-8 text-xs pl-8 bg-background"
          />
        </div>
      </div>

      {/* Borrowers Data Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {filtered.length > 0 ? (
          <Table>
            <TableHeader className="bg-muted/50 border-b">
              <TableRow>
                <TableHead className="w-[120px]">Code</TableHead>
                <TableHead>Borrower Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((borrower) => {
                const name = getDisplayName(borrower);
                const isCorp = borrower.borrower_type === "corporate";

                return (
                  <TableRow key={borrower.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                      {borrower.borrower_code}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <BorrowerAvatar
                          borrowerId={borrower.id}
                          name={name}
                          type={borrower.borrower_type}
                          avatarUrl={borrower.avatar_url}
                          size="sm"
                        />
                        <Link
                          href={`/borrowers/${borrower.id}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors text-xs sm:text-sm truncate max-w-[240px]"
                        >
                          {name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize px-2 py-0.5 font-medium inline-flex items-center gap-1",
                          isCorp
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                            : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
                        )}
                      >
                        {isCorp ? <Building2 className="size-3" /> : <User className="size-3" />}
                        {borrower.borrower_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize px-2 py-0.5 font-semibold",
                          borrower.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
                        )}
                      >
                        {borrower.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/loans/new?borrower_id=${borrower.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-7 px-2 text-[11px] text-muted-foreground hover:text-primary gap-1",
                          )}
                          title="Originate Loan for this borrower"
                        >
                          <CreditCard className="size-3" />
                          <span className="hidden sm:inline">Originate</span>
                        </Link>
                        <Link
                          href={`/borrowers/${borrower.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 px-2.5 text-[11px] gap-1 font-semibold",
                          )}
                        >
                          <Eye className="size-3" />
                          <span>Profile</span>
                        </Link>
                        <DeleteBorrowerButton borrowerId={borrower.id} variant="destructive" size="sm" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-10 text-center text-muted-foreground">
            <Users className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No borrowers found</p>
            <p className="text-xs mt-0.5">
              {search ? "Try adjusting your search criteria" : "Register your first borrower to get started"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
