import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LogOut, Users, CheckSquare, Calendar as CalIcon } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listTasks } from "@/lib/tasks.functions";
import { listContacts } from "@/lib/contacts.functions";
import { getGoogleAuthUrl, getGoogleStatus } from "@/lib/google.functions";
import { todayISO } from "@/lib/date-utils";
import { formatDateLabel } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { QuickCapture, type FilterSource } from "@/components/QuickCapture";
import { useAuth } from "@/hooks/use-auth";
import { TaskRow, type Task } from "@/components/TaskRow";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const searchSchema = z.object({ google: z.string().optional() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Relay" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/dashboard" });
  const listT = useServerFn(listTasks);
  const listC = useServerFn(listContacts);
  const gStatus = useServerFn(getGoogleStatus);
  const gUrl = useServerFn(getGoogleAuthUrl);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listT(),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => listC(),
  });
  const { data: google } = useQuery({
    queryKey: ["google-status"],
    queryFn: () => gStatus(),
  });

  const [somedayOpen, setSomedayOpen] = useState(false);

  useEffect(() => {
    if (!search.google) return;
    if (search.google === "connected") toast.success("Google Calendar connected");
    else if (search.google.startsWith("error:"))
      toast.error(`Calendar connect failed: ${search.google.slice(6)}`);
    navigate({ to: "/dashboard", search: {}, replace: true });
  }, [search.google, navigate]);

  const today = todayISO();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterSource>("All");

  const filteredTasks = useMemo(() => {
    if (filter === "All") return tasks as Task[];
    return (tasks as Task[]).filter((t) => t.source === filter);
  }, [tasks, filter]);
  const groups = useMemo(() => groupTasks(filteredTasks, today), [filteredTasks, today]);

  const greetingName = useMemo(() => {
    const raw =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.name as string | undefined) ??
      user?.email?.split("@")[0] ??
      "";
    return raw.split(" ")[0] || "";
  }, [user]);
  const hour = new Date().getHours();
  const partOfDay =
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  async function connectGoogle() {
    const res = await gUrl();
    if (!res.ok) {
      if (res.reason === "not_configured") {
        toast.error("Google Calendar is not set up yet. Ask your builder to add credentials.");
      } else {
        toast.error("Missing app URL configuration.");
      }
      return;
    }
    window.location.href = res.url;
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const waitingCount = groups.waitingGroups.reduce(
    (n, g) => n + g.tasks.length,
    0,
  );
  const upcomingCount = groups.upcoming.reduce((n, g) => n + g.tasks.length, 0);
  const todayCount = groups.overdue.length + groups.today.length;

  return (
    <div className="min-h-screen bg-background">
      <QuickCapture filter={filter} onFilterChange={setFilter} />

      <header className="mx-auto max-w-7xl px-4 pt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl">
            {greetingName ? `Good ${partOfDay}, ${greetingName}` : "Relay"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <StatChip label="today" value={todayCount} accent={todayCount > 0} />
            <StatChip label="overdue" value={groups.overdue.length} accent={groups.overdue.length > 0} />
            <StatChip label="waiting" value={waitingCount} />
            <StatChip label="someday" value={groups.someday.length} />
          </div>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex shrink-0 items-center gap-1">
            {google && !google.connected && google.configured && (
              <Tip label="Connect Google Calendar">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={connectGoogle}
                  className="text-xs h-9"
                  aria-label="Connect Google Calendar"
                >
                  <CalIcon className="h-4 w-4 mr-1" />
                  Connect Calendar
                </Button>
              </Tip>
            )}
            <Tip label="Contacts">
              <Link to="/contacts" aria-label="Contacts">
                <Button variant="ghost" size="icon" className="h-11 w-11">
                  <Users className="h-5 w-5" />
                </Button>
              </Link>
            </Tip>
            <Tip label="Completed tasks">
              <Link to="/completed" aria-label="Completed tasks">
                <Button variant="ghost" size="icon" className="h-11 w-11">
                  <CheckSquare className="h-5 w-5" />
                </Button>
              </Link>
            </Tip>
            <Tip label="Sign out">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={signOut}
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </Tip>
          </div>
        </TooltipProvider>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Panel title="Today" count={todayCount}>
            {todayCount === 0 ? (
              <EmptyLine>Nothing due today</EmptyLine>
            ) : (
              <div className="rounded-lg border border-border bg-card">
                {groups.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} contacts={contacts} overdue />
                ))}
                {groups.today.map((t) => (
                  <TaskRow key={t.id} task={t} contacts={contacts} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Waiting on Someone" count={waitingCount}>
            {waitingCount === 0 ? (
              <EmptyLine>No one to chase</EmptyLine>
            ) : (
              <div className="space-y-3">
                {groups.waitingGroups.map((g) => {
                  const contact = g.contactId
                    ? contacts.find((c) => c.id === g.contactId)
                    : null;
                  const label = contact
                    ? contact.role
                      ? `${contact.name} (${contact.role})`
                      : contact.name
                    : g.name || "Unassigned";
                  return (
                    <div key={g.key}>
                      <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                        {label}
                      </div>
                      <div className="rounded-lg border border-border bg-card">
                        {g.tasks.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            contacts={contacts}
                            showWaitingBadge
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Upcoming" count={upcomingCount}>
            {upcomingCount === 0 ? (
              <EmptyLine>Nothing scheduled ahead</EmptyLine>
            ) : (
              <div className="space-y-3">
                {groups.upcoming.map((g) => (
                  <div key={g.date}>
                    <div className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                      {formatDateLabel(g.date)}
                    </div>
                    <div className="rounded-lg border border-border bg-card">
                      {g.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} contacts={contacts} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Someday"
            count={groups.someday.length}
            collapsible
            open={somedayOpen}
            onToggle={() => setSomedayOpen((v) => !v)}
          >
            {somedayOpen &&
              (groups.someday.length === 0 ? (
                <EmptyLine>Nothing parked here</EmptyLine>
              ) : (
                <div className="rounded-lg border border-border bg-card">
                  {groups.someday.map((t) => (
                    <TaskRow key={t.id} task={t} contacts={contacts} />
                  ))}
                </div>
              ))}
          </Panel>
        </div>

        {tasks.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-6">
            Add your first task above
          </p>
        )}
      </main>
    </div>
  );
}

function Tip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span
      className={
        accent
          ? "rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary"
          : "rounded-full bg-secondary px-2 py-0.5 text-muted-foreground"
      }
    >
      {value} {label}
    </span>
  );
}

function Panel({
  title,
  count,
  children,
  collapsible,
  open,
  onToggle,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border bg-surface/60 p-3 xl:max-h-[calc(100vh-13rem)]">
      <button
        type="button"
        onClick={onToggle}
        disabled={!collapsible}
        className="flex w-full items-center gap-2 pb-2 text-left"
      >
        {collapsible &&
          (open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ))}
        <h2 className="truncate font-display text-xl tracking-tight text-foreground/90">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground px-1 py-2">{children}</p>
  );
}


function groupTasks(tasks: Task[], today: string) {
  const overdue: Task[] = [];
  const todays: Task[] = [];
  const upcomingMap = new Map<string, Task[]>();
  const someday: Task[] = [];
  const waiting: Task[] = [];

  for (const t of tasks) {
    if (t.status === "Waiting on Someone") waiting.push(t);
    if (!t.due_date) {
      if (t.status !== "Waiting on Someone") someday.push(t);
      continue;
    }
    if (t.due_date < today) overdue.push(t);
    else if (t.due_date === today) todays.push(t);
    else {
      const arr = upcomingMap.get(t.due_date) ?? [];
      arr.push(t);
      upcomingMap.set(t.due_date, arr);
    }
  }

  todays.sort((a, b) => (a.due_time ?? "zz").localeCompare(b.due_time ?? "zz"));
  overdue.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const upcoming = [...upcomingMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tasks]) => ({
      date,
      tasks: tasks.sort((a, b) =>
        (a.due_time ?? "zz").localeCompare(b.due_time ?? "zz"),
      ),
    }));

  type WaitingGroup = {
    key: string;
    contactId: string | null;
    name: string | null;
    tasks: Task[];
  };
  const combined = new Map<string, WaitingGroup>();
  for (const t of waiting) {
    const key = t.assigned_to
      ? `c:${t.assigned_to}`
      : t.assigned_to_name
        ? `n:${t.assigned_to_name.toLowerCase()}`
        : "unassigned";
    const existing = combined.get(key);
    if (existing) existing.tasks.push(t);
    else
      combined.set(key, {
        key,
        contactId: t.assigned_to,
        name: t.assigned_to_name,
        tasks: [t],
      });
  }
  const waitingGroups: WaitingGroup[] = [...combined.values()];

  return { overdue, today: todays, upcoming, someday, waitingGroups };
}

