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
 * Deliver a one-time code by email. When Resend isn't configured we log the code
 * (dev only — never in production) so the flow stays testable. Returns the code only
 * outside production so dev/test clients can auto-fill it.
 */
async function deliverCode(
  to: string,
  code: string,
  subject: string,
  intro: string,
  log: FastifyBaseLogger
): Promise<{ devCode?: string }> {
  const api = client();
  if (!api) {
    if (isProd) {
      log.warn({ to }, "Resend not configured in production — code email NOT sent.");
      return {};
    }
    log.info({ to, code }, "Resend not configured — one-time code logged (dev only).");
    return { devCode: code };
  }

  try {
    await api.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html: `<p>${intro}</p><p>Your code is <strong>${code}</strong>. It expires in 15 minutes.</p>`
    });
  } catch (err) {
    log.error({ err, to }, "Failed to send email.");
  }

  return isProd ? {} : { devCode: code };
}

export function sendVerificationEmail(to: string, code: string, log: FastifyBaseLogger) {
  return deliverCode(to, code, "Your PulaCash verification code", "Welcome to PulaCash. Confirm your email to continue.", log);
}

export function sendPasswordResetEmail(to: string, code: string, log: FastifyBaseLogger) {
  return deliverCode(
    to,
    code,
    "Your PulaCash password reset code",
    "We received a request to reset your PulaCash password. If this wasn't you, you can ignore this email.",
    log
  );
}
