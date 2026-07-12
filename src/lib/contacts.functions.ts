import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,role,phone,email,notes,created_at")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: contact, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    const { data: tasks, error: err2 } = await supabase
      .from("tasks")
      .select(
        "id,title,status,source,due_date,due_time,completed_at,assigned_to_name",
      )
      .eq("user_id", userId)
      .eq("assigned_to", data.id)
      .order("completed_at", { ascending: false, nullsFirst: true })
      .limit(200);
    if (err2) throw new Error(err2.message);
    return { contact, tasks: tasks ?? [] };
  });

const contactInput = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  notes: z.string().nullable().optional(),
});

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => contactInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
    if (error) throw new Error(error.message);
    return row;
  });

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    contactInput.partial().extend({ id: uuid }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("contacts")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
