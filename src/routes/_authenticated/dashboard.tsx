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

  return (
    <div className="min-h-screen bg-background">
      <QuickCapture />

      <header className="mx-auto max-w-2xl px-4 pt-3 flex items-center justify-between">
        <h1 className="font-display text-2xl">Relay</h1>
        <div className="flex items-center gap-1">
          {google && !google.connected && google.configured && (
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
          )}
          <Link to="/contacts" aria-label="Contacts">
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Users className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/completed" aria-label="Completed tasks">
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <CheckSquare className="h-5 w-5" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4 space-y-6">
        <Section title="Today" count={groups.overdue.length + groups.today.length}>
          {groups.overdue.length === 0 && groups.today.length === 0 ? (
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
        </Section>

        {groups.waitingGroups.length > 0 && (
          <Section
            title="Waiting on Someone"
            count={groups.waitingGroups.reduce((n, g) => n + g.tasks.length, 0)}
          >
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
          </Section>
        )}


        {groups.upcoming.length > 0 && (
          <Section title="Upcoming" count={groups.upcoming.reduce((n, g) => n + g.tasks.length, 0)}>
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
          </Section>
        )}

        <Section
          title="Someday"
          count={groups.someday.length}
          collapsible
          open={somedayOpen}
          onToggle={() => setSomedayOpen((v) => !v)}
        >
          {somedayOpen && groups.someday.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              {groups.someday.map((t) => (
                <TaskRow key={t.id} task={t} contacts={contacts} />
              ))}
            </div>
          )}
        </Section>

        {tasks.length === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-4">
            Add your first task above
          </p>
        )}
      </main>
    </div>
  );
}

function Section({
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
    <section>
      <button
        type="button"
        onClick={onToggle}
        disabled={!collapsible}
        className="w-full flex items-center gap-2 py-2 text-left"
      >
        {collapsible &&
          (open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ))}
        <h2 className="font-display text-xl tracking-tight text-foreground/90">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </button>
      {children}
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

