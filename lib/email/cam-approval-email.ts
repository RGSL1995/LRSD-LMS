/**
 * Email dispatch service for Credit Appraisal Memorandum (CAM) Credit Committee Approvals.
 * 
 * Supports:
 *  1. Resend API (if RESEND_API_KEY is configured)
 *  2. SMTP Transport (if SMTP_HOST is configured)
 *  3. Fallback console / simulated inbox with detailed log output
 */

export type SendCamApprovalEmailParams = {
  toEmail: string;
  approverName: string;
  approverRole: string;
  applicationCode: string;
  borrowerName: string;
  facilityType: string;
  requestedAmountFormatted: string;
  tenureMonths: number;
  securityCoverRatio: number;
  keyHighlights?: string[];
  reviewUrl: string;
  quickApproveUrl?: string;
  quickRejectUrl?: string;
  preparedBy?: string;
};

export type EmailSendResult = {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
};

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export function buildCamApprovalHtml(params: SendCamApprovalEmailParams): string {
  const {
    approverName,
    approverRole,
    applicationCode,
    borrowerName,
    facilityType,
    requestedAmountFormatted,
    tenureMonths,
    securityCoverRatio,
    keyHighlights = [],
    reviewUrl,
    preparedBy = "Credit Risk Team",
  } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credit Appraisal Memo Approval Request - ${applicationCode}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 620px; margin: 24px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; color: #ffffff; }
    .badge { display: inline-block; background: rgba(59, 130, 246, 0.2); color: #93c5fd; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(147, 197, 253, 0.3); margin-bottom: 10px; }
    .title { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3; }
    .subtitle { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 32px; }
    .salutation { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .dossier-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
    .dossier-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 14px; }
    .grid { display: table; width: 100%; }
    .row { display: table-row; }
    .cell { display: table-cell; padding: 6px 8px 6px 0; font-size: 13px; vertical-align: top; }
    .cell-label { color: #64748b; width: 40%; }
    .cell-value { color: #0f172a; font-weight: 600; text-align: right; }
    .highlight-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; }
    .highlight-title { font-size: 12px; font-weight: 700; color: #1d4ed8; margin: 0 0 6px; }
    .highlight-list { margin: 0; padding-left: 18px; font-size: 13px; color: #1e40af; line-height: 1.5; }
    .cta-container { text-align: center; margin: 32px 0 24px; }
    .btn-primary { display: inline-block; background: #2563eb; color: #ffffff !important; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .btn-primary:hover { background: #1d4ed8; }
    .notice { font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .footer { background: #f1f5f9; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Credit Committee Memorandum</div>
      <h1 class="title">Approval Request: ${applicationCode}</h1>
      <p class="subtitle">${borrowerName} • ${facilityType}</p>
    </div>

    <div class="content">
      <div class="salutation">Dear ${approverName} (${approverRole}),</div>
      <p class="intro">
        The Credit Appraisal Memorandum (CAM) for <strong>${borrowerName}</strong> has been finalized by ${preparedBy} and submitted for your formal credit committee review and approval.
      </p>

      <div class="dossier-card">
        <div class="dossier-title">Facility Particulars</div>
        <div class="grid">
          <div class="row">
            <div class="cell cell-label">Application Code:</div>
            <div class="cell cell-value" style="font-family: monospace;">${applicationCode}</div>
          </div>
          <div class="row">
            <div class="cell cell-label">Borrower Name:</div>
            <div class="cell cell-value">${borrowerName}</div>
          </div>
          <div class="row">
            <div class="cell cell-label">Facility Type:</div>
            <div class="cell cell-value">${facilityType}</div>
          </div>
          <div class="row">
            <div class="cell cell-label">Sanction Amount:</div>
            <div class="cell cell-value" style="color: #2563eb; font-size: 15px;">${requestedAmountFormatted}</div>
          </div>
          <div class="row">
            <div class="cell cell-label">Tenure:</div>
            <div class="cell cell-value">${tenureMonths} Months</div>
          </div>
          <div class="row">
            <div class="cell cell-label">Security Cover:</div>
            <div class="cell cell-value" style="color: #16a34a;">${securityCoverRatio > 0 ? `${securityCoverRatio}x Cover` : "Standard Property / Asset"}</div>
          </div>
        </div>
      </div>

      ${
        keyHighlights.length > 0
          ? `
      <div class="highlight-box">
        <div class="highlight-title">Key Underwriting Highlights</div>
        <ul class="highlight-list">
          ${keyHighlights.map((h) => `<li>${h}</li>`).join("")}
        </ul>
      </div>
      `
          : ""
      }

      <div class="cta-container">
        <a href="${reviewUrl}" class="btn-primary" target="_blank">
          Review Full CAM &amp; Record Decision &rarr;
        </a>
      </div>

      <div class="notice">
        <p>
          You can review the complete credit memorandum, financial statements, collateral schedules, and record your digital sign-off with conditions or remarks directly through the secure review link.
        </p>
        <p style="word-break: break-all; font-size: 11px; color: #94a3b8;">
          Direct Link: <a href="${reviewUrl}" style="color: #3b82f6;">${reviewUrl}</a>
        </p>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 4px; font-weight: 600;">LRSD Institutional Lending &amp; Risk Management System</p>
      <p style="margin: 0;">Confidential Credit Document • Authorized Committee Members Only</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

import { sendEmail } from "./resend";

/**
 * Sends a CAM approval request email to an approver using Resend SDK.
 */
export async function sendCamApprovalEmail(
  params: SendCamApprovalEmailParams,
): Promise<EmailSendResult> {
  const subject = `[Action Required] Credit Appraisal Memo Approval: ${params.borrowerName} (${params.applicationCode})`;
  const html = buildCamApprovalHtml(params);

  const res = await sendEmail({
    to: params.toEmail,
    subject,
    html,
  });

  return {
    success: res.success,
    messageId: res.messageId,
    simulated: res.simulated,
    error: res.error,
  };
}

