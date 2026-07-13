import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sourceEnum = z.enum(["From Boss", "Delegated by Me", "Personal Reminder"]);
const statusEnum = z.enum(["Not Started", "In Progress", "Waiting on Someone", "Done"]);
const categoryEnum = z.enum([
  "Travel",
  "Household",
  "Scheduling",
  "Errands",
  "Gifts/Events",
  "Finance",
  "Vendors",
  "Other",
]);
const priorityEnum = z.enum(["Normal", "Important", "Urgent"]);
const sourceTypeEnum = z.enum(["Typed", "Voice"]);

const TASK_COLUMNS =
  "id,title,notes,source,status,category,priority,assigned_to,assigned_to_name,delegated_to_contact_id,due_date,due_time,last_followup_at,next_followup_reminder_at,calendar_event_id,completed_at,source_type,voice_note_url,raw_transcript,created_at,updated_at";

const uuid = z.string().uuid();
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();
const timeStr = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .nullable()
  .optional();

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("user_id", userId)
      .neq("status", "Done")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCompleted = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,source,status,category,priority,assigned_to,assigned_to_name,completed_at,due_date,due_time,source_type",
      )
      .eq("user_id", userId)
      .eq("status", "Done")
      .order("completed_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  source: sourceEnum.default("Personal Reminder"),
  notes: z.string().optional().nullable(),
  category: categoryEnum.nullable().optional(),
  priority: priorityEnum.optional(),
  assigned_to: uuid.nullable().optional(),
  assigned_to_name: z.string().max(100).nullable().optional(),
  due_date: dateStr,
  due_time: timeStr,
  source_type: sourceTypeEnum.optional(),
  voice_note_url: z.string().max(500).nullable().optional(),
  raw_transcript: z.string().nullable().optional(),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.due_time && !data.due_date) {
      throw new Error("Time requires a date");
    }
    // Structured delegated_to_contact_id mirrors assigned_to when the task
    // is delegated and a saved contact was picked.
    const delegated =
      data.source === "Delegated by Me" && data.assigned_to
        ? data.assigned_to
        : null;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: data.title.trim(),
        source: data.source,
        notes: data.notes ?? null,
        category: data.category ?? null,
        priority: data.priority ?? "Normal",
        assigned_to: data.assigned_to ?? null,
        assigned_to_name: data.assigned_to_name?.trim() || null,
        delegated_to_contact_id: delegated,
        due_date: data.due_date ?? null,
        due_time: data.due_time ?? null,
        source_type: data.source_type ?? "Typed",
        voice_note_url: data.voice_note_url ?? null,
        raw_transcript: data.raw_transcript ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const updateInput = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  source: sourceEnum.optional(),
  status: statusEnum.optional(),
  category: categoryEnum.nullable().optional(),
  priority: priorityEnum.optional(),
  assigned_to: uuid.nullable().optional(),
  assigned_to_name: z.string().max(100).nullable().optional(),
  due_date: dateStr,
  due_time: timeStr,
});

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    if (patch.due_time && patch.due_date === null) {
      throw new Error("Time requires a date");
    }
    if (patch.due_date === null) patch.due_time = null;
    // Keep delegated_to_contact_id in sync if source/assignee change.
    const derived = { ...patch } as typeof patch & {
      delegated_to_contact_id?: string | null;
    };
    if ("assigned_to" in patch || "source" in patch) {
      const src = patch.source;
      const contact = patch.assigned_to;
      if (src === "Delegated by Me" && contact) {
        derived.delegated_to_contact_id = contact;
      } else if (src && src !== "Delegated by Me") {
        derived.delegated_to_contact_id = null;
      } else if ("assigned_to" in patch && !contact) {
        derived.delegated_to_contact_id = null;
      }
    }
    const { data: row, error } = await supabase
      .from("tasks")
      .update(derived)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const nudgeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: uuid,
        // null = clear reminder / skip; number = days from now
        remind_in_days: z.number().int().min(1).max(60).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nextAt =
      data.remind_in_days === null || data.remind_in_days === undefined
        ? null
        : new Date(
            Date.now() + data.remind_in_days * 24 * 60 * 60 * 1000,
          ).toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({
        last_followup_at: new Date().toISOString(),
        next_followup_reminder_at: nextAt,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
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
