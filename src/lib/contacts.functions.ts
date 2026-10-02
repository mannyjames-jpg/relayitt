import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contactInput, uuid } from "@/lib/tasks.schemas";
import * as svc from "@/lib/contacts.service.server";

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => svc.listContacts(context.supabase, context.userId));

export const getContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => svc.getContact(context.supabase, context.userId, data.id));

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => contactInput.parse(raw))
  .handler(async ({ data, context }) => svc.createContact(context.supabase, context.userId, data));

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => contactInput.partial().extend({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => svc.updateContact(context.supabase, context.userId, data));

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: uuid }).parse(raw))
  .handler(async ({ data, context }) => {
    await svc.deleteContact(context.supabase, context.userId, data.id);
    return { ok: true };
  });
