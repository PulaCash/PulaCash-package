import type { FastifyBaseLogger } from "fastify";
import { env, features } from "../env.js";
import { getSupabaseAdmin } from "./supabase.js";

export type SignedUpload = {
  /** Object path inside the bucket. */
  path: string;
  /** Signed URL the client PUTs the file to (null when storage isn't configured). */
  uploadUrl: string | null;
  /** Token bound to the signed upload (Supabase returns this). */
  token: string | null;
  bucket: string;
};

/**
 * Create a one-time signed upload URL for a student ID document. The Supabase
 * service-role key stays on the server: the client only ever receives a scoped,
 * short-lived signed URL. Falls back to a deterministic path (no URL) in dev so
 * the flow still works without Supabase.
 */
export async function createIdUploadTarget(
  userId: string,
  fileName: string,
  log: FastifyBaseLogger
): Promise<SignedUpload> {
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const supabase = getSupabaseAdmin();
  if (!features.supabase || !supabase) {
    log.info({ path }, "Supabase Storage not configured — returning dev upload path.");
    return { path, uploadUrl: null, token: null, bucket };
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    log.error({ err: error }, "Failed to create signed upload URL.");
    return { path, uploadUrl: null, token: null, bucket };
  }

  return { path: data.path, uploadUrl: data.signedUrl, token: data.token, bucket };
}
