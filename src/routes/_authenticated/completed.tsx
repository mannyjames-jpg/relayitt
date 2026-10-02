import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { contactFns, errorMessage, taskFns } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/completed")({
  head: () => ({ meta: [{ title: "Completed — Relay" }] }),
  component: CompletedPage,
});

function CompletedPage() {
  const qc = useQueryClient();
  const list = taskFns.listCompleted;
  const listC = contactFns.list;
  const update = taskFns.update;

  const completedQ = useQuery({
    queryKey: ["completed"],
    queryFn: () => list(),
  });
  const tasks = completedQ.data ?? [];
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => listC(),
  });

  const reopen = useMutation({
    mutationFn: update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completed"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          <Link to="/dashboard" aria-label="Back">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-hero text-2xl">Completed</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {completedQ.isPending ? (
          <LoadingState />
        ) : completedQ.isError ? (
          <ErrorState
            message="Couldn't load completed tasks. Try again."
            onRetry={() => completedQ.refetch()}
          />
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center pt-8">
            Nothing completed yet
          </p>
        ) : (
          <ul className="rounded-lg border border-border bg-card divide-y divide-border">
            {tasks.map((t) => {
              const assignee =
                contacts.find((c) => c.id === t.assigned_to)?.name ??
                t.assigned_to_name;
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-3 px-3 py-3 min-h-[56px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground line-through decoration-muted-foreground/50">
                      {t.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.source}
                      {assignee && ` · ${assignee}`}
                      {t.completed_at &&
                        ` · completed ${new Date(t.completed_at).toLocaleString()}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() =>
                      reopen.mutate({
                        data: { id: t.id, status: "Not Started" },
                      })
                    }
                    aria-label="Reopen task"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reopen
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
