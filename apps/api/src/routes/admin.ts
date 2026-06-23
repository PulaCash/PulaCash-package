import { FastifyInstance } from "fastify";
import {
  adminLoanDecisionSchema,
  blacklistStudentSchema,
  idParamSchema
} from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody, parseParams } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";

export async function adminRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  app.get("/admin/dashboard", async (request) => {
    const user = requireUser(request, repository);
    return repository.getAdminDashboard(user);
  });

  app.get("/admin/loan-applications", async (request) => {
    const user = requireUser(request, repository);
    return repository.listLoanApplications(user);
  });

  app.post("/admin/loans/:id/approve", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    return repository.approveLoan(user, params.id);
  });

  app.post("/admin/loans/:id/reject", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    const input = parseBody(adminLoanDecisionSchema, request.body ?? {});
    return repository.rejectLoan(user, params.id, input.reason);
  });

  app.get("/admin/students", async (request) => {
    const user = requireUser(request, repository);
    const query = request.query as { q?: string };
    return repository.listStudents(user, query.q);
  });

  app.get("/admin/students/:id", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    return repository.getStudent(user, params.id);
  });

  app.post("/admin/students/:id/blacklist", async (request) => {
    const user = requireUser(request, repository);
    const params = parseParams(idParamSchema, request.params);
    const input = parseBody(blacklistStudentSchema, request.body);
    return repository.blacklistStudent(user, params.id, input);
  });
}
