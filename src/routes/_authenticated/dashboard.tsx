import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Users,
  CheckSquare,
  Settings as SettingsIcon,
  Calendar as CalIcon,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { listTasks } from "@/lib/tasks.functions";
import { listContacts } from "@/lib/contacts.functions";
import { getProfile } from "@/lib/profile.functions";
import { getGoogleAuthUrl, getGoogleStatus } from "@/lib/google.functions";
import { todayISO } from "@/lib/date-utils";
import { formatDateLabel } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { QuickCapture, type FilterSource } from "@/components/QuickCapture";
import { TaskRow, type Task } from "@/components/TaskRow";
import { HeroSummary } from "@/components/HeroSummary";
import { OnboardingCard } from "@/components/OnboardingCard";
import {
  byPriority,
  CATEGORY_COLOR,
  CATEGORY_ICON,
  CATEGORY_ORDER,
  GROUP_RULE,
  type GroupKey,
  type TaskCategory,
} from "@/lib/task-style";

import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const searchSchema = z.object({ google: z.string().optional() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your day — Relay" },
      {
        name: "description",
        content:
          "Everything you're holding for today, what you're waiting on, and what's coming up — in one calm view.",
      },
      { property: "og:title", content: "Your day — Relay" },
      {
        property: "og:description",
        content:
          "Everything you're holding for today, what you're waiting on, and what's coming up — in one calm view.",
      },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: Dashboard,
});

type PanelKey = "overdue" | "today" | "waiting" | "upcoming" | "someday";

