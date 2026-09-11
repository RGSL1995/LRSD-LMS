"use client";

import { useActionState, useState } from "react";
import {
  updateIndividualProfile,
  updateCorporateProfile,
  updateOtherProfile,
  type BorrowerFormState,
} from "@/app/borrowers/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initialState: BorrowerFormState = { error: null };

export function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}

function EditableField({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function useEditToggle(action: typeof updateIndividualProfile) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.error === null && editing) {
      setEditing(false);
    }
  }

  return { editing, setEditing, state, formAction, pending };
}

export type IndividualProfile = {
  full_name: string;
  father_or_husband_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  qualification: string | null;
  occupation: string | null;
  pan: string | null;
  aadhaar_number: string | null;
  passport_number: string | null;
  monthly_income: number | null;
  email: string | null;
  phone: string | null;
  landline: string | null;
  current_address_line: string | null;
  current_city: string | null;
  current_state: string | null;
  current_pincode: string | null;
  current_residence_type: string | null;
  current_residence_years: number | null;
  permanent_address_line: string | null;
  permanent_city: string | null;
  permanent_state: string | null;
  permanent_pincode: string | null;
  permanent_residence_type: string | null;
  permanent_residence_years: number | null;
  office_name: string | null;
  office_address: string | null;
  office_landmark: string | null;
  office_city: string | null;
  office_pincode: string | null;
  office_landline: string | null;
  office_email: string | null;
};

