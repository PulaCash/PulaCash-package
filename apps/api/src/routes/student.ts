import { FastifyInstance } from "fastify";
import {
  studentProfileSchema,
  studentUploadIdSchema
} from "@pulacash/shared";
import { requireUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";
import { PulaCashRepository } from "../services/repository.js";
import { createIdUploadTarget } from "../services/storage.js";

export async function studentRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  app.get("/institutions", async () => repository.listInstitutions());

  app.post("/student/profile", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(studentProfileSchema, request.body);
    return repository.upsertProfile(user, input);
  });

  app.post("/student/upload-id", async (request) => {
    const user = requireUser(request, repository);
    const input = parseBody(studentUploadIdSchema, request.body);
    // The signed upload URL is minted server-side; the service-role key never
    // leaves the backend. The client PUTs the file to the returned signed URL.
    const target = await createIdUploadTarget(user.id, input.fileName, request.log);
    const status = repository.recordIdUpload(user, target.path);
    return {
      status,
      bucket: target.bucket,
      path: target.path,
      uploadUrl: target.uploadUrl,
      token: target.token
    };
  });

  app.get("/student/dashboard", async (request) => {
    const user = requireUser(request, repository);
    return repository.getDashboard(user);
  });
}
