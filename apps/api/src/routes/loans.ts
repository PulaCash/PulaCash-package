import { FastifyInstance } from "fastify";
import {
  idParamSchema,
  loanApplySchema,
  repaymentInitiateSchema
} from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody, parseParams } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";

export async function loanRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  app.post("/loans/apply", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(loanApplySchema, request.body);
    return repository.applyForLoan(user, input, request.log);
  });

  app.get("/loans/me", async (request) => {
    const user = requireUser(request, repository);
    return repository.listMyLoans(user);
  });

  app.get("/loans/:id", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    return repository.getLoanForUser(user, params.id);
  });

  app.post("/repayments/initiate", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(repaymentInitiateSchema, request.body);
    // No amount is accepted from the client — the server charges exactly what is owed.
    return repository.initiateRepayment(user, input.loanId, input.method, request.log);
  });

  app.get("/payments/me", async (request) => {
    const user = requireUser(request, repository);
    return repository.listMyPayments(user);
  });

  app.get("/repayments/me", async (request) => {
    const user = requireUser(request, repository);
    return repository.listMyRepayments(user);
  });
}
