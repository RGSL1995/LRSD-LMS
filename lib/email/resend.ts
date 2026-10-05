import { Resend } from "resend";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export type EmailSendResult = SendEmailResponse;

let resendInstance: Resend | null = null;

/**
 * Returns a cached singleton Resend client instance if RESEND_API_KEY is present.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

/**
 * Default Sender Address:
 * - If user specifies EMAIL_FROM (e.g. 'LRSD Risk <approvals@lrsd.com>'), uses that.
 * - Otherwise defaults to Resend testing sender 'LRSD LMS <onboarding@resend.dev>'.
 */
export function getDefaultFromEmail(): string {
  if (process.env.EMAIL_FROM?.trim()) {
    return process.env.EMAIL_FROM.trim();
  }
  return "LRSD LMS <onboarding@resend.dev>";
}

/**
 * Universal email sender utility powered by Resend SDK.
 * If RESEND_API_KEY is not configured, logs the email payload and returns simulated success.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResponse> {
  const { to, subject, html, text, from, replyTo, cc, bcc } = options;
  const resend = getResendClient();

  const recipientList = Array.isArray(to) ? to : [to];
  const sender = from || getDefaultFromEmail();

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: sender,
        to: recipientList,
        subject,
        html,
        text,
        replyTo: replyTo ? (Array.isArray(replyTo) ? replyTo : [replyTo]) : undefined,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      });

      if (error) {
        console.error("[Resend API Error]:", error);
        return {
          success: false,
          error: error.message || "Failed to dispatch email via Resend.",
        };
      }

      console.log(`[Resend] Successfully sent email to ${recipientList.join(", ")}. Message ID: ${data?.id}`);
      return {
        success: true,
        messageId: data?.id,
        simulated: false,
      };
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      console.error("[Resend Exception]:", err);
      return {
        success: false,
        error: errorObj?.message || "Unexpected error dispatching email with Resend.",
      };
    }
  }

  // Fallback Simulation Mode (when RESEND_API_KEY is not yet added in .env)
  console.log("============================================================");
  console.log(`📧 [RESEND SIMULATION MODE - NO API KEY SET]`);
  console.log(`From: ${sender}`);
  console.log(`To: ${recipientList.join(", ")}`);
  console.log(`Subject: ${subject}`);
  console.log(`Status: Simulated successfully (Add RESEND_API_KEY to .env.local to send live emails)`);
  console.log("============================================================");

  return {
    success: true,
    messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    simulated: true,
  };
}
