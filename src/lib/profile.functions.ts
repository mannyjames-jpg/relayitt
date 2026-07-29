import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FONT_CHOICES = ["system", "inter", "plex"] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,display_name,font_choice")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? { user_id: userId, display_name: null, font_choice: "system" }
    );
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        display_name: z.string().trim().max(80).nullable().optional(),
        font_choice: z.enum(FONT_CHOICES).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          ...(data.display_name !== undefined
            ? { display_name: data.display_name || null }
            : {}),
          ...(data.font_choice !== undefined
            ? { font_choice: data.font_choice }
            : {}),
        },
        { onConflict: "user_id" },
      )
      .select("user_id,display_name,font_choice")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
