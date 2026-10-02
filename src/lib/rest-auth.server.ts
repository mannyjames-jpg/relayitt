import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export class RestAuthError extends Error {}

/**
 * Validate the request's Bearer token and return a Supabase client that
 * acts as that user (RLS applies). Throws RestAuthError on any failure.
 */
export async function authenticateRequest(
  request: Request,
): Promise<{ userId: string; supabase: SupabaseClient<Database> }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Server is missing backend configuration");

  const header = request.headers.get("authorization");
  if (!header) throw new RestAuthError("Missing Authorization header");
  if (!header.startsWith("Bearer ")) throw new RestAuthError("Authorization must be a Bearer token");
  const token = header.slice(7).trim();
  if (!token || token.split(".").length !== 3) throw new RestAuthError("Invalid token");

  const supabase = createClient<Database>(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new RestAuthError("Invalid or expired token");
  return { userId: data.claims.sub, supabase };
}
