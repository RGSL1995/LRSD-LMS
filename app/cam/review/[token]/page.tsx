import { notFound } from "next/navigation";
import { getCamReviewDataByToken } from "@/app/loans/[id]/cam/cam-approval-actions";
import { CamReviewClient } from "./cam-review-client";
import { CamReviewErrorCard } from "./cam-review-error-card";

interface CamReviewPageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  title: "Credit Committee Approval & CAM Review | LRSD Lending",
  description: "Secure digital approval memorandum portal for Credit Committee and Risk Heads.",
};

export default async function CamReviewPage({ params }: CamReviewPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  const result = await getCamReviewDataByToken(token);

  if (!result.success || !result.data) {
    return <CamReviewErrorCard error={result.error} />;
  }

  return <CamReviewClient initialData={result.data} token={token} />;
}
