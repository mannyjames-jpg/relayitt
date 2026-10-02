import { supabase } from "@/integrations/supabase/client";
import type * as TaskSvc from "@/lib/tasks.service.server";
import type * as ContactSvc from "@/lib/contacts.service.server";
import type {
  ContactInput,
  ContactPatchInput,
  CreateTaskInput,
  UpdateTaskInput,
} from "@/lib/tasks.schemas";

type R<F extends (...a: never[]) => unknown> = Awaited<ReturnType<F>>;

export type TaskList = R<typeof TaskSvc.listTasks>;
export type CompletedList = R<typeof TaskSvc.listCompleted>;
export type TaskRowData = R<typeof TaskSvc.createTask>;
export type ContactList = R<typeof ContactSvc.listContacts>;
export type ContactDetail = R<typeof ContactSvc.getContact>;
export type ContactRow = R<typeof ContactSvc.createContact>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api/public/v1";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network_error", "Couldn't reach the server. Check your connection.");
  }

  if (res.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
      window.location.assign("/auth");
    }
    throw new ApiError(401, "unauthorized", "Please sign in again.");
  }
  if (res.status === 204) return undefined as T;

  let json: { data?: T; error?: { code?: string; message?: string } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || !json || json.error) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? "internal_error",
      json?.error?.message ?? "Something went wrong. Try again.",
    );
  }
  return json.data as T;
}

type UpdateBody = Omit<UpdateTaskInput, "id">;

export const api = {
  tasks: {
    list: (opts: { status?: string } = {}) =>
      request<TaskList>(
        "GET",
        `/tasks${opts.status ? `?status=${encodeURIComponent(opts.status)}` : ""}`,
      ),
    listCompleted: () => request<CompletedList>("GET", "/tasks?completed=true"),
    create: (body: Partial<CreateTaskInput> & { title: string }) =>
      request<TaskRowData>("POST", "/tasks", body),
    update: (id: string, body: UpdateBody) =>
      request<TaskRowData>("PATCH", `/tasks/${encodeURIComponent(id)}`, body),
    remove: (id: string, scope?: "one" | "series") =>
      request<void>(
        "DELETE",
        `/tasks/${encodeURIComponent(id)}${scope === "series" ? "?scope=series" : ""}`,
      ),
    nudge: (id: string, body: { remind_in_days?: number | null }) =>
      request<{ ok: true }>("POST", `/tasks/${encodeURIComponent(id)}/nudge`, body),
  },
  contacts: {
    list: () => request<ContactList>("GET", "/contacts"),
    get: (id: string) => request<ContactDetail>("GET", `/contacts/${encodeURIComponent(id)}`),
    create: (body: ContactInput) => request<ContactRow>("POST", "/contacts", body),
    update: (id: string, body: ContactPatchInput) =>
      request<ContactRow>("PATCH", `/contacts/${encodeURIComponent(id)}`, body),
    remove: (id: string) => request<void>("DELETE", `/contacts/${encodeURIComponent(id)}`),
  },
};

/**
 * Adapters with the same `({ data })` call shape as the old server functions,
 * so screens can swap over without touching surrounding UI code.
 */
export const taskFns = {
  list: () => api.tasks.list(),
  listCompleted: () => api.tasks.listCompleted(),
  create: ({ data }: { data: Partial<CreateTaskInput> & { title: string } }) => api.tasks.create(data),
  update: ({ data: { id, ...body } }: { data: UpdateTaskInput }) => api.tasks.update(id, body),
  remove: async ({ data }: { data: { id: string; scope?: "one" | "series" } }) => {
    await api.tasks.remove(data.id, data.scope);
    return { ok: true as const };
  },
  nudge: async ({ data: { id, ...body } }: { data: { id: string; remind_in_days?: number | null } }) =>
    api.tasks.nudge(id, body),
};

export const contactFns = {
  list: () => api.contacts.list(),
  get: ({ data }: { data: { id: string } }) => api.contacts.get(data.id),
  create: ({ data }: { data: ContactInput }) => api.contacts.create(data),
  update: ({ data: { id, ...body } }: { data: ContactPatchInput & { id: string } }) =>
    api.contacts.update(id, body),
  remove: async ({ data }: { data: { id: string } }) => {
    await api.contacts.remove(data.id);
    return { ok: true as const };
  },
};

export function errorMessage(e: unknown, fallback = "Something went wrong. Try again.") {
  return e instanceof Error && e.message ? e.message : fallback;
}
