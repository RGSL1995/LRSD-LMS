"use client";

import { useState, useEffect, useTransition } from "react";
import {
  addCorporateAssociate,
  deleteCorporateAssociate,
  getCorporateAssociates,
} from "@/app/borrowers/actions";
import {
  addGroupStructureEntity,
  deleteGroupStructureEntity,
  getGroupStructure,
  addRelatedPartyTransaction,
  deleteRelatedPartyTransaction,
  getRelatedPartyTransactions,
  type GroupStructureRow,
  type RelatedPartyTransactionRow,
} from "@/app/borrowers/governance-actions";
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
  Users,
  Building2,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

interface Associate {
  id: string;
  borrower_id: string;
  associate_role: string;
  full_name: string;
  pan: string | null;
  din: string | null;
  email: string | null;
  phone: string | null;
  shareholding_percent: number | null;
}

export function GovernanceStructureStep({ borrowerId }: { borrowerId: string }) {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [groupEntities, setGroupEntities] = useState<GroupStructureRow[]>([]);
  const [rptList, setRptList] = useState<RelatedPartyTransactionRow[]>([]);

  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [rptDialogOpen, setRptDialogOpen] = useState(false);

  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const [assoc, group, rpt] = await Promise.all([
        getCorporateAssociates(borrowerId),
        getGroupStructure(borrowerId),
        getRelatedPartyTransactions(borrowerId),
      ]);
      setAssociates(assoc as Associate[]);
      setGroupEntities(group);
      setRptList(rpt);
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId]);

  async function handleAddAssociate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addCorporateAssociate(formData);
    setAssociateDialogOpen(false);
    refresh();
  }

  async function handleDeleteAssociate(id: string) {
    const formData = new FormData();
    formData.set("associate_id", id);
    formData.set("borrower_id", borrowerId);
    await deleteCorporateAssociate(formData);
    refresh();
  }

  async function handleAddGroupEntity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addGroupStructureEntity(formData);
    setGroupDialogOpen(false);
    refresh();
  }

  async function handleDeleteGroupEntity(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("borrower_id", borrowerId);
    await deleteGroupStructureEntity(formData);
    refresh();
  }

  async function handleAddRpt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addRelatedPartyTransaction(formData);
    setRptDialogOpen(false);
    refresh();
  }

  async function handleDeleteRpt(id: string) {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("borrower_id", borrowerId);
    await deleteRelatedPartyTransaction(formData);
    refresh();
  }

  return (
    <div className="space-y-8">
      {/* 1. DIRECTORS & KEY MANAGEMENT */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-primary" /> 1. Directors &amp; Key Management
            </CardTitle>
            <CardDescription className="text-xs">
              Board of directors, authorized signatories, promoters, and DIN numbers
            </CardDescription>
          </div>
          <Dialog open={associateDialogOpen} onOpenChange={setAssociateDialogOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
              <Plus className="size-3.5" /> Add Director / Key Person
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Director / Officer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddAssociate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="associate_role">Designation / Role *</Label>
                    <Select name="associate_role" defaultValue="director">
                      <SelectTrigger id="associate_role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="director">Director</SelectItem>
                        <SelectItem value="promoter">Promoter</SelectItem>
                        <SelectItem value="shareholder">Shareholder</SelectItem>
                        <SelectItem value="authorised_signatory">Authorised Signatory</SelectItem>
                        <SelectItem value="key_management">Key Management (CEO/CFO)</SelectItem>
                        <SelectItem value="guarantor">Guarantor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assoc_full_name">Full Legal Name *</Label>
                    <Input id="assoc_full_name" name="full_name" placeholder="Full name as per PAN" required />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="assoc_pan">PAN</Label>
                    <Input id="assoc_pan" name="pan" placeholder="ABCDE1234F" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="din">DIN / DPIN</Label>
                    <Input id="din" name="din" placeholder="8-digit DIN" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shareholding_percent">Equity Stake %</Label>
                    <Input
                      id="shareholding_percent"
                      name="shareholding_percent"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 51.0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assoc_email">Email</Label>
                    <Input id="assoc_email" name="email" type="email" placeholder="director@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assoc_phone">Phone</Label>
                    <Input id="assoc_phone" name="phone" placeholder="+91 9876543210" />
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setAssociateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save Record</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {associates.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">PAN &amp; DIN</th>
                    <th className="px-3 py-2 text-right font-medium">Shareholding</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {associates.map((assoc) => (
                    <tr key={assoc.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {assoc.full_name}
                        {assoc.email && <div className="text-[11px] text-muted-foreground">{assoc.email}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="capitalize text-[10px]">
                          {assoc.associate_role.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {assoc.pan && <span>PAN: {assoc.pan}</span>}
                        {assoc.pan && assoc.din && <br />}
                        {assoc.din && <span>DIN: {assoc.din}</span>}
                        {!assoc.pan && !assoc.din && "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {assoc.shareholding_percent !== null ? `${assoc.shareholding_percent}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAssociate(assoc.id)}
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
              <p className="text-xs">No directors or officers listed yet. Click &ldquo;Add Director&rdquo; above.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. GROUP & SUBSIDIARY STRUCTURE */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4 text-primary" /> 2. Corporate Group &amp; Subsidiary Structure
            </CardTitle>
            <CardDescription className="text-xs">
              Holding companies, subsidiaries, joint ventures, and associate entities
            </CardDescription>
          </div>
          <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
              <Plus className="size-3.5" /> Add Related Entity
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Group / Subsidiary Entity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddGroupEntity} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entity_name">Entity Name *</Label>
                    <Input id="entity_name" name="entity_name" placeholder="Company Name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship_type">Relationship Type *</Label>
                    <Select name="relationship_type" defaultValue="subsidiary">
                      <SelectTrigger id="relationship_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="holding_company">Holding / Parent Company</SelectItem>
                        <SelectItem value="subsidiary">Subsidiary</SelectItem>
                        <SelectItem value="joint_venture">Joint Venture</SelectItem>
                        <SelectItem value="associate_entity">Associate Entity</SelectItem>
                        <SelectItem value="sister_concern">Sister Concern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="percentage_holding">% Stake / Holding</Label>
                    <Input
                      id="percentage_holding"
                      name="percentage_holding"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cin_or_registration">CIN / Registration No.</Label>
                    <Input id="cin_or_registration" name="cin_or_registration" placeholder="U12345MH..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country_of_incorporation">Country</Label>
                    <Input id="country_of_incorporation" name="country_of_incorporation" defaultValue="India" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_nature">Nature of Business</Label>
                  <Input id="business_nature" name="business_nature" placeholder="e.g. Manufacturing, Retail Distribution" />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Entity</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {groupEntities.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Entity Name</th>
                    <th className="px-3 py-2 text-left font-medium">Relationship</th>
                    <th className="px-3 py-2 text-right font-medium">Holding %</th>
                    <th className="px-3 py-2 text-left font-medium">CIN / Country</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupEntities.map((ent) => (
                    <tr key={ent.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {ent.entity_name}
                        {ent.business_nature && (
                          <div className="text-[11px] text-muted-foreground">{ent.business_nature}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {ent.relationship_type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {ent.percentage_holding !== null ? `${ent.percentage_holding}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {ent.cin_or_registration ?? ent.country_of_incorporation ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteGroupEntity(ent.id)}
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
              <p className="text-xs">No parent or subsidiary entities configured. Click &ldquo;Add Related Entity&rdquo; if applicable.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. RELATED PARTY TRANSACTIONS (RPT) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-primary" /> 3. Related Party Transactions (RPT)
            </CardTitle>
            <CardDescription className="text-xs">
              Loans given/taken, corporate guarantees, advances, or sales with promoters and group firms
            </CardDescription>
          </div>
          <Dialog open={rptDialogOpen} onOpenChange={setRptDialogOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
              <Plus className="size-3.5" /> Add RPT Record
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Related Party Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddRpt} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="related_party_name">Related Party Name *</Label>
                    <Input id="related_party_name" name="related_party_name" placeholder="Party / Director Name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship_nature">Nature of Relationship *</Label>
                    <Input id="relationship_nature" name="relationship_nature" placeholder="e.g. Director, Holding Co." required />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="transaction_type">Transaction Type *</Label>
                    <Select name="transaction_type" defaultValue="loan_given">
                      <SelectTrigger id="transaction_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan_given">Loan / Advance Given</SelectItem>
                        <SelectItem value="loan_taken">Loan / Advance Taken</SelectItem>
                        <SelectItem value="sales_of_goods_services">Sales of Goods / Services</SelectItem>
                        <SelectItem value="purchase_of_goods_services">Purchase of Goods / Services</SelectItem>
                        <SelectItem value="corporate_guarantee">Corporate Guarantee</SelectItem>
                        <SelectItem value="director_remuneration">Director Remuneration</SelectItem>
                        <SelectItem value="other">Other Transaction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (₹) *</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" placeholder="5000000" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="financial_year">Financial Year</Label>
                    <Input id="financial_year" name="financial_year" defaultValue="FY 2024-25" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Terms &amp; Description</Label>
                  <Input id="description" name="description" placeholder="e.g. Unsecured loan at 9% p.a. interest" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="is_material" name="is_material" className="size-4 rounded" />
                  <Label htmlFor="is_material" className="text-xs font-normal cursor-pointer flex items-center gap-1">
                    <AlertTriangle className="size-3.5 text-amber-500" /> Flag as Material Transaction
                  </Label>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setRptDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save RPT</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {rptList.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Party &amp; Relation</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">FY</th>
                    <th className="px-3 py-2 text-right font-medium">Amount (₹)</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rptList.map((rpt) => (
                    <tr key={rpt.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span>{rpt.related_party_name}</span>
                          {rpt.is_material && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">
                              Material
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{rpt.relationship_nature}</div>
                      </td>
                      <td className="px-3 py-2 capitalize">{rpt.transaction_type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-muted-foreground">{rpt.financial_year}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        ₹{Number(rpt.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteRpt(rpt.id)}
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
              <p className="text-xs">No related party transactions recorded. Click &ldquo;Add RPT Record&rdquo; to add director loans, advances, or guarantees.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
