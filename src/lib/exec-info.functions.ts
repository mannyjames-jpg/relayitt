import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { EXEC_ROW_DEFS, EXEC_ROW_KINDS, fieldLabel, isSecretField } from "@/lib/exec-info.schema";

type Sb = SupabaseClient<Database>;
type AuditAction = "unlock" | "lock" | "reveal" | "edit" | "mfa_enrolled" | "mfa_removed";

const IDLE_MS = 10 * 60 * 1000;
const LOCKED = "locked";

async function audit(sb: Sb, userId: string, action: AuditAction, label: string | null) {
  await sb.from("exec_info_audit").insert({ user_id: userId, action, label });
}

function isAal2(claims: unknown): boolean {
  return (claims as { aal?: string } | null)?.aal === "aal2";
}

/** Requires aal2 + a session active within the last 10 minutes; slides the window. */
async function requireUnlocked(sb: Sb, userId: string, claims: unknown) {
  if (!isAal2(claims)) throw new Error(LOCKED);
  const { data, error } = await sb
    .from("exec_info_session")
    .select("last_active_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error(LOCKED);
  if (Date.now() - new Date(data.last_active_at).getTime() > IDLE_MS) throw new Error(LOCKED);
  await sb
    .from("exec_info_session")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId);
}

function rowLabel(kind: string, data: unknown): string {
  const def = EXEC_ROW_DEFS[kind as keyof typeof EXEC_ROW_DEFS];
  const program = (data as Record<string, unknown> | null)?.["program"];
  const name = typeof program === "string" && program ? ` ${program}` : "";
  return `${def?.label ?? "Row"}${name}${def?.secretLabel ? ` ${def.secretLabel}` : ""}`;
}

export const unlockExecInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    if (!isAal2(claims)) throw new Error(LOCKED);
    const { error } = await supabase
      .from("exec_info_session")
      .upsert(
        { user_id: userId, last_active_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(LOCKED);
    await audit(supabase, userId, "unlock", null);
    return { ok: true };
  });

export const lockExecInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // No delete policy on the session table: expire the window instead.
    await supabase
      .from("exec_info_session")
      .update({ last_active_at: new Date(0).toISOString() })
      .eq("user_id", userId);
    await audit(supabase, userId, "lock", null);
    return { ok: true };
  });

export const listExecInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    await requireUnlocked(supabase, userId, claims);
    const [f, r] = await Promise.all([
      supabase
        .from("exec_info_fields")
        .select("id,section,field_key,value_plain,value_cipher,is_secret,updated_at")
        .eq("user_id", userId),
      supabase
        .from("exec_info_rows")
        .select("id,kind,data,secret_cipher,position,updated_at")
        .eq("user_id", userId)
        .order("position"),
    ]);
    if (f.error || r.error) throw new Error("Could not load Executive info");
    return {
      fields: (f.data ?? []).map((x) =>
        x.is_secret
          ? {
              id: x.id,
              section: x.section,
              field_key: x.field_key,
              is_secret: true as const,
              has_value: !!x.value_cipher,
              updated_at: x.updated_at,
            }
          : {
              id: x.id,
              section: x.section,
              field_key: x.field_key,
              is_secret: false as const,
              value: x.value_plain,
              updated_at: x.updated_at,
            },
      ),
      rows: (r.data ?? []).map((x) => ({
        id: x.id,
        kind: x.kind,
        data: x.data as Record<string, string>,
        position: x.position,
        updated_at: x.updated_at,
        has_secret: !!x.secret_cipher,
      })),
    };
  });

export const revealExecSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ field_id: z.string().uuid().optional(), row_id: z.string().uuid().optional() })
      .refine((v) => !!v.field_id !== !!v.row_id)
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireUnlocked(supabase, userId, claims);
    const since = new Date(Date.now() - IDLE_MS).toISOString();
    const { count } = await supabase
      .from("exec_info_audit")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", "reveal")
      .gte("created_at", since);
    if ((count ?? 0) >= 30) throw new Error("Slow down — try again in a few minutes");

    let cipher: string | null = null;
    let label = "";
    if (data.field_id) {
      const { data: row } = await supabase
        .from("exec_info_fields")
        .select("section,field_key,value_cipher")
        .eq("id", data.field_id)
        .eq("user_id", userId)
        .maybeSingle();
      cipher = row?.value_cipher ?? null;
      if (row) label = fieldLabel(row.section, row.field_key);
    } else if (data.row_id) {
      const { data: row } = await supabase
        .from("exec_info_rows")
        .select("kind,data,secret_cipher")
        .eq("id", data.row_id)
        .eq("user_id", userId)
        .maybeSingle();
      cipher = row?.secret_cipher ?? null;
      if (row) label = rowLabel(row.kind, row.data);
    }
    if (!cipher) throw new Error("Nothing to show");
    const { decryptSecret } = await import("@/lib/exec-info.crypto.server");
    const value = await decryptSecret(cipher);
    await audit(supabase, userId, "reveal", `Revealed ${label}`);
    return { value };
  });

export const saveExecField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        section: z.string().min(1).max(60),
        field_key: z.string().min(1).max(60),
        value: z.string().max(2000),
        is_secret: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireUnlocked(supabase, userId, claims);
    // The shared schema decides secrecy; a client cannot downgrade a secret field.
    const secret = data.is_secret || isSecretField(data.section, data.field_key);
    const value = data.value.trim();
    let value_plain: string | null = null;
    let value_cipher: string | null = null;
    if (value) {
      if (secret) {
        const { encryptSecret } = await import("@/lib/exec-info.crypto.server");
        value_cipher = await encryptSecret(value);
      } else value_plain = value;
    }
    const { error } = await supabase.from("exec_info_fields").upsert(
      {
        user_id: userId,
        section: data.section,
        field_key: data.field_key,
        value_plain,
        value_cipher,
        is_secret: secret,
      },
      { onConflict: "user_id,section,field_key" },
    );
    if (error) throw new Error("Could not save");
    await audit(supabase, userId, "edit", `Edited ${fieldLabel(data.section, data.field_key)}`);
    return { ok: true };
  });

