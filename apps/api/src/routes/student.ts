import { FastifyInstance } from "fastify";
import {
  studentProfileSchema,
  studentUploadIdSchema
} from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";
import { uploadIdDocument } from "../services/storage.js";

export async function studentRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  app.get("/institutions", async () => repository.listInstitutions());

  app.post("/student/profile", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(studentProfileSchema, request.body);
    return repository.upsertProfile(user, input);
  });

  // Larger body limit for the ID image/PDF. The file is uploaded to managed storage
  // server-side; the client only ever talks to our backend.
  app.post("/student/upload-id", { bodyLimit: 8 * 1024 * 1024 }, async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(studentUploadIdSchema, request.body);
    const stored = await uploadIdDocument(user.id, input.fileName, input.mimeType, input.content, request.log);
    const status = repository.recordIdUpload(user, stored.path);
    return { status, bucket: stored.bucket, path: stored.path, stored: stored.stored };
  });

  app.get("/student/dashboard", async (request) => {
    const user = requireUser(request, repository);
    return repository.getDashboard(user);
  });
}
