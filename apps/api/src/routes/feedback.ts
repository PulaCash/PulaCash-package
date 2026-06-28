import { FastifyInstance } from "fastify";
import { feedbackCreateSchema, idParamSchema } from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody, parseParams } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";

export async function feedbackRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  // The in-app feedback board. Auth required; responses expose author first names
  // only — never another user's full name, email, or id.
  app.get("/feedback", async (request) => {
    const user = requireUser(request, repository);
    return repository.listFeedback(user);
  });

  app.post("/feedback", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(feedbackCreateSchema, request.body);
    return repository.createFeedback(user, input);
  });

  app.post("/feedback/:id/vote", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    return repository.toggleFeedbackVote(user, params.id);
  });

  app.delete("/feedback/:id", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    return repository.deleteFeedback(user, params.id);
  });
}