export const saveExecRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        kind: z.enum(EXEC_ROW_KINDS),
        data: z.record(z.string().max(60), z.string().max(2000)),
        secret: z.string().max(2000).optional(),
        position: z.number().int().min(0).max(10000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireUnlocked(supabase, userId, claims);
    const allowed = EXEC_ROW_DEFS[data.kind].columns;
    const clean: Record<string, string> = {};
    for (const k of allowed) if (data.data[k] !== undefined) clean[k] = data.data[k]!;

    const patch: Database["public"]["Tables"]["exec_info_rows"]["Insert"] = {
      user_id: userId,
      kind: data.kind,
      data: clean,
      ...(data.position !== undefined ? { position: data.position } : {}),
    };
    if (data.secret !== undefined && EXEC_ROW_DEFS[data.kind].hasSecret) {
      const s = data.secret.trim();
      if (s) {
        const { encryptSecret } = await import("@/lib/exec-info.crypto.server");
        patch.secret_cipher = await encryptSecret(s);
      } else patch.secret_cipher = null;
    }
    let id = data.id;
    if (id) {
      const { error } = await supabase
        .from("exec_info_rows")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw new Error("Could not save");
    } else {
      const { data: row, error } = await supabase
        .from("exec_info_rows")
        .insert(patch)
        .select("id")
        .single();
      if (error || !row) throw new Error("Could not save");
      id = row.id;
    }
    await audit(supabase, userId, "edit", `Edited ${rowLabel(data.kind, clean)}`);
    return { id };
  });

export const deleteExecRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireUnlocked(supabase, userId, claims);
    const { data: row } = await supabase
      .from("exec_info_rows")
      .select("kind,data")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    const { error } = await supabase
      .from("exec_info_rows")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error("Could not delete");
    await audit(supabase, userId, "edit", `Deleted ${row ? rowLabel(row.kind, row.data) : "row"}`);
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("exec_info_audit")
      .select("id,action,label,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error("Could not load activity");
    return rows ?? [];
  });

export const recordMfaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ action: z.enum(["mfa_enrolled", "mfa_removed"]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await audit(context.supabase, context.userId, data.action, null);
    return { ok: true };
  });

export type KeyDate =
  | {
      kind: "date";
      label: string;
      month: number;
      day: number;
      year: number | null;
      relationship: string | null;
      notes: string | null;
    }
  | { kind: "doc"; label: string; month: number; day: number; year: number };

function parseMdy(v: unknown): { month: number; day: number; year: number } | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { month, day, year };
}

/** Non-secret dates for the calendar. Normal session only; never touches ciphertext. */
export const listKeyDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KeyDate[]> => {
    const { supabase, userId } = context;
    const [rowsRes, fieldsRes] = await Promise.all([
      supabase
        .from("exec_info_rows")
        .select("kind,data")
        .eq("user_id", userId)
        .in("kind", ["date", "child"]),
      supabase
        .from("exec_info_fields")
        .select("section,field_key,value_plain")
        .eq("user_id", userId)
        .eq("is_secret", false)
        .in("field_key", ["dob", "wedding_anniversary", "expires"]),
    ]);
    if (rowsRes.error || fieldsRes.error) throw new Error("Could not load key dates");

    const out: KeyDate[] = [];
    const seen = new Set<string>();
    const push = (k: KeyDate) => {
      const id = `${k.label.toLowerCase()}|${k.month}|${k.day}|${k.year ?? ""}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(k);
    };
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

    for (const r of rowsRes.data ?? []) {
      const data = (r.data ?? {}) as Record<string, unknown>;
      if (r.kind === "date") {
        const p = parseMdy(data["date"]);
        const occasion = str(data["occasion"]);
        if (!p || !occasion) continue;
        const label = occasion
          .replace(/,\s*birthday$/i, "'s birthday")
          .replace(/,\s*anniversary$/i, " anniversary");
        push({
          kind: "date",
          label,
          ...p,
          relationship: str(data["relationship"]),
          notes: str(data["notes"]),
        });
      } else if (r.kind === "child") {
        const p = parseMdy(data["dob"]);
        const name = str(data["name"]);
        if (!p || !name) continue;
        push({
          kind: "date",
          label: `${name}'s birthday`,
          ...p,
          relationship: "Child",
          notes: null,
        });
      }
    }

    const FIELD_LABELS: Record<string, { label: string; kind: "date" | "doc"; rel?: string }> = {
      "personal.dob": { label: "Executive's birthday", kind: "date", rel: "Executive" },
      "spouse.dob": { label: "Spouse's birthday", kind: "date", rel: "Spouse" },
      "personal.wedding_anniversary": { label: "Wedding anniversary", kind: "date" },
      "passport1.expires": { label: "Passport #1 expires", kind: "doc" },
      "passport2.expires": { label: "Passport #2 expires", kind: "doc" },
      "visa1.expires": { label: "Visa #1 expires", kind: "doc" },
      "visa2.expires": { label: "Visa #2 expires", kind: "doc" },
    };
    for (const f of fieldsRes.data ?? []) {
      const def = FIELD_LABELS[`${f.section}.${f.field_key}`];
      const p = parseMdy(f.value_plain);
      if (!def || !p) continue;
      if (def.kind === "doc") push({ kind: "doc", label: def.label, ...p });
      else
        push({ kind: "date", label: def.label, ...p, relationship: def.rel ?? null, notes: null });
    }
    return out;
  });
