import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { FastifyInstance } from "fastify";
import { env, features } from "../env.js";

/**
 * Distributed, sliding-window rate limiting backed by Upstash Redis. This sits in
 * front of the in-memory @fastify/rate-limit baseline and only activates when
 * Upstash REST credentials are present, so local dev needs no Redis.
 *
 * Keyed by client IP. Returns 429 with a Retry-After hint when the budget is spent.
 */
export function registerUpstashRateLimit(app: FastifyInstance) {
  if (!features.upstash) {
    app.log.info("Upstash not configured — using in-memory rate limiting only.");
    return;
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!
  });

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(env.RATE_LIMIT_MAX, "60 s"),
    prefix: "pulacash:rl",
    analytics: false
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health" || request.url === "/webhooks/payments") return;
    const { success, limit, remaining, reset } = await limiter.limit(request.ip);
    reply.header("RateLimit-Limit", limit);
    reply.header("RateLimit-Remaining", Math.max(0, remaining));
    if (!success) {
      reply.header("Retry-After", Math.max(1, Math.ceil((reset - Date.now()) / 1000)));
      reply.code(429).send({ error: "Too many requests. Please slow down." });
    }
  });

  app.log.info("Upstash distributed rate limiting enabled.");
}

// Stricter per-route budget for auth endpoints (credential stuffing / brute force).
export const authRateLimit = {
  config: {
    rateLimit: {
      max: Math.max(10, Math.floor(env.RATE_LIMIT_MAX / 6)),
      timeWindow: "1 minute"
    }
  }
};
