import { createFileRoute } from "@tanstack/react-router";
import { HttpError, noContent, ok, parseBody, parseId, withAuth } from "@/lib/rest-http.server";
import { deleteScopeEnum, updateTaskFields } from "@/lib/tasks.schemas";
import { deleteTask, getTask, updateTask } from "@/lib/tasks.service.server";

export const Route = createFileRoute("/api/public/v1/tasks/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Task");
          return ok(await getTask(supabase, userId, id));
        }),
      PATCH: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Task");
          const body = await parseBody(request, updateTaskFields);
          return ok(await updateTask(supabase, userId, { ...body, id }));
        }),
      DELETE: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Task");
          const scopeRaw = new URL(request.url).searchParams.get("scope");
          const scope = scopeRaw ? deleteScopeEnum.safeParse(scopeRaw) : null;
          if (scope && !scope.success) {
            throw new HttpError(400, "validation_failed", "scope must be 'one' or 'series'");
          }
          const res = await deleteTask(supabase, userId, { id, scope: scope?.data });
          if (!res.found) throw new HttpError(404, "not_found", "Task not found");
          return noContent();
        }),
    },
  },
});
