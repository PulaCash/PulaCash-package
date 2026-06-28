import { FastifyInstance, FastifyRequest } from "fastify";
import { paymentWebhookSchema } from "@pulacash/shared";
import { parseBody } from "../lib/validation.js";
import { verifyWebhookSignature } from "../services/payments.js";
import { PulaCashRepository } from "../services/repository.js";

export async function paymentRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  // Provider settlement webhook. Trust is established by the HMAC signature over the
  // raw body — never by the payload contents alone. No bearer auth (the provider
  // isn't a user), so the signature check is the gate.
  app.post("/webhooks/payments", async (request, reply) => {
    const signature = request.headers["x-pulacash-signature"];
    const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? "";
    if (!verifyWebhookSignature(rawBody, typeof signature === "string" ? signature : undefined)) {
      reply.code(401).send({ error: "Invalid signature." });
      return;
    }
    const input = parseBody(paymentWebhookSchema, request.body);
    return repository.settlePayment(input.reference, input.status);
  });
}
