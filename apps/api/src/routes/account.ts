import { FastifyInstance } from "fastify";
import { accountDeleteSchema } from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";

export async function accountRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  // In-app account deletion (App Store Guideline 5.1.1(v)). Re-authenticates with the
  // current password, then erases/anonymises the account and revokes all sessions.
  app.post("/account/delete", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(accountDeleteSchema, request.body);
    return repository.deleteAccount(user, input.password);
  });
}
