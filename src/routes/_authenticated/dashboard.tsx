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
import { QuickCapture } from "@/components/QuickCapture";
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
  const groups = useMemo(() => groupTasks(tasks as Task[], today), [tasks, today]);

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
        <h1 className="text-lg font-semibold">Relay</h1>
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
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
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

  // Group waiting by assignee
  const wMap = new Map<string, Task[]>();
  for (const t of waiting) {
    const key = t.assigned_to_name || "Unassigned";
    const arr = wMap.get(key) ?? [];
    arr.push(t);
    wMap.set(key, arr);
  }
  // Fill in real contact names via assigned_to when we regroup at render time is fine, but we've kept assigned_to_name null for contact-based.
  // Group by contact id too — use assigned_to as a secondary key.
  const waitingGroups: { label: string; tasks: Task[] }[] = [];
  const byContact = new Map<string | null, Task[]>();
  for (const t of waiting) {
    const k = t.assigned_to;
    const arr = byContact.get(k) ?? [];
    arr.push(t);
    byContact.set(k, arr);
  }
  // We'll return raw grouping; the label lookup happens at render — but simpler: recompute in caller.
  // For now, group by whichever identifier is present:
  const combined = new Map<string, Task[]>();
  for (const t of waiting) {
    const label = t.assigned_to
      ? `contact:${t.assigned_to}`
      : t.assigned_to_name
        ? `name:${t.assigned_to_name}`
        : "Unassigned";
    const arr = combined.get(label) ?? [];
    arr.push(t);
    combined.set(label, arr);
  }
  for (const [label, tasks] of combined) waitingGroups.push({ label, tasks });

  return { overdue, today: todays, upcoming, someday, waitingGroups };
}
