import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_ORIGIN: z.string().default("*"),
  DATABASE_URL: z.string().optional(),
  SQLITE_PATH: z.string().default("./pulacash.db"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("student-ids"),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("PulaCash <hello@pulacash.app>"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Global request budget per IP, per minute (baseline DoS protection).
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  ALLOWED_STUDENT_EMAIL_DOMAINS: z.string().default("ub.ac.bw,buan.ac.bw,bac.ac.bw,bitri.co.bw,baisago.ac.bw,botho.ac.bw"),
  // --- Admin bootstrap ---
  // The platform admin account, seeded on first boot. The password is required in
  // production (see guard below); locally it falls back to a dev-only default.
  ADMIN_EMAIL: z.string().email().default("tsenangthatayotlhe04@gmail.com"),
  ADMIN_NAME: z.string().default("PulaCash Admin"),
  ADMIN_PASSWORD: z.string().min(8).max(128).optional(),
  // Session lifetime, in days, before a bearer token must be re-issued by login.
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  // Honour X-Forwarded-For only when explicitly behind a trusted proxy/load balancer.
  // Off by default so a direct peer cannot spoof its IP to dodge rate limits.
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

// Dev/test convenience password so the seeded admin is usable without extra setup.
// Production must supply ADMIN_PASSWORD — we fail closed rather than ship a default.
const DEV_ADMIN_PASSWORD = "PulaCashAdmin!2026";

if (isProd) {
  if (!env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD must be set in production (no default admin credential is shipped).");
  }
  if (env.ADMIN_PASSWORD === DEV_ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD is set to the well-known dev default; choose a unique production password.");
  }
  if (env.APP_ORIGIN === "*") {
    throw new Error("APP_ORIGIN must be an explicit allow-list in production (cannot be '*').");
  }
}

export const adminCredentials = {
  email: env.ADMIN_EMAIL.toLowerCase(),
  name: env.ADMIN_NAME,
  password: env.ADMIN_PASSWORD ?? DEV_ADMIN_PASSWORD
};

/** Session token lifetime in milliseconds. */
export const sessionTtlMs = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Whether the optional managed services are configured. */
export const features = {
  supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  upstash: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  resend: Boolean(env.RESEND_API_KEY),
  postgres: Boolean(env.DATABASE_URL)
};
