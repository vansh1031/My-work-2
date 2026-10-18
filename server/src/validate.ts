import type { ZodType } from "zod";
import { AppError } from "./errors.js";

/** Checks request input against a schema. On failure, responds REQ-001 listing every bad field. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields = result.error.issues.map((i) => ({ field: i.path.join(".") || "(body)", problem: i.message }));
  const summary = fields.map((f) => `${f.field}: ${f.problem}`).join("; ");
  throw new AppError("REQ-001", `Some fields are missing or invalid. ${summary}`, fields);
}
