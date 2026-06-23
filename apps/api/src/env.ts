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
  ALLOWED_STUDENT_EMAIL_DOMAINS: z.string().default("ub.ac.bw,buan.ac.bw,bac.ac.bw,bitri.co.bw,baisago.ac.bw,botho.ac.bw")
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";

/** Whether the optional managed services are configured. */
export const features = {
  supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  upstash: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  resend: Boolean(env.RESEND_API_KEY),
  postgres: Boolean(env.DATABASE_URL)
};
