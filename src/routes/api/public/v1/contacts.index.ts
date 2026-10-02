import { createFileRoute } from "@tanstack/react-router";
import { ok, parseBody, withAuth } from "@/lib/rest-http.server";
import { contactInput } from "@/lib/tasks.schemas";
import { createContact, listContacts } from "@/lib/contacts.service.server";

export const Route = createFileRoute("/api/public/v1/contacts/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withAuth(request, async ({ supabase, userId }) => ok(await listContacts(supabase, userId))),
      POST: ({ request }) =>
        withAuth(request, async ({ supabase, userId }) => {
          const body = await parseBody(request, contactInput);
          return ok(await createContact(supabase, userId, body), 201);
        }),
    },
  },
});
