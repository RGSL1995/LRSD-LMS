import { sendEmail, type EmailSendResult } from "./resend";

export type SendPortalInviteParams = {
  toEmail: string;
  borrowerName: string;
  applicationCode: string;
  facilityType?: string;
  requestedAmount?: string;
  reviewUrl: string;
  senderName?: string;
};

export function buildPortalInviteHtml(params: SendPortalInviteParams): string {
  const {
    borrowerName,
    applicationCode,
    facilityType = "Wholesale Facility",
    requestedAmount,
    reviewUrl,
    senderName = "Lending Operations Desk",
  } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Review & Document Submission - ${applicationCode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff; }
    .title { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .subtitle { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px; }
    .salutation { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .cta-container { text-align: center; margin: 32px 0; }
    .btn-primary { display: inline-block; background: #2563eb; color: #ffffff !important; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; }
    .footer { background: #f1f5f9; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="title">Application Review &amp; Document Upload</h1>
      <p class="subtitle">Facility Application #${applicationCode}</p>
    </div>
    <div class="content">
      <div class="salutation">Dear ${borrowerName},</div>
      <p class="intro">
        Please review your wholesale facility application details (${facilityType}${requestedAmount ? ` • ${requestedAmount}` : ""}) and upload your required financial &amp; KYC documentation through the secure borrower portal.
      </p>
      <div class="cta-container">
        <a href="${reviewUrl}" class="btn-primary" target="_blank">
          Open Secure Borrower Portal &rarr;
        </a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
        Direct Link: <a href="${reviewUrl}" style="color: #2563eb;">${reviewUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0;">Sent by ${senderName} • LRSD Securities Private Limited</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendBorrowerPortalInviteEmail(
  params: SendPortalInviteParams,
): Promise<EmailSendResult> {
  const subject = `[Action Required] Upload Documents for Loan Application: ${params.applicationCode}`;
  const html = buildPortalInviteHtml(params);

  return sendEmail({
    to: params.toEmail,
    subject,
    html,
  });
}
