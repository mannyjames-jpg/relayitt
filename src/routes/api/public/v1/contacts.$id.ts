import { createFileRoute } from "@tanstack/react-router";
import { HttpError, noContent, ok, parseBody, parseId, withAuth } from "@/lib/rest-http.server";
import { contactPatchInput } from "@/lib/tasks.schemas";
import { deleteContact, getContact, updateContact } from "@/lib/contacts.service.server";

export const Route = createFileRoute("/api/public/v1/contacts/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Contact");
          return ok(await getContact(supabase, userId, id));
        }),
      PATCH: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Contact");
          const body = await parseBody(request, contactPatchInput);
          return ok(await updateContact(supabase, userId, { ...body, id }));
        }),
      DELETE: ({ request, params }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const id = parseId(params.id, "Contact");
          const res = await deleteContact(supabase, userId, id);
          if (!res.found) throw new HttpError(404, "not_found", "Contact not found");
          return noContent();
        }),
    },
  },
});
