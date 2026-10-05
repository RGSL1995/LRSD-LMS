"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Landmark, Plus } from "lucide-react";

export interface CollateralItem {
  id: string;
  collateral_type: string;
  charge_type: string;
  property_status: string;
  address: string;
  city: string;
  pincode: string;
  estimated_value: number;
  details: string;
}

interface CollateralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: CollateralItem) => void;
}

export function CollateralDialog({ open, onOpenChange, onAdd }: CollateralDialogProps) {
  const [collateralType, setCollateralType] = useState("Plot");
  const [chargeType, setChargeType] = useState("Mortgage");
  const [propertyStatus, setPropertyStatus] = useState("Ready");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCollateralType("Plot");
    setChargeType("Mortgage");
    setPropertyStatus("Ready");
    setAddress("");
    setCity("");
    setPincode("");
    setEstimatedValue("");
    setDetails("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!address.trim()) {
      setError("Collateral address is required.");
      return;
    }

    const val = Number(estimatedValue);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid estimated property value.");
      return;
    }

    onAdd({
      id: "col-" + Date.now(),
      collateral_type: collateralType,
      charge_type: chargeType,
      property_status: propertyStatus,
      address: address.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      estimated_value: val,
      details: details.trim(),
    });

    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto w-full">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="size-4" />
            </span>
            <DialogTitle className="text-lg">Add Collateral / Security Property</DialogTitle>
          </div>
          <DialogDescription>
            Specify security, immovable property or collateral pledged for this loan facility.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type of Collateral / Security *</Label>
              <select
                value={collateralType}
                onChange={(e) => setCollateralType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Plot">Plot</option>
                <option value="Flat">Flat</option>
                <option value="Land">Land</option>
                <option value="Project">Project / Commercial</option>
                <option value="Builder Floor">Builder Floor</option>
                <option value="Commercial Unit">Commercial Unit</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type of Charge / Mortgage *</Label>
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Mortgage">Mortgage (Equitable / Registered)</option>
                <option value="Charge">Exclusive Charge</option>
                <option value="Hypothecation">Hypothecation</option>
                <option value="Pledge">Pledge</option>
                <option value="Negative Lien">Negative Lien</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Property Status *</Label>
              <select
                value={propertyStatus}
                onChange={(e) => setPropertyStatus(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Ready">Ready / Completed</option>
                <option value="Under-Construction">Under-Construction</option>
                <option value="Vacant">Vacant Land / Plot</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estimated Market Value (₹) *</Label>
              <Input
                type="number"
                step="1000"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="e.g. 150000000"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Collateral Address / Location *</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Unit No, Plot / Khasra No, Street, Landmark"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">City / Tehsil</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Noida"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">PIN Code</Label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 201301"
                maxLength={6}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Particulars / Details of Collateral</Label>
            <Input
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. Commercial space on 7th floor, Tower-B, World Trade Tower"
            />
          </div>

          {error && <p className="text-xs text-destructive font-medium">{error}</p>}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="gap-1.5">
              <Plus className="size-4" />
              Add Collateral
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
