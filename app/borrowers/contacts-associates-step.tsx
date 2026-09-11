"use client";

import { useState, useEffect, useTransition } from "react";
import {
  addBorrowerContact,
  deleteBorrowerContact,
  getBorrowerContacts,
  addCorporateAssociate,
  deleteCorporateAssociate,
  getCorporateAssociates,
} from "@/app/borrowers/actions";
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
import { Plus, Trash2, Users, Mail, Phone, ShieldCheck } from "lucide-react";
import type { BorrowerType } from "@/app/borrowers/document-categories";

interface Contact {
  id: string;
  borrower_id: string;
  contact_name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

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

export function ContactsAssociatesStep({
  borrowerId,
  borrowerType,
}: {
  borrowerId: string;
  borrowerType: BorrowerType;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [associateDialogOpen, setAssociateDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const c = await getBorrowerContacts(borrowerId);
      setContacts(c as Contact[]);
      if (borrowerType === "corporate") {
        const a = await getCorporateAssociates(borrowerId);
        setAssociates(a as Associate[]);
      }
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId, borrowerType]);

  async function handleAddContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addBorrowerContact(formData);
    setContactDialogOpen(false);
    refresh();
  }

  async function handleDeleteContact(contactId: string) {
    const formData = new FormData();
    formData.set("contact_id", contactId);
    formData.set("borrower_id", borrowerId);
    await deleteBorrowerContact(formData);
    refresh();
  }

  async function handleAddAssociate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("borrower_id", borrowerId);
    await addCorporateAssociate(formData);
    setAssociateDialogOpen(false);
    refresh();
  }

  async function handleDeleteAssociate(associateId: string) {
    const formData = new FormData();
    formData.set("associate_id", associateId);
    formData.set("borrower_id", borrowerId);
    await deleteCorporateAssociate(formData);
    refresh();
  }

  return (
    <div className="space-y-6">
      {/* Authorized Contacts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-primary" /> Key Contact Persons
            </CardTitle>
            <CardDescription className="text-xs">
              Designate primary and additional contacts for communications &amp; operations
            </CardDescription>
          </div>
          <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
            <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
              <Plus className="size-3.5" /> Add Contact
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Contact Person</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddContact} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">Full Name *</Label>
                    <Input id="contact_name" name="contact_name" placeholder="e.g. John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation / Role</Label>
                    <Input id="designation" name="designation" placeholder="e.g. Manager / Authorized Signatory" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Email Address</Label>
                    <Input id="contact_email" name="email" type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone / Mobile</Label>
                    <Input id="contact_phone" name="phone" placeholder="+91 9876543210" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_primary"
                    name="is_primary"
                    className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="is_primary" className="text-sm font-normal cursor-pointer">
                    Set as primary point of contact
                  </Label>
                </div>
                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save Contact</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {contacts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex flex-col justify-between rounded-lg border bg-card p-3 shadow-xs hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{contact.contact_name}</span>
                        {contact.is_primary && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 hover:bg-emerald-600">
                            Primary
                          </Badge>
                        )}
                      </div>
                      {contact.designation && (
                        <p className="text-xs text-muted-foreground mt-0.5">{contact.designation}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                      title="Remove contact"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {(contact.email || contact.phone) && (
                    <div className="mt-3 pt-2 border-t border-dashed space-y-1 text-xs text-muted-foreground">
                      {contact.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="size-3 shrink-0" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <Users className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No contact persons added</p>
              <p className="text-xs mt-0.5">Click &ldquo;Add Contact&rdquo; to add primary or secondary contacts, or proceed to next step.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Corporate Associates & Directors (Shown for corporate borrowers) */}
      {borrowerType === "corporate" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Directors &amp; Key Shareholders
              </CardTitle>
              <CardDescription className="text-xs">
                List directors, shareholders, partners, and authorized signatories
              </CardDescription>
            </div>
            <Dialog open={associateDialogOpen} onOpenChange={setAssociateDialogOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
                <Plus className="size-3.5" /> Add Associate
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Director / Associate</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddAssociate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="associate_role">Role *</Label>
                      <Select name="associate_role" defaultValue="director">
                        <SelectTrigger id="associate_role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="director">Director</SelectItem>
                          <SelectItem value="promoter">Promoter</SelectItem>
                          <SelectItem value="shareholder">Shareholder</SelectItem>
                          <SelectItem value="authorised_signatory">Authorised Signatory</SelectItem>
                          <SelectItem value="key_management">Key Management</SelectItem>
                          <SelectItem value="guarantor">Guarantor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assoc_full_name">Full Name *</Label>
                      <Input id="assoc_full_name" name="full_name" placeholder="Full legal name" required />
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
                      <Label htmlFor="shareholding_percent">Shareholding %</Label>
                      <Input
                        id="shareholding_percent"
                        name="shareholding_percent"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 25.5"
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
                    <Button type="submit">Save Associate</Button>
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
                      <th className="px-3 py-2 text-left font-medium">PAN / DIN</th>
                      <th className="px-3 py-2 text-right font-medium">Shareholding</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
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
                            title="Remove associate"
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
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <ShieldCheck className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No directors or associates added</p>
                <p className="text-xs mt-0.5">Click &ldquo;Add Associate&rdquo; to add directors, shareholders, or partners.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
