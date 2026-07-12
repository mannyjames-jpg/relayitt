import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const err = url.searchParams.get("error");
        const publicUrl = process.env.PUBLIC_APP_URL ?? url.origin;
        const back = (msg: string) =>
          Response.redirect(
            `${publicUrl.replace(/\/$/, "")}/dashboard?google=${encodeURIComponent(msg)}`,
            302,
          );

        if (err) return back(`error:${err}`);
        if (!code || !state) return back("error:missing_params");

        let userId: string;
        try {
          const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
          userId = parsed.u;
          if (!userId) throw new Error("no user");
        } catch {
          return back("error:bad_state");
        }

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) return back("error:not_configured");

        const redirectUri = `${publicUrl.replace(/\/$/, "")}/api/public/google/callback`;

        const body = new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        });

        const resp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.error("Google token exchange failed", resp.status, text);
          return back("error:token_exchange");
        }
        const token = (await resp.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
        };
        if (!token.refresh_token) {
          // First time consent should return refresh_token because we send prompt=consent.
          return back("error:no_refresh_token");
        }

        const expiresAt = new Date(
          Date.now() + (token.expires_in - 60) * 1000,
        ).toISOString();

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { error } = await supabaseAdmin
          .from("google_tokens")
          .upsert(
            {
              user_id: userId,
              access_token: token.access_token,
              refresh_token: token.refresh_token,
              expires_at: expiresAt,
              scope: token.scope ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        if (error) {
          console.error("Failed to store google tokens", error);
          return back("error:save_failed");
        }

        return back("connected");
      },
    },
  },
});
