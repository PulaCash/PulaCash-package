import { FastifyInstance } from "fastify";
import { subscribeSchema } from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";

export async function subscriptionRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  app.get("/subscriptions/me", async (request) => {
    const user = requireUser(request, repository);
    return { tier: user.subscriptionTier, renewsAt: user.subscriptionRenewsAt };
  });

  app.post("/subscriptions/subscribe", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(subscribeSchema, request.body);
    return repository.subscribe(user, input.paymentMethod, request.log);
  });

  app.post("/subscriptions/cancel", async (request) => {
    const user = requireUser(request, repository);
    return repository.cancelSubscription(user);
  });
}
