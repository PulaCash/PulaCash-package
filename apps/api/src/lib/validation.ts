import { z, ZodTypeAny } from "zod";
import { RepositoryError } from "../services/repository.js";

// Returns the schema's *output* type so Zod defaults (e.g. repaymentPlan) are
// reflected as present, not optional, after parsing.
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new RepositoryError(400, result.error.issues.map((issue) => issue.message).join(" "));
  }
  return result.data;
}

export function parseParams<S extends ZodTypeAny>(schema: S, params: unknown): z.output<S> {
  return parseBody(schema, params);
}
