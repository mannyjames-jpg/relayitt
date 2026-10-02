import { createFileRoute } from "@tanstack/react-router";
import { HttpError, ok, parseBody, withAuth } from "@/lib/rest-http.server";
import { createTaskInput, statusEnum } from "@/lib/tasks.schemas";
import { createTask, listCompleted, listTasks } from "@/lib/tasks.service.server";

export const Route = createFileRoute("/api/public/v1/tasks/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const params = new URL(request.url).searchParams;
          if (params.get("completed") === "true") {
            return ok(await listCompleted(supabase, userId));
          }
          const statusRaw = params.get("status");
          let status: string | undefined;
          if (statusRaw) {
            const r = statusEnum.safeParse(statusRaw);
            if (!r.success) {
              throw new HttpError(400, "validation_failed", `status must be one of: ${statusEnum.options.join(", ")}`);
            }
            status = r.data;
          }
          return ok(await listTasks(supabase, userId, { status }));
        }),
      POST: ({ request }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const body = await parseBody(request, createTaskInput);
          return ok(await createTask(supabase, userId, body), 201);
        }),
    },
  },
});
