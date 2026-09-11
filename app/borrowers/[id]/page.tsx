import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unwrapRelation } from "@/lib/utils";
import { BorrowerDetailView } from "./borrower-detail-view";

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

  const individual = unwrapRelation(borrower.individual_profiles);
  const corporate = unwrapRelation(borrower.corporate_profiles);
  const other = unwrapRelation(borrower.other_profiles);

  return (
    <BorrowerDetailView
      borrower={borrower}
      individual={individual}
      corporate={corporate}
      other={other}
    />
  );
}
