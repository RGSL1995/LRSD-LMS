"use client";

import { useState, useEffect, useTransition } from "react";
import { FinancialReportUpload } from "@/app/borrowers/financial-report-upload";
import { DocumentStageSection } from "@/app/borrowers/document-stage-section";
import {
  addGstRecord,
  deleteGstRecord,
  getGstRecords,
  type GstRecordRow,
} from "@/app/borrowers/gst-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  ReceiptText,
  FileText,
  TrendingUp,
} from "lucide-react";
import type { BorrowerType } from "@/app/borrowers/document-categories";

export function FinancialsGstStep({
  borrowerId,
  borrowerType,
}: {
  borrowerId: string;
  borrowerType: BorrowerType;
}) {
  const [gstRecords, setGstRecords] = useState<GstRecordRow[]>([]);
  const [gstDialogOpen, setGstDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const records = await getGstRecords(borrowerId);
      setGstRecords(records);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  async function handleAddGst(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addGstRecord(formData);
    setGstDialogOpen(false);
    refresh();
  }

  async function handleDeleteGst(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("borrower_id", borrowerId);
    await deleteGstRecord(formData);
    refresh();
  }

  const totalGstTurnover = gstRecords.reduce(
    (sum, r) => sum + Number(r.taxable_turnover || 0),
    0,
  );
  const totalGstPaid = gstRecords.reduce(
    (sum, r) => sum + Number(r.total_tax_paid || 0),
    0,
  );

  return (
    <div className="space-y-8">
      {/* 1. FINANCIAL REPORT PARSER & CONSOLIDATED DATA */}
      {borrowerType === "corporate" && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">1. Financial Statements &amp; Excel Extraction</h3>
          </div>
          <FinancialReportUpload borrowerId={borrowerId} />
        </section>
      )}

      {/* 2. GST RETURNS & REVENUE RECONCILIATION */}
      {borrowerType === "corporate" && (
        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ReceiptText className="size-4 text-primary" /> 2. GST Returns &amp; Turnover Analytics
                </CardTitle>
                <CardDescription className="text-xs">
                  Monthly GSTR-3B / GSTR-1 filings to cross-verify operational revenue and tax compliance
                </CardDescription>
              </div>
              <Dialog open={gstDialogOpen} onOpenChange={setGstDialogOpen}>
                <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
                  <Plus className="size-3.5" /> Add GST Filing
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add GST Return Record</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddGst} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gstin">GSTIN *</Label>
                        <Input id="gstin" name="gstin" placeholder="27AAACB1234C1Z5" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="financial_year">Financial Year</Label>
                        <Input id="financial_year" name="financial_year" defaultValue="FY 2024-25" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="return_type">Return Form</Label>
                        <Select name="return_type" defaultValue="gstr_3b">
                          <SelectTrigger id="return_type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gstr_3b">GSTR-3B (Monthly Summary)</SelectItem>
                            <SelectItem value="gstr_1">GSTR-1 (Outward Supplies)</SelectItem>
                            <SelectItem value="gstr_9">GSTR-9 (Annual Return)</SelectItem>
                            <SelectItem value="annual_aggregate">Annual Aggregate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="period_month">Month / Period *</Label>
                        <Input id="period_month" name="period_month" placeholder="e.g. April 2024 / Q1" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="taxable_turnover">Taxable Turnover (₹) *</Label>
                        <Input
                          id="taxable_turnover"
                          name="taxable_turnover"
                          type="number"
                          step="0.01"
                          placeholder="e.g. 1500000"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="total_tax_paid">Total Tax Paid (₹)</Label>
                        <Input
                          id="total_tax_paid"
                          name="total_tax_paid"
                          type="number"
                          step="0.01"
                          placeholder="e.g. 270000"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filing_date">Filing Date</Label>
                      <Input id="filing_date" name="filing_date" type="date" />
                    </div>
                    <DialogFooter className="pt-2">
                      <Button type="button" variant="outline" onClick={() => setGstDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Save GST Filing</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Turnover Summary KPI */}
              {gstRecords.length > 0 && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Cumulative GST Turnover</span>
                    <span className="font-bold text-base text-primary flex items-center gap-1 mt-0.5">
                      <TrendingUp className="size-4" /> ₹{totalGstTurnover.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Tax Remitted</span>
                    <span className="font-bold text-base text-foreground mt-0.5 block">
                      ₹{totalGstPaid.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}

              {gstRecords.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Period</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">GSTIN</th>
                        <th className="px-3 py-2 text-right font-medium">Turnover (₹)</th>
                        <th className="px-3 py-2 text-right font-medium">Tax Paid (₹)</th>
                        <th className="px-3 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gstRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            {rec.period_month}
                            <span className="text-[10px] text-muted-foreground block">{rec.financial_year}</span>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="uppercase text-[9px] font-semibold">
                              {rec.return_type.replace(/_/g, "-")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{rec.gstin}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            ₹{Number(rec.taxable_turnover).toLocaleString("en-IN")}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {rec.total_tax_paid ? `₹${Number(rec.total_tax_paid).toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteGst(rec.id)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                  <p className="text-xs">No GST return records added yet. Click &ldquo;Add GST Filing&rdquo; to record monthly sales.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 3. FINANCIAL DOCUMENTS UPLOAD */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {borrowerType === "corporate" ? "3. Financial Documents &amp; Statements" : "Financial Documents"}
          </h3>
        </div>
        <DocumentStageSection
          borrowerId={borrowerId}
          borrowerType={borrowerType}
          stage="financial"
          title="Financial Documents &amp; Audit Reports"
        />
      </section>
    </div>
  );
}
