import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/v1/health")({
  server: {
    handlers: {
      GET: async () => Response.json({ data: { status: "ok" } }),
    },
  },
});
