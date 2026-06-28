import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./env.js";
import { genReqId, loggerOptions } from "./lib/logger.js";
import { registerUpstashRateLimit } from "./lib/rate-limit.js";
import { accountRoutes } from "./routes/account.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { loanRoutes } from "./routes/loans.js";
import { paymentRoutes } from "./routes/payments.js";
import { studentRoutes } from "./routes/student.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { PulaCashRepository, RepositoryError } from "./services/repository.js";

export async function createApp(repository = new PulaCashRepository()) {
  // Seed first-boot data (admin etc.) before the app accepts any traffic.
  await repository.ready();

  const app = Fastify({
    logger: loggerOptions,
    genReqId,
    // Only honour X-Forwarded-For behind a trusted proxy/LB; otherwise a direct
    // peer could spoof its IP and bypass the IP-keyed rate limits.
    trustProxy: env.TRUST_PROXY,
    // DoS mitigations: cap body size and drop slow/idle connections.
    bodyLimit: 256 * 1024,
    requestTimeout: 15_000,
    connectionTimeout: 10_000
  });

  // Parse JSON ourselves so the raw body is retained for payment-webhook HMAC
  // verification. Empty bodies parse to {} (POSTs with no payload); malformed JSON
  // surfaces a 400 (honoured by the error handler) rather than an opaque 500.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    (request as typeof request & { rawBody?: string }).rawBody = typeof body === "string" ? body : "";
    if (!body || (body as string).length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string));
    } catch {
      const error = new Error("Body is not valid JSON but content-type is set to 'application/json'") as Error & {
        statusCode?: number;
      };
      error.statusCode = 400;
      done(error);
    }
  });

  // Security headers. CSP is irrelevant for a JSON API and only adds noise.
  await app.register(helmet, { contentSecurityPolicy: false });

  // The API authenticates with bearer tokens (not cookies), so credentialed CORS
  // is never needed — keeping it off lets dev reflect any origin safely, while
  // production is pinned to an explicit allow-list (enforced in env.ts).
  await app.register(cors, {
    origin: env.APP_ORIGIN === "*" ? true : env.APP_ORIGIN.split(","),
    credentials: false
  });

  // Baseline in-memory rate limit (always on); Upstash adds a distributed layer.
  // The signature-verified payment webhook is exempt so a burst of legitimate
  // settlements is never dropped (it can't be abused without the HMAC secret).
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
    allowList: (request) => request.url === "/health" || request.url === "/webhooks/payments"
  });
  registerUpstashRateLimit(app);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RepositoryError) {
      reply.status(error.statusCode).send({ error: error.message });
      return;
    }
    const fastifyError = error as { statusCode?: number; validation?: unknown };
    if (fastifyError.validation) {
      reply.status(400).send({ error: "Invalid request." });
      return;
    }
    if (fastifyError.statusCode === 429) {
      reply.status(429).send({ error: "Too many requests. Please slow down." });
      return;
    }
    // Honour Fastify's own client-error codes (malformed JSON → 400, payload too
    // large → 413, etc.) instead of masking them as an opaque 500.
    const status = fastifyError.statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
      reply.status(status).send({ error: status === 400 ? "Invalid request." : "Request could not be processed." });
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
    await accountRoutes(scoped, repository);
    await studentRoutes(scoped, repository);
    await loanRoutes(scoped, repository);
    await subscriptionRoutes(scoped, repository);
    await feedbackRoutes(scoped, repository);
    await adminRoutes(scoped, repository);
    await paymentRoutes(scoped, repository);
  });

  return app;
}
