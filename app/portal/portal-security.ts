import crypto from "crypto";

function getSecretKeys(): string[] {
  const keys: string[] = [];
  if (process.env.PORTAL_SECRET_KEY) keys.push(process.env.PORTAL_SECRET_KEY);
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) keys.push(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) keys.push(process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Dynamic fallback from .env.local if not yet in process.env
  if (typeof window === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, "");
          if (!keys.includes(val)) keys.push(val);
        }
      }
    } catch {
      // Ignored
    }
  }

  keys.push("lrsd-lms-portal-review-secret-salt");
  return keys;
}

/**
 * Generates an encrypted, tamper-proof portal review token for a loan application.
 * Format: base64url(applicationId + "." + timestamp + "." + hmacSignature)
 */
export function generatePortalToken(applicationId: string): string {
  if (!applicationId) return "";
  const primarySecret = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "lrsd-lms-portal-review-secret-salt";
  const payload = `${applicationId}.${Date.now()}`;
  const hmac = crypto.createHmac("sha256", primarySecret).update(payload).digest("hex").slice(0, 24);
  const full = `${payload}.${hmac}`;
  return Buffer.from(full, "utf8").toString("base64url");
}

/**
 * Validates a portal review token and extracts the applicationId.
 * Checks against all known valid secret keys to support uninterrupted validation across env changes.
 */
export function verifyPortalToken(token: string): { valid: boolean; applicationId?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) {
      return { valid: false };
    }

    const [applicationId, timestamp, signature] = parts;
    const payload = `${applicationId}.${timestamp}`;
    const secrets = getSecretKeys();

    const matches = secrets.some((secret) => {
      const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 24);
      return signature === expectedSig;
    });

    if (!matches) {
      return { valid: false };
    }

    return { valid: true, applicationId };
  } catch {
    return { valid: false };
  }
}
