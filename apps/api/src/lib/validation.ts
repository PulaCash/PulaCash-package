import { ZodSchema } from "zod";
import { RepositoryError } from "../services/repository.js";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new RepositoryError(400, result.error.issues.map((issue) => issue.message).join(" "));
  }
  return result.data;
}

export function parseParams<T>(schema: ZodSchema<T>, params: unknown): T {
  return parseBody(schema, params);
}