function Dashboard() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/dashboard" });
  const listT = useServerFn(listTasks);
  const listC = useServerFn(listContacts);
  const gStatus = useServerFn(getGoogleStatus);
  const gUrl = useServerFn(getGoogleAuthUrl);
  const getProf = useServerFn(getProfile);

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
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProf(),
  });

  const [open, setOpen] = useState<Record<PanelKey, boolean>>({
    overdue: true,
    today: true,
    waiting: true,
    upcoming: true,
    someday: false,
  });
  const toggle = (k: PanelKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    if (!search.google) return;
    if (search.google === "connected")
      toast.success("Google Calendar connected");
    else if (search.google.startsWith("error:"))
      toast.error(`Calendar connect failed: ${search.google.slice(6)}`);
    navigate({ to: "/dashboard", search: {}, replace: true });
  }, [search.google, navigate]);

  const today = todayISO();
  const [filter, setFilter] = useState<FilterSource>("All");

  const filteredTasks = useMemo(() => {
    if (filter === "All") return tasks as Task[];
    return (tasks as Task[]).filter((t) => t.source === filter);
  }, [tasks, filter]);
  const groups = useMemo(
    () => groupTasks(filteredTasks, today),
    [filteredTasks, today],
  );

  const greetingName = useMemo(() => {
    const raw = profile?.display_name ?? "";
    return raw.split(" ")[0] || "";
  }, [profile]);
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  async function connectGoogle() {
    const res = await gUrl();
    if (!res.ok) {
      if (res.reason === "not_configured") {
        toast.error(
          "Google Calendar is not set up yet. Ask your builder to add credentials.",
        );
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
    <TooltipProvider delayDuration={200}>
    <div className="min-h-screen bg-background">
      <QuickCapture filter={filter} onFilterChange={setFilter} />

      <header className="mx-auto flex max-w-7xl items-center justify-end gap-1 px-4 pt-2">
        <div className="flex shrink-0 items-center gap-1">
          {google && !google.connected && google.configured && (
            <Tip label="Link your calendar">
              <Button
                variant="ghost"
                size="sm"
                onClick={connectGoogle}
                className="h-9 rounded-full text-xs"
                aria-label="Connect Google Calendar"
              >
                <CalIcon className="mr-1 h-4 w-4" strokeWidth={2} />
                Connect Calendar
              </Button>
            </Tip>
          )}
          <Tip label="People">
            <Link to="/contacts" aria-label="People">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <Users className="h-5 w-5" strokeWidth={2} />
              </Button>
            </Link>
          </Tip>
          <Tip label="Completed tasks">
            <Link to="/completed" aria-label="Completed tasks">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <CheckSquare className="h-5 w-5" strokeWidth={2} />
              </Button>
            </Link>
          </Tip>
          <Tip label="Settings">
            <Link to="/settings" aria-label="Settings">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                <SettingsIcon className="h-5 w-5" strokeWidth={2} />
              </Button>
            </Link>
          </Tip>
          <Tip label="Sign out">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" strokeWidth={2} />
            </Button>
          </Tip>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-3 px-4 pb-16 pt-2">
        <HeroSummary
          greeting={
            greetingName ? `Good ${partOfDay}, ${greetingName}` : "Good to see you"
          }
          overdue={groups.overdue.length}
          dueToday={groups.today.length}
          waiting={waitingCount}
          comingUp={upcomingCount}
          whenever={groups.someday.length}
          doneToday={0}
        />

        <OnboardingCard />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.overdue.length > 0 && (
            <Panel
              title="Overdue"
              subtitle="These slipped past their date"
              count={groups.overdue.length}
              group="overdue"
              className="sm:col-span-2 xl:col-span-1"
              open={open.overdue}
              onToggle={() => toggle("overdue")}
            >
              <div className="space-y-1.5">
                {byPriority(groups.overdue).map((t) => (
                  <TaskRow key={t.id} task={t} contacts={contacts} overdue />
                ))}
              </div>
            </Panel>
          )}

          <Panel
            title="Due Today"
            subtitle="Let's get these done first"
            count={groups.today.length}
            group="today"
            className="sm:col-span-2 xl:col-span-1 xl:max-h-[calc(100vh-9rem)]"
            open={open.today}
            onToggle={() => toggle("today")}
          >
            {groups.today.length === 0 ? (
              <EmptyLine>Nothing due today — lovely.</EmptyLine>
            ) : (
              <div className="space-y-1.5">
                {byPriority(groups.today).map((t) => (
                  <TaskRow key={t.id} task={t} contacts={contacts} />
                ))}
              </div>
            )}
          </Panel>


          <Panel
            title="Waiting on Someone"
            subtitle="Nothing to do here yet — just keeping tabs"
            count={waitingCount}
            group="waiting"
            open={open.waiting}
            onToggle={() => toggle("waiting")}
          >
            {waitingCount === 0 ? (
              <EmptyLine>No one to chase right now.</EmptyLine>
            ) : (
              <div className="space-y-2.5">
                {groups.waitingGroups.map((g) => {
                  const contact = g.contactId
                    ? contacts.find((c) => c.id === g.contactId)
                    : null;
                  const label = contact
                    ? contact.role
                      ? `${contact.name} (${contact.role})`
                      : contact.name
                    : g.name || "Nobody named yet";
                  return (
                    <div key={g.key}>
                      <div className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
                        {label}
                      </div>
                      <div className="space-y-1.5">
                        {byPriority(g.tasks).map((t) => (
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

          <Panel
            title="Coming Up"
            subtitle="Nothing urgent — just so you're not surprised"
            count={upcomingCount}
            group="upcoming"
            open={open.upcoming}
            onToggle={() => toggle("upcoming")}
          >
            {upcomingCount === 0 ? (
              <EmptyLine>Nothing on the horizon.</EmptyLine>
            ) : (
              <div className="space-y-2.5">
                {groups.upcoming.map((g) => (
                  <div key={g.date}>
                    <div className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
                      {formatDateLabel(g.date)}
                    </div>
                    <div className="space-y-1.5">
                      {byPriority(g.tasks).map((t) => (
                        <TaskRow key={t.id} task={t} contacts={contacts} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Whenever You Get To It"
            subtitle="No date on these — dip in when you have a moment"
            count={groups.someday.length}
            group="whenever"
            className="sm:col-span-2"
            open={open.someday}
            onToggle={() => toggle("someday")}
          >
            {groups.someday.length === 0 ? (
              <EmptyLine>Nothing parked here.</EmptyLine>
            ) : (
              <div className="space-y-3">
                {groupByCategory(groups.someday).map((g) => {
                  const Icon = CATEGORY_ICON[g.category];
                  return (
                    <div key={g.category}>
                      <div className="flex items-center gap-2 px-1 pb-1">
                        <Icon
                          className="h-4 w-4"
                          strokeWidth={2}
                          style={{ color: CATEGORY_COLOR[g.category] }}
                        />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {g.category}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {byPriority(g.tasks).map((t) => (
                          <TaskRow key={t.id} task={t} contacts={contacts} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {tasks.length === 0 && (
          <p className="pt-2 text-center text-sm text-muted-foreground">
            Nothing here yet — type your first task up top.
          </p>
        )}
      </main>
    </div>
    </TooltipProvider>
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

function Panel({
  title,
  subtitle,
  count,
  children,
  group,
  className,
  open,
  onToggle,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  group: GroupKey;
  className?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section
      className={
        "relative flex min-w-0 flex-col overflow-hidden border border-border bg-card p-4 " +
        (className ?? "")
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-2 pb-2.5 text-left"
        style={{ borderBottom: GROUP_RULE[group] }}
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" strokeWidth={2} />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" strokeWidth={2} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <h2 className="truncate font-display text-foreground">{title}</h2>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {count}
            </span>
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto pt-3">{children}</div>
      )}
    </section>
  );
}



function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-sm text-muted-foreground">{children}</p>;
}

function groupByCategory(tasks: Task[]) {
  const map = new Map<TaskCategory, Task[]>();
  for (const t of tasks) {
    const c = (t.category ?? "Other") as TaskCategory;
    const arr = map.get(c) ?? [];
    arr.push(t);
    map.set(c, arr);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({
    category,
    tasks: map.get(category)!,
  }));
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
