import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sourceEnum = z.enum(["From Boss", "Delegated by Me", "Personal Reminder"]);
const statusEnum = z.enum(["Not Started", "In Progress", "Waiting on Someone", "Done"]);

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
      .select(
        "id,title,notes,source,status,assigned_to,assigned_to_name,due_date,due_time,last_followup_at,calendar_event_id,completed_at,created_at,updated_at",
      )
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
      .select("id,title,source,status,assigned_to,assigned_to_name,completed_at,due_date,due_time")
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
  assigned_to: uuid.nullable().optional(),
  assigned_to_name: z.string().max(100).nullable().optional(),
  due_date: dateStr,
  due_time: timeStr,
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.due_time && !data.due_date) {
      throw new Error("Time requires a date");
    }
    const { data: row, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: data.title.trim(),
        source: data.source,
        notes: data.notes ?? null,
        assigned_to: data.assigned_to ?? null,
        assigned_to_name: data.assigned_to_name?.trim() || null,
        due_date: data.due_date ?? null,
        due_time: data.due_time ?? null,
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
    // Normalize: clearing due_date should also clear due_time
    if (patch.due_date === null) patch.due_time = null;
    const { data: row, error } = await supabase
      .from("tasks")
      .update(patch)
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
  .inputValidator((raw: unknown) => z.object({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tasks")
      .update({ last_followup_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
