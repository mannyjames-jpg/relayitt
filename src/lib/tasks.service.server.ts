import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { nextDueDate } from "@/lib/recurrence";
import { fromDbError, ServiceError } from "@/lib/service-error";
import type {
  CreateTaskInput,
  DeleteTaskInput,
  NudgeTaskInput,
  UpdateTaskInput,
} from "@/lib/tasks.schemas";

type DB = SupabaseClient<Database>;

export const TASK_COLUMNS =
  "id,title,notes,next_step,source,status,status_updated_at,category,priority,assigned_to,assigned_to_name,delegated_to_contact_id,due_date,due_time,last_followup_at,next_followup_reminder_at,calendar_event_id,completed_at,source_type,voice_note_url,raw_transcript,recurrence_type,recurrence_interval,recurrence_days,recurrence_end_date,parent_task_id,created_at,updated_at";

type Status = Database["public"]["Enums"] extends { task_status: infer S } ? S : string;

export async function listTasks(supabase: DB, userId: string, opts: { status?: string } = {}) {
  let q = supabase.from("tasks").select(TASK_COLUMNS).eq("user_id", userId);
  q = opts.status ? q.eq("status", opts.status as Status) : q.neq("status", "Complete");
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function listCompleted(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id,title,source,status,status_updated_at,category,priority,assigned_to,assigned_to_name,completed_at,due_date,due_time,source_type",
    )
    .eq("user_id", userId)
    .eq("status", "Complete")
    .order("completed_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function getTask(supabase: DB, userId: string, id: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ServiceError("Task not found", 404, "not_found");
  return data;
}

export async function createTask(supabase: DB, userId: string, data: CreateTaskInput) {
  if (data.due_time && !data.due_date) {
    throw new ServiceError("Time requires a date", 400, "validation_failed");
  }
  const delegated =
    data.source === "Delegated by Me" && data.assigned_to ? data.assigned_to : null;
  const { data: row, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: data.title.trim(),
      source: data.source,
      notes: data.notes ?? null,
      next_step: data.next_step?.trim() || null,
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
      recurrence_type: data.recurrence_type ?? "none",
      recurrence_interval: data.recurrence_interval ?? 1,
      recurrence_days: data.recurrence_days ?? [],
      recurrence_end_date: data.recurrence_end_date ?? null,
    })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  return row;
}

export async function updateTask(supabase: DB, userId: string, data: UpdateTaskInput) {
  const { id, ...patch } = data;
  if (patch.due_time && patch.due_date === null) {
    throw new ServiceError("Time requires a date", 400, "validation_failed");
  }
  if (patch.due_date === null) patch.due_time = null;
  const derived = { ...patch } as typeof patch & { delegated_to_contact_id?: string | null };
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
  if (error) throw fromDbError(error);

  // Completing an occurrence of a repeating task spawns the next one.
  if (patch.status === "Complete" && row.recurrence_type !== "none") {
    const rule = {
      recurrence_type: row.recurrence_type,
      recurrence_interval: row.recurrence_interval ?? 1,
      recurrence_days: row.recurrence_days ?? [],
      recurrence_end_date: row.recurrence_end_date ?? null,
    };
    const due = nextDueDate(row.due_date, rule);
    if (due) {
      await supabase.from("tasks").insert({
        user_id: userId,
        title: row.title,
        source: row.source,
        notes: row.notes,
        category: row.category,
        priority: row.priority,
        assigned_to: row.assigned_to,
        assigned_to_name: row.assigned_to_name,
        delegated_to_contact_id: row.delegated_to_contact_id,
        due_date: due,
        due_time: row.due_time,
        source_type: row.source_type,
        parent_task_id: row.parent_task_id ?? row.id,
        ...rule,
      });
    }
  }
  return row;
}

export async function deleteTask(supabase: DB, userId: string, data: DeleteTaskInput) {
  const { data: row } = await supabase
    .from("tasks")
    .select(
      "id,title,source,notes,category,priority,assigned_to,assigned_to_name,delegated_to_contact_id,due_date,due_time,source_type,parent_task_id,recurrence_type,recurrence_interval,recurrence_days,recurrence_end_date",
    )
    .eq("id", data.id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", data.id)
    .eq("user_id", userId);
  if (error) throw fromDbError(error);

  if (!row || row.recurrence_type === "none") return { ok: true, found: !!row };
  const rootId = row.parent_task_id ?? row.id;

  if (data.scope === "series") {
    await supabase
      .from("tasks")
      .update({ recurrence_type: "none" })
      .eq("user_id", userId)
      .or(`id.eq.${rootId},parent_task_id.eq.${rootId}`);
    return { ok: true, found: true, stoppedSeries: true };
  }

  const rule = {
    recurrence_type: row.recurrence_type,
    recurrence_interval: row.recurrence_interval ?? 1,
    recurrence_days: row.recurrence_days ?? [],
    recurrence_end_date: row.recurrence_end_date ?? null,
  };
  const due = nextDueDate(row.due_date, rule);
  if (due) {
    await supabase.from("tasks").insert({
      user_id: userId,
      title: row.title,
      source: row.source,
      notes: row.notes,
      category: row.category,
      priority: row.priority,
      assigned_to: row.assigned_to,
      assigned_to_name: row.assigned_to_name,
      delegated_to_contact_id: row.delegated_to_contact_id,
      due_date: due,
      due_time: row.due_time,
      source_type: row.source_type,
      parent_task_id: rootId,
      ...rule,
    });
  }
  return { ok: true, found: true, spawnedNext: !!due };
}

export async function nudgeTask(supabase: DB, userId: string, data: NudgeTaskInput) {
  const nextAt =
    data.remind_in_days === null || data.remind_in_days === undefined
      ? null
      : new Date(Date.now() + data.remind_in_days * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from("tasks")
    .update({
      last_followup_at: new Date().toISOString(),
      next_followup_reminder_at: nextAt,
    })
    .eq("id", data.id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw fromDbError(error);
  return { ok: true, found: (rows?.length ?? 0) > 0 };
}
