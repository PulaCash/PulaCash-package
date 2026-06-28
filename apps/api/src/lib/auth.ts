import { FastifyRequest } from "fastify";
import { User } from "@pulacash/shared";
import { PulaCashRepository, RepositoryError } from "../services/repository.js";

export function authTokenFromRequest(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : undefined;
}

export function requireUser(request: FastifyRequest, repository: PulaCashRepository): User {
  const user = repository.getUserByToken(authTokenFromRequest(request));
  if (!user) throw new RepositoryError(401, "Sign in to continue.");
  return user;
}

/** Require an authenticated admin. Defence-in-depth alongside the repository's own role checks. */
export function requireAdmin(request: FastifyRequest, repository: PulaCashRepository): User {
  const user = requireUser(request, repository);
  if (user.role !== "admin") throw new RepositoryError(403, "Admin access required.");
  return user;
}
