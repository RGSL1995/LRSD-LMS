import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addBorrowerContact, addCorporateAssociate } from "@/app/borrowers/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { unwrapRelation } from "@/lib/utils";
import {
  IndividualProfileEditor,
  CorporateProfileEditor,
  OtherProfileEditor,
} from "./profile-editor";
import { DeleteBorrowerButton } from "./delete-borrower-button";

export default async function BorrowerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: borrower } = await supabase
    .from("borrowers")
    .select(
      `id, borrower_code, borrower_type, status, created_at,
       individual_profiles ( * ),
       corporate_profiles ( * ),
       other_profiles ( * )`,
    )
    .eq("id", id)
    .single();

  if (!borrower) notFound();

  const { data: contacts } = await supabase
    .from("borrower_contacts")
    .select("*")
    .eq("borrower_id", id)
    .order("created_at", { ascending: true });

  const { data: associates } =
    borrower.borrower_type === "corporate"
      ? await supabase
          .from("corporate_associates")
          .select("*")
          .eq("borrower_id", id)
          .order("created_at", { ascending: true })
      : { data: null };

  const individual = unwrapRelation(borrower.individual_profiles as any);
  const corporate = unwrapRelation(borrower.corporate_profiles as any);
  const other = unwrapRelation(borrower.other_profiles as any);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <Link href="/borrowers" className="text-sm font-medium text-muted-foreground hover:underline">
          &larr; Borrowers
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              {individual?.full_name ?? corporate?.legal_name ?? other?.entity_name}
            </h1>
            <Badge variant="secondary" className="capitalize">
              {borrower.status}
            </Badge>
          </div>
          <DeleteBorrowerButton borrowerId={borrower.id} />
        </div>
        <p className="text-sm text-muted-foreground">
          {borrower.borrower_code} &middot;{" "}
          <span className="capitalize">{borrower.borrower_type}</span>
        </p>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {individual && <IndividualProfileEditor borrowerId={borrower.id} profile={individual} />}
        {corporate && <CorporateProfileEditor borrowerId={borrower.id} profile={corporate} />}
        {other && <OtherProfileEditor borrowerId={borrower.id} profile={other} />}

        {borrower.borrower_type === "corporate" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Directors / Promoters / Signatories</CardTitle>
              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  + Add associate
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add associate</DialogTitle>
                  </DialogHeader>
                  <form action={addCorporateAssociate} className="space-y-4">
                    <input type="hidden" name="borrower_id" value={id} />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assoc_full_name">Full name *</Label>
                        <Input id="assoc_full_name" name="full_name" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="associate_role">Role *</Label>
                        <Select name="associate_role" required defaultValue="director">
                          <SelectTrigger id="associate_role" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="director">Director</SelectItem>
                            <SelectItem value="promoter">Promoter</SelectItem>
                            <SelectItem value="authorised_signatory">
                              Authorised signatory
                            </SelectItem>
                            <SelectItem value="key_management">Key management</SelectItem>
                            <SelectItem value="shareholder">Shareholder</SelectItem>
                            <SelectItem value="guarantor">Guarantor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assoc_pan">PAN</Label>
                        <Input id="assoc_pan" name="pan" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="din">DIN</Label>
                        <Input id="din" name="din" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shareholding_percent">Shareholding %</Label>
                        <Input
                          id="shareholding_percent"
                          name="shareholding_percent"
                          type="number"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assoc_email">Email</Label>
                        <Input id="assoc_email" name="email" type="email" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assoc_phone">Phone</Label>
                        <Input id="assoc_phone" name="phone" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Add</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {associates && associates.length > 0 ? (
                <ul className="divide-y">
                  {associates.map((associate) => (
                    <li key={associate.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{associate.full_name}</span>
                      <span className="capitalize text-muted-foreground">
                        {associate.associate_role.replace("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No associates added yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Contacts</CardTitle>
            <Dialog>
              <DialogTrigger render={<Button variant="outline" size="sm" />}>
                + Add contact
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add contact</DialogTitle>
                </DialogHeader>
                <form action={addBorrowerContact} className="space-y-4">
                  <input type="hidden" name="borrower_id" value={id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Name *</Label>
                      <Input id="contact_name" name="contact_name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="designation">Designation</Label>
                      <Input id="designation" name="designation" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_email">Email</Label>
                      <Input id="contact_email" name="email" type="email" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_phone">Phone</Label>
                      <Input id="contact_phone" name="phone" />
                    </div>
                  </div>
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <input type="checkbox" name="is_primary" className="size-4" />
                    Primary contact
                  </Label>
                  <DialogFooter>
                    <Button type="submit">Add</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {contacts && contacts.length > 0 ? (
              <ul className="divide-y">
                {contacts.map((contact) => (
                  <li key={contact.id} className="py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{contact.contact_name}</span>
                      {contact.is_primary && (
                        <Badge variant="outline">Primary</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {[contact.designation, contact.email, contact.phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts added yet.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
