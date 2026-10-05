import { notFound } from "next/navigation";
import { getPortalApplicationData } from "@/app/portal/portal-actions";
import { BorrowerReviewClient } from "./borrower-review-client";
import { PortalErrorCard } from "./portal-error-card";

interface PortalReviewPageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  title: "Borrower Review & Document Portal | LRSD Lending",
  description: "Secure facility review and document upload portal for wholesale borrowers and guarantors.",
};

export default async function PortalReviewPage({ params }: PortalReviewPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  const result = await getPortalApplicationData(token);

  if (!result.success || !result.data) {
    return <PortalErrorCard error={result.error} />;
  }

  return <BorrowerReviewClient initialData={result.data} token={token} />;
}
