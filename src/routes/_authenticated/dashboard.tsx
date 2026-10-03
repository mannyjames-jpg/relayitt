import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Calendar as CalIcon, Menu } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { contactFns, taskFns } from "@/lib/api-client";
import { ErrorState, LoadingState } from "@/components/QueryState";
import { getProfile } from "@/lib/profile.functions";
import { getGoogleAuthUrl, getGoogleStatus } from "@/lib/google.functions";
import { daysSince, formatDateLabel, formatTime, todayISO } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { TooltipProvider } from "@/components/ui/tooltip";

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
  const listT = taskFns.list;
  const listC = contactFns.list;
  const gStatus = useServerFn(getGoogleStatus);
  const gUrl = useServerFn(getGoogleAuthUrl);
  const getProf = useServerFn(getProfile);

  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: () => listT(),
  });
  const tasks = tasksQ.data ?? [];
  const { data: completedTasks = [] } = useQuery({
    queryKey: ["completed"],
    queryFn: () => taskFns.listCompleted(),
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
    if (search.google === "connected") toast.success("Google Calendar connected");
    else if (search.google.startsWith("error:"))
      toast.error(`Calendar connect failed: ${search.google.slice(6)}`);
    navigate({ to: "/dashboard", search: {}, replace: true });
  }, [search.google, navigate]);

  const today = todayISO();
  const [filter, setFilter] = useState<FilterSource>("All");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const quickCaptureRef = useRef<HTMLInputElement>(null);
  const [captureHeight, setCaptureHeight] = useState(132);
  const [currentSection, setCurrentSection] = useState<PanelKey>("overdue");

  const filteredTasks = useMemo(() => {
    if (filter === "All") return tasks as Task[];
    return (tasks as Task[]).filter((t) => t.source === filter);
  }, [tasks, filter]);
  const groups = useMemo(() => groupTasks(filteredTasks, today), [filteredTasks, today]);

  const todayCount = groups.overdue.length + groups.today.length;
  const doneToday = completedTasks.filter(
    (task) => task.completed_at && new Date(task.completed_at).toLocaleDateString("en-CA") === today,
  ).length;

  useEffect(() => {
    document.title = todayCount > 0 ? `(${todayCount}) Your day — Relay` : "Your day — Relay";
    return () => {
      document.title = "Your day — Relay";
    };
  }, [todayCount]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const tag = target?.tagName;
      const editing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      const overlayOpen = Boolean(
        document.querySelector('[role="dialog"], [role="listbox"][data-state="open"]'),
      );

      if (editing || overlayOpen || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "/") {
        event.preventDefault();
        quickCaptureRef.current?.focus();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      const titles = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-task-title]"),
      ).filter((button) => button.offsetParent !== null);
      const current = target?.closest<HTMLButtonElement>("[data-task-title]");
      const currentIndex = current ? titles.indexOf(current) : -1;

      if (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k") {
        if (titles.length === 0) return;
        event.preventDefault();
        const nextIndex =
          event.key.toLowerCase() === "j"
            ? currentIndex < 0
              ? 0
              : Math.min(currentIndex + 1, titles.length - 1)
            : currentIndex < 0
              ? titles.length - 1
              : Math.max(currentIndex - 1, 0);
        titles[nextIndex]?.focus();
        titles[nextIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (event.key.toLowerCase() === "x" && current && currentIndex >= 0) {
        const taskId = current.dataset.taskTitle;
        const checkbox = taskId
          ? document.querySelector<HTMLButtonElement>(`[data-task-check="${CSS.escape(taskId)}"]`)
          : null;
        if (!checkbox) return;
        event.preventDefault();
        checkbox.click();

        const focusAfterRemoval = () => {
          const remaining = Array.from(
            document.querySelectorAll<HTMLButtonElement>("[data-task-title]"),
          ).filter((button) => button.offsetParent !== null);
          const next = remaining[Math.min(currentIndex, remaining.length - 1)];
          next?.focus();
          next?.scrollIntoView({ block: "nearest" });
        };
        const observer = new MutationObserver(() => {
          if (!taskId || !document.querySelector(`[data-task-title="${CSS.escape(taskId)}"]`)) {
            observer.disconnect();
            focusAfterRemoval();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.setTimeout(() => observer.disconnect(), 5000);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const waitingCount = groups.waitingGroups.reduce((n, g) => n + g.tasks.length, 0);
  const upcomingCount = groups.upcoming.reduce((n, g) => n + g.tasks.length, 0);
  const followUpCount = groups.waitingGroups.reduce(
    (count, group) =>
      count +
      group.tasks.filter(
        (task) =>
          daysSince(task.last_followup_at ?? task.created_at) >= 3 ||
          (!!task.next_followup_reminder_at &&
            new Date(task.next_followup_reminder_at).getTime() < Date.now()),
      ).length,
    0,
  );
  const upNext = useMemo(() => {
    const next = filteredTasks
      .filter(
        (task) => task.status !== "Waiting on Someone" && !!task.due_date && task.due_date >= today,
      )
      .sort((a, b) => {
        const dateOrder = (a.due_date ?? "").localeCompare(b.due_date ?? "");
        return dateOrder || (a.due_time ?? "zz").localeCompare(b.due_time ?? "zz");
      })[0];
    if (!next) return null;
    const [year, month, day] = (next.due_date ?? today).split("-").map(Number);
    return {
      title: next.title,
      time: next.due_time ? formatTime(next.due_time) : null,
      date:
        next.due_date === today
          ? null
          : new Date(year, month - 1, day).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
    };
  }, [filteredTasks, today]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    let frame = 0;
    const updateCurrentSection = () => {
      frame = 0;
      const threshold = window.innerHeight * 0.45;
      const sections: Array<[PanelKey, string]> = [
        ["overdue", "sec-overdue"],
        ["today", "sec-today"],
        ["waiting", "sec-waiting"],
        ["upcoming", "sec-coming"],
        ["someday", "sec-whenever"],
      ];
      let next: PanelKey = "overdue";
      for (const [key, id] of sections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= threshold) next = key;
      }
      setCurrentSection(next);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateCurrentSection);
    };
    updateCurrentSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [filteredTasks.length]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const displayName = profile?.display_name?.trim() || "Relay user";
  const initial = displayName.charAt(0).toUpperCase();
  const showCalendarConnect = google && !google.connected && google.configured;

  const moreMenu = (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-none min-[821px]:hidden"
          aria-label="More"
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(84vw,320px)] rounded-none border-border-strong bg-background shadow-none [transition-duration:300ms]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-wordmark">Relay</SheetTitle>
        </SheetHeader>
        <nav className="mt-8 border-t border-border" aria-label="More navigation">
          {[
            ["People", "/contacts"],
            ["Completed", "/completed"],
            ["Calendar", "/calendar"],
            ["Applicants", "/applicants"],
            ["Settings", "/settings"],
          ].map(([label, to]) => (
            <SheetClose asChild key={to}>
              <Link
                to={to}
                className="flex min-h-12 items-center border-b border-border text-sm font-medium text-foreground"
              >
                {label}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-6 space-y-2">
          {showCalendarConnect && (
            <Button
              variant="outline"
              className="h-11 w-full justify-start rounded-none shadow-none"
              onClick={connectGoogle}
            >
              <CalIcon className="h-4 w-4" strokeWidth={2} />
              Connect Calendar
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-11 w-full justify-start rounded-none"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div data-relay-workspace className="min-h-screen bg-surface min-[821px]:grid min-[821px]:grid-cols-[232px_minmax(0,1fr)]">
        <DashboardSidebar
          overdue={groups.overdue.length}
          dueToday={groups.today.length}
          waiting={waitingCount}
          coming={upcomingCount}
          whenever={groups.someday.length}
          current={currentSection}
          displayName={displayName}
          initial={initial}
          showCalendarConnect={!!showCalendarConnect}
          onConnectCalendar={connectGoogle}
          onSignOut={signOut}
          onSection={scrollToSection}
        />

        <div className="min-w-0 bg-card">
          <div className="mx-auto max-w-[900px] px-5 min-[821px]:px-14">
            {tasksQ.isPending && <LoadingState label="Loading your tasks…" />}
            {tasksQ.isError && (
              <ErrorState
                message="Couldn't load your tasks. Try again."
                onRetry={() => tasksQ.refetch()}
              />
            )}
            <HeroSummary
              dateLabel={dateLabel}
              greeting={greetingName ? `Good ${partOfDay}, ${greetingName}` : "Good to see you"}
              followUpCount={followUpCount}
              upNext={upNext}
              overdue={groups.overdue.length}
              dueToday={groups.today.length}
              doneToday={doneToday}
            />
          </div>

          <QuickCapture
            ref={quickCaptureRef}
            filter={filter}
            onFilterChange={setFilter}
            headerAction={moreMenu}
            onHeightChange={setCaptureHeight}
          />

          <main className="mx-auto max-w-[900px] px-5 pb-28 min-[821px]:px-14 min-[821px]:pb-16">
            {tasks.length === 0 && <OnboardingCard />}

            <div className="space-y-10">
              <Panel
                id="sec-overdue"
                title="Overdue"
                subtitle="These slipped past their date"
                count={groups.overdue.length}
                group="overdue"
                stickyTop={captureHeight}
                open={open.overdue}
                onToggle={() => toggle("overdue")}
              >
                {groups.overdue.length === 0 ? (
                  <EmptyLine>Nothing overdue — you're all caught up.</EmptyLine>
                ) : (
                  <div className="space-y-1.5">
                    {byPriority(groups.overdue).map((t) => (
                      <TaskRow key={t.id} task={t} contacts={contacts} overdue />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                id="sec-today"
                title="Due Today"
                subtitle="Let's get these done first"
                count={groups.today.length}
                group="today"
                stickyTop={captureHeight}
                open={open.today}
                onToggle={() => toggle("today")}
              >
                {groups.today.length === 0 ? (
                  <EmptyLine>Today is clear.</EmptyLine>
                ) : (
                  <div className="space-y-1.5">
                    {byPriority(groups.today).map((t) => (
                      <TaskRow key={t.id} task={t} contacts={contacts} />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                id="sec-waiting"
                title="Waiting on Someone"
                subtitle="Nothing to do here yet. Just keeping tabs."
                count={waitingCount}
                group="waiting"
                open={open.waiting}
                onToggle={() => toggle("waiting")}
                stickyTop={captureHeight}
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
                          <div className="pb-2 pt-5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            {contact ? <><strong className="font-semibold text-foreground">{contact.name}</strong>{contact.role ? ` · ${contact.role}` : ""}</> : <strong className="font-semibold text-foreground">{label}</strong>}
                          </div>
                          <div className="space-y-1.5">
                            {byPriority(g.tasks).map((t) => (
                              <TaskRow key={t.id} task={t} contacts={contacts} showWaitingBadge />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel
                id="sec-coming"
                title="Coming Up"
                subtitle="Nothing urgent. Just so you're not surprised."
                count={upcomingCount}
                group="upcoming"
                open={open.upcoming}
                onToggle={() => toggle("upcoming")}
                stickyTop={captureHeight}
              >
                {upcomingCount === 0 ? (
                  <EmptyLine>Nothing on the horizon.</EmptyLine>
                ) : (
                  <div className="space-y-2.5">
                    {groups.upcoming.map((g) => (
                      <div key={g.date}>
                          <div className="pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">{formatDateLabel(g.date)}</div>
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
                id="sec-whenever"
                title="Whenever You Get To It"
                subtitle="No date on these. Dip in when you have a moment."
                count={groups.someday.length}
                group="whenever"
                open={open.someday}
                onToggle={() => toggle("someday")}
                stickyTop={captureHeight}
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
                            <span className="micro-label">{g.category}</span>
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

        <MobileTabBar
          overdue={groups.overdue.length}
          dueToday={groups.today.length}
          waiting={waitingCount}
          coming={upcomingCount}
          whenever={groups.someday.length}
          current={currentSection}
          onSection={scrollToSection}
        />
        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogContent className="max-w-sm rounded-none border-border-strong bg-card shadow-none sm:rounded-none">
            <DialogHeader>
              <DialogTitle>Keyboard shortcuts</DialogTitle>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
              <dt className="font-semibold text-foreground">/</dt>
              <dd className="text-muted-foreground">Add a task</dd>
              <dt className="font-semibold text-foreground">J / K</dt>
              <dd className="text-muted-foreground">Next / previous task</dd>
              <dt className="font-semibold text-foreground">X</dt>
              <dd className="text-muted-foreground">Complete the focused task</dd>
              <dt className="font-semibold text-foreground">?</dt>
              <dd className="text-muted-foreground">Show this list</dd>
            </dl>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

type DashboardNavigationProps = {
  overdue: number;
  dueToday: number;
  waiting: number;
  coming: number;
  whenever: number;
  current: PanelKey;
  onSection: (id: string) => void;
};

function DashboardSidebar({
  overdue,
  dueToday,
  waiting,
  coming,
  whenever,
  current,
  displayName,
  initial,
  showCalendarConnect,
  onConnectCalendar,
  onSignOut,
  onSection,
}: DashboardNavigationProps & {
  displayName: string;
  initial: string;
  showCalendarConnect: boolean;
  onConnectCalendar: () => void;
  onSignOut: () => void;
}) {
  const sectionLinks: Array<{
    label: string;
    count: number;
    id: string;
    active: boolean;
    alert?: boolean;
  }> = [
    {
      label: "Today",
      count: overdue + dueToday,
      id: "sec-overdue",
      active: current === "overdue" || current === "today",
      alert: overdue > 0,
    },
    {
      label: "Waiting on someone",
      count: waiting,
      id: "sec-waiting",
      active: current === "waiting",
    },
    { label: "Coming up", count: coming, id: "sec-coming", active: current === "upcoming" },
    { label: "Whenever", count: whenever, id: "sec-whenever", active: current === "someday" },
  ];
  const routeLinks = [
    { label: "People", to: "/contacts" as const },
    { label: "Completed", to: "/completed" as const },
    { label: "Calendar", to: "/calendar" as const },
    { label: "Applicants", to: "/applicants" as const },
    { label: "Settings", to: "/settings" as const },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-5 py-6 min-[821px]:flex">
      <div className="font-wordmark px-2 text-foreground">Relay</div>
      <nav className="mt-10" aria-label="Task sections">
        {sectionLinks.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSection(item.id)}
            aria-current={item.active ? "location" : undefined}
            className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center border-l-2 px-3 text-left text-[13px] ${
              item.active
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="truncate">{item.label}</span>
            <span className={item.alert ? "text-alert" : "text-muted-foreground"}>
              {item.count}
            </span>
          </button>
        ))}
      </nav>
      <nav className="mt-5 border-t border-border pt-5" aria-label="Dashboard navigation">
        {routeLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex min-h-11 items-center border-l-2 border-transparent px-3 text-[13px] text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-border pt-5">
        <div className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3">
          <span className="grid h-8 w-8 place-items-center bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
        </div>
        {showCalendarConnect && (
          <Button
            variant="outline"
            className="mt-4 h-10 w-full justify-start rounded-none text-xs shadow-none"
            onClick={onConnectCalendar}
          >
            <CalIcon className="h-4 w-4" strokeWidth={2} />
            Connect Calendar
          </Button>
        )}
        <Button
          variant="ghost"
          className="mt-1 h-10 w-full justify-start rounded-none px-2 text-xs"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

function MobileTabBar({
  overdue,
  dueToday,
  waiting,
  coming,
  whenever,
  current,
  onSection,
}: DashboardNavigationProps) {
  const tabs = [
    {
      label: "Today",
      count: overdue + dueToday,
      id: "sec-overdue",
      active: current === "overdue" || current === "today",
      alert: overdue > 0,
    },
    { label: "Waiting", count: waiting, id: "sec-waiting", active: current === "waiting" },
    { label: "Coming", count: coming, id: "sec-coming", active: current === "upcoming" },
    { label: "Someday", count: whenever, id: "sec-whenever", active: current === "someday" },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid min-h-[60px] grid-cols-4 border-t border-foreground bg-background pb-[env(safe-area-inset-bottom)] min-[821px]:hidden"
      aria-label="Task sections"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSection(tab.id)}
          aria-current={tab.active ? "location" : undefined}
          className="relative flex min-w-0 flex-col items-center justify-center px-1 py-2 text-foreground"
        >
          {tab.active && (
            <span
              aria-hidden
              className="absolute left-[20%] right-[20%] top-0 h-0.5 bg-foreground"
            />
          )}
          <span
            className={`text-[15px] font-semibold tabular-nums ${tab.alert ? "text-alert" : ""}`}
          >
            {tab.count}
          </span>
          <span className="truncate text-[11px] uppercase tracking-[0.08em]">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Panel({
  id,
  title,
  subtitle,
  count,
  children,
  group,
  stickyTop,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  group: GroupKey;
  stickyTop: number;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section id={id} className="relative min-w-0" style={{ scrollMarginTop: stickyTop + 12 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sticky z-20 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2 bg-background py-3 text-left"
        style={{
          top: stickyTop,
          borderTop:
            group === "overdue"
              ? "2px solid var(--alert)"
              : group === "waiting" || group === "upcoming"
                ? "1px solid var(--border-strong)"
                : group === "whenever"
                  ? "1px solid var(--border)"
                  : GROUP_RULE[group],
        }}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground" strokeWidth={2} />
        )}
        <span className="flex min-w-0 items-baseline gap-3">
          <h2 className="shrink-0 font-display text-foreground">{title}</h2>
          <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground sm:block">
            {subtitle}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      </button>
      {open && <div className="pt-3">{children}</div>}
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
      tasks: tasks.sort((a, b) => (a.due_time ?? "zz").localeCompare(b.due_time ?? "zz")),
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
