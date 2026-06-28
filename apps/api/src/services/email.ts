import type { FastifyBaseLogger } from "fastify";
import { Resend } from "resend";
import { env, features, isProd } from "../env.js";

let resend: Resend | null = null;

function client(): Resend | null {
  if (!features.resend) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY!);
  return resend;
}

/**
 * Send the student email-verification code via Resend. When Resend isn't
 * configured we log the code instead (dev only) so the flow remains testable.
 * Returns the code only outside production, so dev/test clients can auto-fill it.
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  log: FastifyBaseLogger
): Promise<{ devCode?: string }> {
  const api = client();
  if (!api) {
    if (isProd) {
      // Never write a live code to the logs. In production this path is a
      // misconfiguration (Resend should be set), so warn without the secret.
      log.warn({ to }, "Resend not configured in production — verification email NOT sent.");
      return {};
    }
    log.info({ to, code }, "Resend not configured — verification code logged (dev only).");
    return { devCode: code };
  }

  try {
    await api.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: "Your PulaCash verification code",
      html: `<p>Welcome to PulaCash.</p><p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`
    });
  } catch (err) {
    log.error({ err, to }, "Failed to send verification email.");
  }

  return isProd ? {} : { devCode: code };
}
