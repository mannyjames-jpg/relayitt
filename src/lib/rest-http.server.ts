import type { SupabaseClient } from "@supabase/supabase-js";
import { z, ZodError, type ZodTypeAny } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { authenticateRequest, RestAuthError } from "@/lib/rest-auth.server";
import { ServiceError } from "@/lib/service-error";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const ok = (data: unknown, status = 200) => Response.json({ data }, { status });
export const noContent = () => new Response(null, { status: 204 });
export const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

function zodMessage(e: ZodError) {
  return e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    const text = await request.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "bad_json", "Request body must be valid JSON");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, "validation_failed", zodMessage(r.error));
  return r.data;
}

export function parseId(id: string | undefined, what = "Resource"): string {
  if (!id || !z.string().uuid().safeParse(id).success) {
    throw new HttpError(404, "not_found", `${what} not found`);
  }
  return id;
}

type Ctx = { userId: string; supabase: SupabaseClient<Database> };

/** Authenticate, run the handler, and map errors to the standard JSON envelope. */
export async function withAuth(request: Request, fn: (ctx: Ctx) => Promise<Response>) {
  try {
    const ctx = await authenticateRequest(request);
    return await fn(ctx);
  } catch (e) {
    if (e instanceof RestAuthError) return fail(401, "unauthorized", e.message);
    if (e instanceof HttpError) return fail(e.status, e.code, e.message);
    if (e instanceof ServiceError) return fail(e.status, e.code, e.message);
    if (e instanceof ZodError) return fail(400, "validation_failed", zodMessage(e));
    console.error("[rest]", e);
    return fail(500, "internal_error", "Something went wrong");
  }
}
