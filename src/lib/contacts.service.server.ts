import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fromDbError, ServiceError } from "@/lib/service-error";
import type { ContactInput, ContactPatchInput } from "@/lib/tasks.schemas";

type DB = SupabaseClient<Database>;

export async function listContacts(supabase: DB, userId: string) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,role,phone,email,notes,created_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function getContact(supabase: DB, userId: string, id: string) {
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw fromDbError(error);
  const { data: tasks, error: err2 } = await supabase
    .from("tasks")
    .select("id,title,status,source,due_date,due_time,completed_at,assigned_to_name")
    .eq("user_id", userId)
    .eq("assigned_to", id)
    .order("completed_at", { ascending: false, nullsFirst: true })
    .limit(200);
  if (err2) throw fromDbError(err2);
  return { contact, tasks: tasks ?? [] };
}

export async function createContact(supabase: DB, userId: string, data: ContactInput) {
  const { data: row, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: data.name.trim(),
      role: data.role?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email || null,
      notes: data.notes || null,
    })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  return row;
}

export async function updateContact(
  supabase: DB,
  userId: string,
  data: ContactPatchInput & { id: string },
) {
  const { id, ...patch } = data;
  const { data: row, error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  return row;
}

export async function deleteContact(supabase: DB, userId: string, id: string) {
  const { data: rows, error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw fromDbError(error);
  if (!rows || rows.length === 0) throw new ServiceError("Contact not found", 404, "not_found");
  return { ok: true };
}
