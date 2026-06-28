import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { PaymentKind, PaymentMethod, PaymentStatus } from "@pulacash/shared";
import { env, features } from "../env.js";

/**
 * One instruction to move money. `disbursement` credits the student (loan payout);
 * `repayment` and `subscription` debit them (collection). `reference` is our own
 * payment id and doubles as the provider idempotency key.
 */
export type PaymentInstruction = {
  kind: PaymentKind;
  amount: number;
  currency: string;
  reference: string;
  method: PaymentMethod;
  account?: string;
};

export type ProviderResult = { providerRef: string; status: PaymentStatus };

export interface PaymentProvider {
  readonly name: string;
  createPayment(instruction: PaymentInstruction, log: FastifyBaseLogger): Promise<ProviderResult>;
}

/**
 * Local/dev provider: settles synchronously so the whole loan loop works without a
 * real gateway. Never used when PAYMENT_PROVIDER=http.
 */
class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = "simulated";
  async createPayment(instruction: PaymentInstruction): Promise<ProviderResult> {
    return { providerRef: `sim_${instruction.kind}_${instruction.reference}`, status: "settled" };
  }
}

/**
 * Real provider scaffold. POSTs to a configured gateway (Orange Money / MyZaka / DPO
 * / Flutterwave, etc.) with the server-only API key and returns a *pending* payment;
 * the gateway later confirms settlement via the signed webhook. The service-role key
 * never leaves the backend.
 */
class HttpPaymentProvider implements PaymentProvider {
  readonly name = "http";
  async createPayment(instruction: PaymentInstruction, log: FastifyBaseLogger): Promise<ProviderResult> {
    const direction = instruction.kind === "disbursement" ? "credit" : "debit";
    const response = await fetch(`${env.PAYMENT_API_URL}/payments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.PAYMENT_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": instruction.reference
      },
      body: JSON.stringify({
        direction,
        amount: instruction.amount,
        currency: instruction.currency,
        method: instruction.method,
        account: instruction.account,
        reference: instruction.reference
      })
    });
    if (!response.ok) {
      log.error({ status: response.status, kind: instruction.kind }, "Payment provider rejected the request.");
      throw new Error("Payment could not be initiated. Please try again.");
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string; reference?: string };
    return { providerRef: data.id ?? data.reference ?? instruction.reference, status: "pending" };
  }
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) provider = features.livePayments ? new HttpPaymentProvider() : new SimulatedPaymentProvider();
  return provider;
}

/**
 * Verify a provider webhook's HMAC-SHA256 signature over the *raw* request body.
 * Returns false when no secret is configured (the webhook must not be trusted then).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  if (!env.PAYMENT_WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
