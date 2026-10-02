import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createTaskInput,
  deleteTaskInput,
  nudgeTaskInput,
  updateTaskInput,
} from "@/lib/tasks.schemas";
import * as svc from "@/lib/tasks.service.server";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => svc.listTasks(context.supabase, context.userId));

export const listCompleted = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => svc.listCompleted(context.supabase, context.userId));

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createTaskInput.parse(raw))
  .handler(async ({ data, context }) => svc.createTask(context.supabase, context.userId, data));

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateTaskInput.parse(raw))
  .handler(async ({ data, context }) => svc.updateTask(context.supabase, context.userId, data));

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => deleteTaskInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { found: _found, ...res } = await svc.deleteTask(context.supabase, context.userId, data);
    return res as { ok: boolean; stoppedSeries?: boolean; spawnedNext?: boolean };
  });

export const nudgeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => nudgeTaskInput.parse(raw))
  .handler(async ({ data, context }) => {
    await svc.nudgeTask(context.supabase, context.userId, data);
    return { ok: true };
  });

/**
 * Return a short-lived signed URL for a stored voice note, so the user
 * can play back the original recording from the task detail view.
 */
export const getVoiceNoteUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ path: z.string().min(1).max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Path is scoped by first segment == userId (matches storage RLS).
    if (!data.path.startsWith(`${userId}/`)) {
      throw new Error("Forbidden");
    }
    const { data: signed, error } = await supabase.storage
      .from("voice-notes")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