export function IndividualProfileEditor({
  borrowerId,
  profile,
}: {
  borrowerId: string;
  profile: IndividualProfile;
}) {
  const { editing, setEditing, state, formAction, pending } =
    useEditToggle(updateIndividualProfile);

  const [currentAddress, setCurrentAddress] = useState({
    line: profile.current_address_line ?? "",
    city: profile.current_city ?? "",
    state: profile.current_state ?? "",
    pincode: profile.current_pincode ?? "",
    years: profile.current_residence_years ? String(profile.current_residence_years) : "",
    type: profile.current_residence_type ?? "",
  });

  const [permanentAddress, setPermanentAddress] = useState({
    line: profile.permanent_address_line ?? "",
    city: profile.permanent_city ?? "",
    state: profile.permanent_state ?? "",
    pincode: profile.permanent_pincode ?? "",
    years: profile.permanent_residence_years ? String(profile.permanent_residence_years) : "",
    type: profile.permanent_residence_type ?? "",
  });

  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  function handleCurrentChange(field: string, value: string) {
    const updated = { ...currentAddress, [field]: value };
    setCurrentAddress(updated);
    if (sameAsCurrent) {
      setPermanentAddress(updated);
    }
  }

  function handleSameAsCurrentToggle(checked: boolean) {
    setSameAsCurrent(checked);
    if (checked) {
      setPermanentAddress({ ...currentAddress });
    }
  }

  function handlePermanentChange(field: string, value: string) {
    setPermanentAddress((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Profile</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Full name" value={profile.full_name} />
              <Field label="Father's / Husband's name" value={profile.father_or_husband_name} />
              <Field label="Date of birth" value={profile.date_of_birth} />
              <Field label="Gender" value={profile.gender} />
              <Field label="Marital status" value={profile.marital_status} />
              <Field label="Qualification" value={profile.qualification} />
              <Field label="Occupation" value={profile.occupation} />
              <Field label="PAN" value={profile.pan} />
              <Field label="Aadhaar No." value={profile.aadhaar_number} />
              <Field label="Passport No." value={profile.passport_number} />
              <Field label="Monthly income" value={profile.monthly_income} />
              <Field label="Email" value={profile.email} />
              <Field label="Mobile" value={profile.phone} />
              <Field label="Landline" value={profile.landline} />
            </dl>

            <p className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase">
              Current residential address
            </p>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Address" value={profile.current_address_line} />
              <Field
                label="City / State"
                value={[profile.current_city, profile.current_state].filter(Boolean).join(", ")}
              />
              <Field label="PIN code" value={profile.current_pincode} />
              <Field label="Years of residence" value={profile.current_residence_years} />
              <Field label="Residence type" value={profile.current_residence_type} />
            </dl>

            <p className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase">
              Permanent address
            </p>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Address" value={profile.permanent_address_line} />
              <Field
                label="City / State"
                value={[profile.permanent_city, profile.permanent_state]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="PIN code" value={profile.permanent_pincode} />
              <Field label="Years of residence" value={profile.permanent_residence_years} />
              <Field label="Residence type" value={profile.permanent_residence_type} />
            </dl>

            <p className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase">
              Work details
            </p>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Office name" value={profile.office_name} />
              <Field label="Office address" value={profile.office_address} />
              <Field label="Landmark" value={profile.office_landmark} />
              <Field label="City" value={profile.office_city} />
              <Field label="PIN code" value={profile.office_pincode} />
              <Field label="Landline" value={profile.office_landline} />
              <Field label="Email" value={profile.office_email} />
            </dl>
          </>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="borrower_id" value={borrowerId} />

            <EditableField>
              <Label htmlFor="full_name">Full name *</Label>
              <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
            </EditableField>
            <EditableField>
              <Label htmlFor="father_or_husband_name">Father&apos;s / Husband&apos;s name</Label>
              <Input
                id="father_or_husband_name"
                name="father_or_husband_name"
                defaultValue={profile.father_or_husband_name ?? ""}
              />
            </EditableField>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  defaultValue={profile.date_of_birth ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="gender">Gender</Label>
                <Select name="gender" defaultValue={profile.gender ?? undefined}>
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </EditableField>
              <EditableField>
                <Label htmlFor="marital_status">Marital status</Label>
                <Select name="marital_status" defaultValue={profile.marital_status ?? undefined}>
                  <SelectTrigger id="marital_status" className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </EditableField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <EditableField>
                <Label htmlFor="qualification">Qualification</Label>
                <Select name="qualification" defaultValue={profile.qualification ?? undefined}>
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
              </EditableField>
              <EditableField>
                <Label htmlFor="occupation">Occupation</Label>
                <Select name="occupation" defaultValue={profile.occupation ?? undefined}>
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
              </EditableField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="pan">PAN</Label>
                <Input id="pan" name="pan" defaultValue={profile.pan ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="aadhaar_number">Aadhaar No.</Label>
                <Input
                  id="aadhaar_number"
                  name="aadhaar_number"
                  defaultValue={profile.aadhaar_number ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="passport_number">Passport No.</Label>
                <Input
                  id="passport_number"
                  name="passport_number"
                  defaultValue={profile.passport_number ?? ""}
                />
              </EditableField>
            </div>
            <EditableField>
              <Label htmlFor="monthly_income">Monthly income</Label>
              <Input
                id="monthly_income"
                name="monthly_income"
                type="number"
                step="0.01"
                defaultValue={profile.monthly_income ?? ""}
              />
            </EditableField>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={profile.email ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="phone">Mobile</Label>
                <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="landline">Landline</Label>
                <Input id="landline" name="landline" defaultValue={profile.landline ?? ""} />
              </EditableField>
            </div>

            <p className="mt-2 text-xs font-semibold text-muted-foreground uppercase">
              Current residential address
            </p>
            <EditableField>
              <Label htmlFor="current_address_line">Address</Label>
              <Input
                id="current_address_line"
                name="current_address_line"
                value={currentAddress.line}
                onChange={(e) => handleCurrentChange("line", e.target.value)}
              />
            </EditableField>
            <div className="grid grid-cols-4 gap-4">
              <EditableField>
                <Label htmlFor="current_city">City</Label>
                <Input
                  id="current_city"
                  name="current_city"
                  value={currentAddress.city}
                  onChange={(e) => handleCurrentChange("city", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="current_state">State</Label>
                <Input
                  id="current_state"
                  name="current_state"
                  value={currentAddress.state}
                  onChange={(e) => handleCurrentChange("state", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="current_pincode">PIN code</Label>
                <Input
                  id="current_pincode"
                  name="current_pincode"
                  value={currentAddress.pincode}
                  onChange={(e) => handleCurrentChange("pincode", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="current_residence_years">Years of residence</Label>
                <Input
                  id="current_residence_years"
                  name="current_residence_years"
                  type="number"
                  value={currentAddress.years}
                  onChange={(e) => handleCurrentChange("years", e.target.value)}
                />
              </EditableField>
            </div>
            <EditableField>
              <Label htmlFor="current_residence_type">Residence type</Label>
              <Select
                name="current_residence_type"
                value={currentAddress.type}
                onValueChange={(val) => handleCurrentChange("type", val ?? "")}
              >
                <SelectTrigger id="current_residence_type" className="w-40">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rented">Rented</SelectItem>
                  <SelectItem value="owned">Owned</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </EditableField>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Permanent address
              </p>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded bg-muted/60 px-2 py-1 hover:bg-muted transition-colors">
                <input
                  type="checkbox"
                  checked={sameAsCurrent}
                  onChange={(e) => handleSameAsCurrentToggle(e.target.checked)}
                  className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Same as current address</span>
              </label>
            </div>
            <EditableField>
              <Label htmlFor="permanent_address_line">Address</Label>
              <Input
                id="permanent_address_line"
                name="permanent_address_line"
                value={permanentAddress.line}
                onChange={(e) => handlePermanentChange("line", e.target.value)}
              />
            </EditableField>
            <div className="grid grid-cols-4 gap-4">
              <EditableField>
                <Label htmlFor="permanent_city">City</Label>
                <Input
                  id="permanent_city"
                  name="permanent_city"
                  value={permanentAddress.city}
                  onChange={(e) => handlePermanentChange("city", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="permanent_state">State</Label>
                <Input
                  id="permanent_state"
                  name="permanent_state"
                  value={permanentAddress.state}
                  onChange={(e) => handlePermanentChange("state", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="permanent_pincode">PIN code</Label>
                <Input
                  id="permanent_pincode"
                  name="permanent_pincode"
                  value={permanentAddress.pincode}
                  onChange={(e) => handlePermanentChange("pincode", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="permanent_residence_years">Years of residence</Label>
                <Input
                  id="permanent_residence_years"
                  name="permanent_residence_years"
                  type="number"
                  value={permanentAddress.years}
                  onChange={(e) => handlePermanentChange("years", e.target.value)}
                />
              </EditableField>
            </div>
            <EditableField>
              <Label htmlFor="permanent_residence_type">Residence type</Label>
              <Select
                name="permanent_residence_type"
                value={permanentAddress.type}
                onValueChange={(val) => handlePermanentChange("type", val ?? "")}
              >
                <SelectTrigger id="permanent_residence_type" className="w-40">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rented">Rented</SelectItem>
                  <SelectItem value="owned">Owned</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </EditableField>

            <p className="mt-2 text-xs font-semibold text-muted-foreground uppercase">
              Work details
            </p>
            <EditableField>
              <Label htmlFor="office_name">Office name</Label>
              <Input id="office_name" name="office_name" defaultValue={profile.office_name ?? ""} />
            </EditableField>
            <EditableField>
              <Label htmlFor="office_address">Office address</Label>
              <Input
                id="office_address"
                name="office_address"
                defaultValue={profile.office_address ?? ""}
              />
            </EditableField>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="office_landmark">Landmark</Label>
                <Input
                  id="office_landmark"
                  name="office_landmark"
                  defaultValue={profile.office_landmark ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="office_city">City</Label>
                <Input id="office_city" name="office_city" defaultValue={profile.office_city ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="office_pincode">PIN code</Label>
                <Input
                  id="office_pincode"
                  name="office_pincode"
                  defaultValue={profile.office_pincode ?? ""}
                />
              </EditableField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <EditableField>
                <Label htmlFor="office_landline">Landline</Label>
                <Input
                  id="office_landline"
                  name="office_landline"
                  defaultValue={profile.office_landline ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="office_email">Email</Label>
                <Input
                  id="office_email"
                  name="office_email"
                  type="email"
                  defaultValue={profile.office_email ?? ""}
                />
              </EditableField>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export type CorporateProfile = {
  legal_name: string;
  trade_name: string | null;
  business_type: string | null;
  is_registered: boolean | null;
  cin: string | null;
  pan: string | null;
  gstin: string | null;
  incorporation_date: string | null;
  ownership_type: string | null;
  contact_no: string | null;
  contact_email: string | null;
  landline: string | null;
  corporate_office_address: string | null;
  corporate_office_city: string | null;
  corporate_office_state: string | null;
  corporate_office_pincode: string | null;
  registered_office_address: string | null;
  registered_office_city: string | null;
  registered_office_state: string | null;
  registered_office_pincode: string | null;
};

export function CorporateProfileEditor({
  borrowerId,
  profile,
}: {
  borrowerId: string;
  profile: CorporateProfile;
}) {
  const { editing, setEditing, state, formAction, pending } = useEditToggle(updateCorporateProfile);

  const [corporateOffice, setCorporateOffice] = useState({
    address: profile.corporate_office_address ?? "",
    city: profile.corporate_office_city ?? "",
    state: profile.corporate_office_state ?? "",
    pincode: profile.corporate_office_pincode ?? "",
  });

  const [registeredOffice, setRegisteredOffice] = useState({
    address: profile.registered_office_address ?? "",
    city: profile.registered_office_city ?? "",
    state: profile.registered_office_state ?? "",
    pincode: profile.registered_office_pincode ?? "",
  });

  const [sameAsCorporate, setSameAsCorporate] = useState(false);

  function handleCorporateChange(field: string, value: string) {
    const updated = { ...corporateOffice, [field]: value };
    setCorporateOffice(updated);
    if (sameAsCorporate) {
      setRegisteredOffice(updated);
    }
  }

  function handleSameAsCorporateToggle(checked: boolean) {
    setSameAsCorporate(checked);
    if (checked) {
      setRegisteredOffice({ ...corporateOffice });
    }
  }

  function handleRegisteredChange(field: string, value: string) {
    setRegisteredOffice((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Profile</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Legal name" value={profile.legal_name} />
              <Field label="Trade name" value={profile.trade_name} />
              <Field label="Business type" value={profile.business_type} />
              <Field label="Registered entity" value={profile.is_registered ? "Yes" : "No"} />
              <Field label="CIN / LLPIN / Reg. No." value={profile.cin} />
              <Field label="PAN" value={profile.pan} />
              <Field label="GSTIN" value={profile.gstin} />
              <Field label="Incorporation date" value={profile.incorporation_date} />
              <Field label="Ownership type" value={profile.ownership_type} />
              <Field label="Contact no." value={profile.contact_no} />
              <Field label="Email" value={profile.contact_email} />
              <Field label="Landline" value={profile.landline} />
            </dl>

            <p className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase">
              Corporate office address
            </p>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Address" value={profile.corporate_office_address} />
              <Field
                label="City / State"
                value={[profile.corporate_office_city, profile.corporate_office_state]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="PIN code" value={profile.corporate_office_pincode} />
            </dl>

            <p className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase">
              Registered office address
            </p>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Address" value={profile.registered_office_address} />
              <Field
                label="City / State"
                value={[profile.registered_office_city, profile.registered_office_state]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="PIN code" value={profile.registered_office_pincode} />
            </dl>
          </>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="borrower_id" value={borrowerId} />

            <EditableField>
              <Label htmlFor="legal_name">Legal name *</Label>
              <Input id="legal_name" name="legal_name" defaultValue={profile.legal_name} required />
            </EditableField>
            <EditableField>
              <Label htmlFor="trade_name">Trade name</Label>
              <Input id="trade_name" name="trade_name" defaultValue={profile.trade_name ?? ""} />
            </EditableField>
            <div className="grid grid-cols-2 gap-4">
              <EditableField>
                <Label htmlFor="business_type">Business type</Label>
                <Select name="business_type" defaultValue={profile.business_type ?? undefined}>
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
              </EditableField>
              <EditableField>
                <Label className="flex items-center gap-2 pt-6 text-sm font-normal">
                  <input
                    type="checkbox"
                    name="is_registered"
                    className="size-4"
                    defaultChecked={!!profile.is_registered}
                  />
                  Registered entity
                </Label>
              </EditableField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="cin">CIN / LLPIN / Reg. No.</Label>
                <Input id="cin" name="cin" defaultValue={profile.cin ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="pan">PAN</Label>
                <Input id="pan" name="pan" defaultValue={profile.pan ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="gstin">GSTIN</Label>
                <Input id="gstin" name="gstin" defaultValue={profile.gstin ?? ""} />
              </EditableField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <EditableField>
                <Label htmlFor="incorporation_date">Date of incorporation</Label>
                <Input
                  id="incorporation_date"
                  name="incorporation_date"
                  type="date"
                  defaultValue={profile.incorporation_date ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="ownership_type">Ownership type</Label>
                <Input
                  id="ownership_type"
                  name="ownership_type"
                  defaultValue={profile.ownership_type ?? ""}
                />
              </EditableField>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="contact_no">Contact no.</Label>
                <Input id="contact_no" name="contact_no" defaultValue={profile.contact_no ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  defaultValue={profile.contact_email ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="landline">Landline</Label>
                <Input id="landline" name="landline" defaultValue={profile.landline ?? ""} />
              </EditableField>
            </div>

            <p className="mt-2 text-xs font-semibold text-muted-foreground uppercase">
              Corporate office address
            </p>
            <EditableField>
              <Label htmlFor="corporate_office_address">Address</Label>
              <Input
                id="corporate_office_address"
                name="corporate_office_address"
                value={corporateOffice.address}
                onChange={(e) => handleCorporateChange("address", e.target.value)}
              />
            </EditableField>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="corporate_office_city">City</Label>
                <Input
                  id="corporate_office_city"
                  name="corporate_office_city"
                  value={corporateOffice.city}
                  onChange={(e) => handleCorporateChange("city", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="corporate_office_state">State</Label>
                <Input
                  id="corporate_office_state"
                  name="corporate_office_state"
                  value={corporateOffice.state}
                  onChange={(e) => handleCorporateChange("state", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="corporate_office_pincode">PIN code</Label>
                <Input
                  id="corporate_office_pincode"
                  name="corporate_office_pincode"
                  value={corporateOffice.pincode}
                  onChange={(e) => handleCorporateChange("pincode", e.target.value)}
                />
              </EditableField>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Registered office address
              </p>
              <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded bg-muted/60 px-2 py-1 hover:bg-muted transition-colors">
                <input
                  type="checkbox"
                  checked={sameAsCorporate}
                  onChange={(e) => handleSameAsCorporateToggle(e.target.checked)}
                  className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>Same as corporate head office</span>
              </label>
            </div>
            <EditableField>
              <Label htmlFor="registered_office_address">Address</Label>
              <Input
                id="registered_office_address"
                name="registered_office_address"
                value={registeredOffice.address}
                onChange={(e) => handleRegisteredChange("address", e.target.value)}
              />
            </EditableField>
            <div className="grid grid-cols-3 gap-4">
              <EditableField>
                <Label htmlFor="registered_office_city">City</Label>
                <Input
                  id="registered_office_city"
                  name="registered_office_city"
                  value={registeredOffice.city}
                  onChange={(e) => handleRegisteredChange("city", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="registered_office_state">State</Label>
                <Input
                  id="registered_office_state"
                  name="registered_office_state"
                  value={registeredOffice.state}
                  onChange={(e) => handleRegisteredChange("state", e.target.value)}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="registered_office_pincode">PIN code</Label>
                <Input
                  id="registered_office_pincode"
                  name="registered_office_pincode"
                  value={registeredOffice.pincode}
                  onChange={(e) => handleRegisteredChange("pincode", e.target.value)}
                />
              </EditableField>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export type OtherProfile = {
  entity_name: string;
  entity_category: string | null;
  registration_number: string | null;
  pan: string | null;
  address: string | null;
};

export function OtherProfileEditor({
  borrowerId,
  profile,
}: {
  borrowerId: string;
  profile: OtherProfile;
}) {
  const { editing, setEditing, state, formAction, pending } = useEditToggle(updateOtherProfile);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Profile</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Entity name" value={profile.entity_name} />
            <Field label="Entity category" value={profile.entity_category} />
            <Field label="Registration number" value={profile.registration_number} />
            <Field label="PAN" value={profile.pan} />
            <Field label="Address" value={profile.address} />
          </dl>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="borrower_id" value={borrowerId} />
            <EditableField>
              <Label htmlFor="entity_name">Entity name *</Label>
              <Input id="entity_name" name="entity_name" defaultValue={profile.entity_name} required />
            </EditableField>
            <div className="grid grid-cols-2 gap-4">
              <EditableField>
                <Label htmlFor="entity_category">Entity category</Label>
                <Input
                  id="entity_category"
                  name="entity_category"
                  defaultValue={profile.entity_category ?? ""}
                />
              </EditableField>
              <EditableField>
                <Label htmlFor="registration_number">Registration number</Label>
                <Input
                  id="registration_number"
                  name="registration_number"
                  defaultValue={profile.registration_number ?? ""}
                />
              </EditableField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <EditableField>
                <Label htmlFor="pan">PAN</Label>
                <Input id="pan" name="pan" defaultValue={profile.pan ?? ""} />
              </EditableField>
              <EditableField>
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={profile.address ?? ""} />
              </EditableField>
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
