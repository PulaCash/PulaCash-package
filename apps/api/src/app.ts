import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./env.js";
import { genReqId, loggerOptions } from "./lib/logger.js";
import { registerUpstashRateLimit } from "./lib/rate-limit.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { loanRoutes } from "./routes/loans.js";
import { studentRoutes } from "./routes/student.js";
import { PulaCashRepository, RepositoryError } from "./services/repository.js";

export async function createApp(repository = new PulaCashRepository()) {
  const app = Fastify({
    logger: loggerOptions,
    genReqId,
    trustProxy: true,
    // DoS mitigations: cap body size and drop slow/idle connections.
    bodyLimit: 256 * 1024,
    requestTimeout: 15_000,
    connectionTimeout: 10_000
  });

  // Security headers. CSP is irrelevant for a JSON API and only adds noise.
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: env.APP_ORIGIN === "*" ? true : env.APP_ORIGIN.split(","),
    credentials: true
  });

  // Baseline in-memory rate limit (always on); Upstash adds a distributed layer.
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    allowList: (request) => request.url === "/health"
  });
  registerUpstashRateLimit(app);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RepositoryError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    const fastifyError = error as { statusCode?: number; validation?: unknown };
    if (fastifyError.statusCode === 429) {
      reply.status(429).send({ error: "Too many requests. Please slow down." });
      return;
    }
    if (fastifyError.validation) {
      reply.status(400).send({ error: "Invalid request." });
      return;
    }

    request.log.error(error);
    reply.status(500).send({ error: "Something went wrong." });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "pulacash-api"
  }));

  await app.register(async (scoped) => {
    await authRoutes(scoped, repository);
    await studentRoutes(scoped, repository);
    await loanRoutes(scoped, repository);
    await adminRoutes(scoped, repository);
  });

  return app;
}
