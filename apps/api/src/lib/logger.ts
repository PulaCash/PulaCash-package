import { randomUUID } from "node:crypto";
import type { FastifyServerOptions } from "fastify";
import { env, isDev } from "../env.js";

/**
 * Pino logging configuration for Fastify.
 * - Redacts auth headers / passwords / tokens so secrets never hit the logs.
 * - Pretty, colourised output in development; structured JSON elsewhere.
 * - Silent under tests.
 */
export const loggerOptions: FastifyServerOptions["logger"] =
  env.NODE_ENV === "test"
    ? false
    : {
        level: env.LOG_LEVEL,
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.code",
            "*.password",
            "*.token"
          ],
          censor: "[redacted]"
        },
        transport: isDev
          ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
          : undefined
      };

/** Stable per-request id (honours an upstream X-Request-Id if present). */
export function genReqId(req: { headers: Record<string, unknown> }): string {
  const header = req.headers["x-request-id"];
  return typeof header === "string" && header.length > 0 ? header : randomUUID();
}
