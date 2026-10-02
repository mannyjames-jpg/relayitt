import { createFileRoute } from "@tanstack/react-router";
import { HttpError, ok, parseBody, parseId, withAuth } from "@/lib/rest-http.server";
import { nudgeFields } from "@/lib/tasks.schemas";
import { nudgeTask } from "@/lib/tasks.service.server";

export const Route = createFileRoute("/api/public/v1/tasks/$id/nudge")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Task");
          const body = await parseBody(request, nudgeFields);
          const res = await nudgeTask(supabase, userId, { ...body, id });
          if (!res.found) throw new HttpError(404, "not_found", "Task not found");
          return ok({ ok: true });
        }),
    },
  },
});
