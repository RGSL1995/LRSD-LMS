"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createBorrower, type BorrowerFormState } from "@/app/borrowers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: BorrowerFormState = { error: null };

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

export default function NewBorrowerPage() {
  const [state, formAction, pending] = useActionState(createBorrower, initialState);
  const [borrowerType, setBorrowerType] = useState<"individual" | "corporate" | "other">(
    "individual",
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <Link href="/borrowers" className="text-sm font-medium text-muted-foreground hover:underline">
          &larr; Borrowers
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">New borrower</h1>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <form action={formAction} className="space-y-6">
          <div>
            <Label className="mb-2">Borrower type</Label>
            <ToggleGroup
              value={[borrowerType]}
              onValueChange={(values) => {
                const value = values[0] as typeof borrowerType | undefined;
                if (value) setBorrowerType(value);
              }}
              variant="outline"
            >
              <ToggleGroupItem value="individual" className="capitalize">
                Individual
              </ToggleGroupItem>
              <ToggleGroupItem value="corporate" className="capitalize">
                Corporate
              </ToggleGroupItem>
              <ToggleGroupItem value="other" className="capitalize">
                Other
              </ToggleGroupItem>
            </ToggleGroup>
            <input type="hidden" name="borrower_type" value={borrowerType} />
          </div>

          {borrowerType === "individual" && <IndividualFields />}
          {borrowerType === "corporate" && <CorporateFields />}
          {borrowerType === "other" && <OtherFields />}

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create borrower"}
          </Button>
        </form>
      </main>
    </div>
  );
}

