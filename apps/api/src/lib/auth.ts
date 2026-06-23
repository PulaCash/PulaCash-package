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
