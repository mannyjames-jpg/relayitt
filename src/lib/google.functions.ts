import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Build the Google OAuth authorize URL for the current user.
 * The user ID is embedded in `state` (base64) so the callback route can attribute the tokens.
 */
export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const publicUrl = process.env.PUBLIC_APP_URL;
    if (!clientId) {
      return { ok: false as const, reason: "not_configured" as const };
    }
    if (!publicUrl) {
      return { ok: false as const, reason: "missing_public_url" as const };
    }
    const redirectUri = `${publicUrl.replace(/\/$/, "")}/api/public/google/callback`;

    // Bind the OAuth state to a single-use, server-stored nonce for this user.
    const nonce = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: nonceError } = await supabaseAdmin
      .from("google_oauth_states")
      .insert({
        nonce,
        user_id: context.userId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    if (nonceError) {
      console.error("Failed to create Google OAuth state", nonceError);
      return { ok: false as const, reason: "state_error" as const };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state: nonce,
    });

    return {
      ok: true as const,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    };
  });

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("google_tokens")
      .select("user_id,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      connected: !!data,
      configured:
        !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin
      .from("google_tokens")
      .delete()
      .eq("user_id", context.userId);
    return { ok: true };
  });
