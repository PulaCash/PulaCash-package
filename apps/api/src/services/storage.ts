import type { FastifyBaseLogger } from "fastify";
import { env, features } from "../env.js";
import { RepositoryError } from "./repository.js";
import { getSupabaseAdmin } from "./supabase.js";

export type StoredDocument = {
  /** Object path inside the bucket. */
  path: string;
  bucket: string;
  /** True when the bytes were actually written to managed storage (vs dev fallback). */
  stored: boolean;
};

/**
 * Store a student ID document. The file is uploaded to Supabase Storage **from the
 * backend** using the server-only service-role key — the client never talks to
 * storage directly. Falls back to a deterministic path (no write) in dev so the flow
 * still works without Supabase configured.
 */
export async function uploadIdDocument(
  userId: string,
  fileName: string,
  mimeType: string,
  base64: string,
  log: FastifyBaseLogger
): Promise<StoredDocument> {
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const supabase = getSupabaseAdmin();
  if (!features.supabase || !supabase) {
    log.info({ path }, "Supabase Storage not configured — recording dev path only.");
    return { path, bucket, stored: false };
  }

  const buffer = Buffer.from(base64, "base64");
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) {
    log.error({ err: error }, "Failed to store ID document.");
    throw new RepositoryError(502, "Could not store your ID right now. Please try again.");
  }
  return { path, bucket, stored: true };
}