function IndividualFields() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="full_name">Full name *</Label>
            <Input id="full_name" name="full_name" required />
          </Field>
          <Field>
            <Label htmlFor="father_or_husband_name">Father&apos;s / Husband&apos;s name</Label>
            <Input id="father_or_husband_name" name="father_or_husband_name" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input id="date_of_birth" name="date_of_birth" type="date" />
            </Field>
            <Field>
              <Label htmlFor="gender">Gender</Label>
              <Select name="gender">
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="marital_status">Marital status</Label>
              <Select name="marital_status">
                <SelectTrigger id="marital_status" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="qualification">Qualification</Label>
              <Select name="qualification">
                <SelectTrigger id="qualification" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_school">High School</SelectItem>
                  <SelectItem value="graduate">Graduate</SelectItem>
                  <SelectItem value="post_graduate">Post Graduate</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label htmlFor="occupation">Occupation</Label>
              <Select name="occupation">
                <SelectTrigger id="occupation" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="housewife">Housewife</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" name="pan" />
            </Field>
            <Field>
              <Label htmlFor="aadhaar_number">Aadhaar No.</Label>
              <Input id="aadhaar_number" name="aadhaar_number" />
            </Field>
            <Field>
              <Label htmlFor="passport_number">Passport No.</Label>
              <Input id="passport_number" name="passport_number" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="monthly_income">Monthly income</Label>
              <Input id="monthly_income" name="monthly_income" type="number" step="0.01" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <Field>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field>
            <Label htmlFor="phone">Mobile</Label>
            <Input id="phone" name="phone" />
          </Field>
          <Field>
            <Label htmlFor="landline">Landline</Label>
            <Input id="landline" name="landline" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current residential address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="current_address_line">Address</Label>
            <Input id="current_address_line" name="current_address_line" />
          </Field>
          <div className="grid grid-cols-4 gap-4">
            <Field>
              <Label htmlFor="current_city">City</Label>
              <Input id="current_city" name="current_city" />
            </Field>
            <Field>
              <Label htmlFor="current_state">State</Label>
              <Input id="current_state" name="current_state" />
            </Field>
            <Field>
              <Label htmlFor="current_pincode">PIN code</Label>
              <Input id="current_pincode" name="current_pincode" />
            </Field>
            <Field>
              <Label htmlFor="current_residence_years">Years of residence</Label>
              <Input id="current_residence_years" name="current_residence_years" type="number" />
            </Field>
          </div>
          <Field>
            <Label htmlFor="current_residence_type">Residence type</Label>
            <Select name="current_residence_type">
              <SelectTrigger id="current_residence_type" className="w-40">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permanent address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="permanent_address_line">Address</Label>
            <Input id="permanent_address_line" name="permanent_address_line" />
          </Field>
          <div className="grid grid-cols-4 gap-4">
            <Field>
              <Label htmlFor="permanent_city">City</Label>
              <Input id="permanent_city" name="permanent_city" />
            </Field>
            <Field>
              <Label htmlFor="permanent_state">State</Label>
              <Input id="permanent_state" name="permanent_state" />
            </Field>
            <Field>
              <Label htmlFor="permanent_pincode">PIN code</Label>
              <Input id="permanent_pincode" name="permanent_pincode" />
            </Field>
            <Field>
              <Label htmlFor="permanent_residence_years">Years of residence</Label>
              <Input id="permanent_residence_years" name="permanent_residence_years" type="number" />
            </Field>
          </div>
          <Field>
            <Label htmlFor="permanent_residence_type">Residence type</Label>
            <Select name="permanent_residence_type">
              <SelectTrigger id="permanent_residence_type" className="w-40">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="owned">Owned</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="office_name">Office name</Label>
            <Input id="office_name" name="office_name" />
          </Field>
          <Field>
            <Label htmlFor="office_address">Office address</Label>
            <Input id="office_address" name="office_address" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="office_landmark">Landmark</Label>
              <Input id="office_landmark" name="office_landmark" />
            </Field>
            <Field>
              <Label htmlFor="office_city">City</Label>
              <Input id="office_city" name="office_city" />
            </Field>
            <Field>
              <Label htmlFor="office_pincode">PIN code</Label>
              <Input id="office_pincode" name="office_pincode" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="office_landline">Landline</Label>
              <Input id="office_landline" name="office_landline" />
            </Field>
            <Field>
              <Label htmlFor="office_email">Email</Label>
              <Input id="office_email" name="office_email" type="email" />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CorporateFields() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="legal_name">Legal name *</Label>
            <Input id="legal_name" name="legal_name" required />
          </Field>
          <Field>
            <Label htmlFor="trade_name">Trade name</Label>
            <Input id="trade_name" name="trade_name" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="business_type">Business type</Label>
              <Select name="business_type">
                <SelectTrigger id="business_type" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private_limited">Private Limited</SelectItem>
                  <SelectItem value="partnership">Partnership Firm</SelectItem>
                  <SelectItem value="llp">LLP</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label className="flex items-center gap-2 pt-6 text-sm font-normal">
                <input type="checkbox" name="is_registered" className="size-4" />
                Registered entity
              </Label>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="cin">CIN / LLPIN / Reg. No.</Label>
              <Input id="cin" name="cin" />
            </Field>
            <Field>
              <Label htmlFor="pan">PAN</Label>
              <Input id="pan" name="pan" />
            </Field>
            <Field>
              <Label htmlFor="gstin">GSTIN</Label>
              <Input id="gstin" name="gstin" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="incorporation_date">Date of incorporation</Label>
              <Input id="incorporation_date" name="incorporation_date" type="date" />
            </Field>
            <Field>
              <Label htmlFor="ownership_type">Ownership type</Label>
              <Input id="ownership_type" name="ownership_type" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <Field>
            <Label htmlFor="contact_no">Contact no.</Label>
            <Input id="contact_no" name="contact_no" />
          </Field>
          <Field>
            <Label htmlFor="contact_email">Email</Label>
            <Input id="contact_email" name="contact_email" type="email" />
          </Field>
          <Field>
            <Label htmlFor="landline">Landline</Label>
            <Input id="landline" name="landline" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corporate office address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="corporate_office_address">Address</Label>
            <Input id="corporate_office_address" name="corporate_office_address" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="corporate_office_city">City</Label>
              <Input id="corporate_office_city" name="corporate_office_city" />
            </Field>
            <Field>
              <Label htmlFor="corporate_office_state">State</Label>
              <Input id="corporate_office_state" name="corporate_office_state" />
            </Field>
            <Field>
              <Label htmlFor="corporate_office_pincode">PIN code</Label>
              <Input id="corporate_office_pincode" name="corporate_office_pincode" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered office address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="registered_office_address">Address</Label>
            <Input id="registered_office_address" name="registered_office_address" />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label htmlFor="registered_office_city">City</Label>
              <Input id="registered_office_city" name="registered_office_city" />
            </Field>
            <Field>
              <Label htmlFor="registered_office_state">State</Label>
              <Input id="registered_office_state" name="registered_office_state" />
            </Field>
            <Field>
              <Label htmlFor="registered_office_pincode">PIN code</Label>
              <Input id="registered_office_pincode" name="registered_office_pincode" />
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OtherFields() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <Field>
          <Label htmlFor="entity_name">Entity name *</Label>
          <Input id="entity_name" name="entity_name" required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label htmlFor="entity_category">Entity category</Label>
            <Input
              id="entity_category"
              name="entity_category"
              placeholder="e.g. Partnership, LLP, Trust"
            />
          </Field>
          <Field>
            <Label htmlFor="registration_number">Registration number</Label>
            <Input id="registration_number" name="registration_number" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label htmlFor="pan">PAN</Label>
            <Input id="pan" name="pan" />
          </Field>
          <Field>
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
