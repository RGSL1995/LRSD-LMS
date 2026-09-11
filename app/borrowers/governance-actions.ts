"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface GroupStructureRow {
  id: string;
  borrower_id: string;
  entity_name: string;
  relationship_type: "holding_company" | "subsidiary" | "joint_venture" | "associate_entity" | "sister_concern";
  percentage_holding: number | null;
  country_of_incorporation: string | null;
  cin_or_registration: string | null;
  business_nature: string | null;
}

export interface RelatedPartyTransactionRow {
  id: string;
  borrower_id: string;
  related_party_name: string;
  relationship_nature: string;
  transaction_type: string;
  amount: number;
  financial_year: string;
  description: string | null;
  is_material: boolean;
}

export async function addGroupStructureEntity(formData: FormData) {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;
  const entityName = formData.get("entity_name") as string;
  const relationshipType = formData.get("relationship_type") as string;
  const percentage = formData.get("percentage_holding") ? Number(formData.get("percentage_holding")) : null;
  const country = (formData.get("country_of_incorporation") as string) || "India";
  const cin = (formData.get("cin_or_registration") as string) || null;
  const businessNature = (formData.get("business_nature") as string) || null;

  if (!borrowerId || !entityName || !relationshipType) {
    return { error: "Entity name and relationship type are required." };
  }

  const { error } = await supabase.from("corporate_group_structure").insert({
    borrower_id: borrowerId,
    entity_name: entityName,
    relationship_type: relationshipType,
    percentage_holding: percentage,
    country_of_incorporation: country,
    cin_or_registration: cin,
    business_nature: businessNature,
  });

  if (error) return { error: error.message };

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function deleteGroupStructureEntity(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const borrowerId = formData.get("borrower_id") as string;

  const { error } = await supabase.from("corporate_group_structure").delete().eq("id", id);
  if (error) return { error: error.message };

  if (borrowerId) {
    revalidatePath(`/borrowers/${borrowerId}`);
  }
  return { error: null };
}

export async function getGroupStructure(borrowerId: string): Promise<GroupStructureRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("corporate_group_structure")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: true });

  return (data as GroupStructureRow[]) ?? [];
}

export async function addRelatedPartyTransaction(formData: FormData) {
  const supabase = await createClient();
  const borrowerId = formData.get("borrower_id") as string;
  const partyName = formData.get("related_party_name") as string;
  const relationship = formData.get("relationship_nature") as string;
  const transactionType = formData.get("transaction_type") as string;
  const amount = Number(formData.get("amount") || 0);
  const financialYear = (formData.get("financial_year") as string) || "FY 2024-25";
  const description = (formData.get("description") as string) || null;
  const isMaterial = formData.get("is_material") === "on";

  if (!borrowerId || !partyName || !relationship || !transactionType) {
    return { error: "Party name, relationship, and transaction type are required." };
  }

  const { error } = await supabase.from("related_party_transactions").insert({
    borrower_id: borrowerId,
    related_party_name: partyName,
    relationship_nature: relationship,
    transaction_type: transactionType,
    amount: amount,
    financial_year: financialYear,
    description: description,
    is_material: isMaterial,
  });

  if (error) return { error: error.message };

  revalidatePath(`/borrowers/${borrowerId}`);
  return { error: null };
}

export async function deleteRelatedPartyTransaction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const borrowerId = formData.get("borrower_id") as string;

  const { error } = await supabase.from("related_party_transactions").delete().eq("id", id);
  if (error) return { error: error.message };

  if (borrowerId) {
    revalidatePath(`/borrowers/${borrowerId}`);
  }
  return { error: null };
}

export async function getRelatedPartyTransactions(borrowerId: string): Promise<RelatedPartyTransactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("related_party_transactions")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: false });

  return (data as RelatedPartyTransactionRow[]) ?? [];
}
