import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, LogOut, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { contactFns, taskFns } from "@/lib/api-client";
import { getProfile } from "@/lib/profile.functions";
import { formatTime, todayISO } from "@/lib/date-utils";
import { TaskRow, type Task } from "@/components/TaskRow";
import { ErrorState, LoadingState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Relay" },
      {
        name: "description",
        content: "See your Relay tasks arranged by due date in a monthly calendar.",
      },
      { property: "og:title", content: "Calendar — Relay" },
      {
        property: "og:description",
        content: "See your Relay tasks arranged by due date in a monthly calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type MonthDay = {
  date: Date;
  iso: string;
  inMonth: boolean;
};

function CalendarPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => taskFns.list() });
  const contactsQ = useQuery({ queryKey: ["contacts"], queryFn: () => contactFns.list() });
  const getProf = useServerFn(getProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProf() });
  const tasks = (tasksQ.data ?? []) as Task[];
  const contacts = contactsQ.data ?? [];
  const today = todayISO();

  const datedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "Complete" && task.due_date)
        .sort((a, b) => {
          const dateOrder = (a.due_date ?? "").localeCompare(b.due_date ?? "");
          return dateOrder || (a.due_time ?? "zz").localeCompare(b.due_time ?? "zz");
        }),
    [tasks],
  );
  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of datedTasks) {
      if (!task.due_date) continue;
      const group = grouped.get(task.due_date) ?? [];
      group.push(task);
      grouped.set(task.due_date, group);
    }
    return grouped;
  }, [datedTasks]);

  const monthDays = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthDates = useMemo(
    () => [...tasksByDate.keys()].filter((date) => date.startsWith(monthPrefix)).sort(),
    [tasksByDate, monthPrefix],
  );
  const monthTaskCount = monthDates.reduce(
    (total, date) => total + (tasksByDate.get(date)?.length ?? 0),
    0,
  );
  const selectedTasks = selectedDate ? (tasksByDate.get(selectedDate) ?? []) : [];

  const moveMonth = (amount: number) =>
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1));
  const jumpToday = () => setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const tag = target?.tagName;
      const editing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      const overlayOpen = Boolean(document.querySelector('[role="dialog"]'));
      if (editing || overlayOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        jumpToday();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveMonth(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveMonth(1);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const displayName = profile?.display_name?.trim() || "Relay user";
  const initial = displayName.charAt(0).toUpperCase();
  const dashboardCounts = useMemo(
    () =>
      getDashboardCounts(
        tasks.filter((task) => task.status !== "Complete"),
        today,
      ),
    [tasks, today],
  );
  const moreMenu = <CalendarMoreMenu onSignOut={signOut} />;

  return (
    <TooltipProvider delayDuration={200}>
      <div data-relay-workspace className="min-h-screen bg-surface min-[821px]:grid min-[821px]:grid-cols-[232px_minmax(0,1fr)]">
        <CalendarSidebar
          counts={dashboardCounts}
          displayName={displayName}
          initial={initial}
          onSignOut={signOut}
        />
        <main className="min-w-0 bg-card px-5 pb-28 pt-6 sm:px-8 sm:pb-12 min-[821px]:px-14">
          <div className="mx-auto max-w-[1120px]">
            <header className="mb-6 flex min-w-0 items-start justify-between gap-4 border-b border-border pb-5">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 min-[821px]:hidden">
                  <span className="font-wordmark text-sm text-foreground">Relay</span>
                  <span className="ml-auto">{moreMenu}</span>
                </div>
                <h1 className="truncate text-[30px] font-normal text-foreground sm:text-4xl">
                  {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {monthTaskCount} {monthTaskCount === 1 ? "task" : "tasks"} this month
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => moveMonth(-1)}
                  aria-label="Previous month"
                >
                  <ChevronLeft />
                </Button>
                <Button variant="outline" className="h-11 px-3" onClick={jumpToday}>
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => moveMonth(1)}
                  aria-label="Next month"
                >
                  <ChevronRight />
                </Button>
              </div>
            </header>

            {tasksQ.isPending || contactsQ.isPending ? (
              <LoadingState label="Loading your calendar…" />
            ) : tasksQ.isError || contactsQ.isError ? (
              <ErrorState
                message="Couldn't load your calendar. Try again."
                onRetry={() => {
                  void tasksQ.refetch();
                  void contactsQ.refetch();
                }}
              />
            ) : (
              <>
                <DesktopMonthGrid
                  days={monthDays}
                  tasksByDate={tasksByDate}
                  today={today}
                  onSelect={setSelectedDate}
                />
                <MobileAgenda
                  visibleMonth={visibleMonth}
                  days={monthDays.filter((day) => day.inMonth)}
                  monthDates={monthDates}
                  tasksByDate={tasksByDate}
                  today={today}
                  onSelect={setSelectedDate}
                />
              </>
            )}
          </div>
        </main>
        <CalendarMobileTabs counts={dashboardCounts} />
        <Sheet open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
          <SheetContent
            side="right"
            className="w-[min(92vw,560px)] overflow-y-auto rounded-none border-border-strong bg-background shadow-none [transition-duration:300ms] sm:max-w-none"
          >
            <SheetHeader className="mb-6 text-left">
              <SheetTitle className="pr-8 text-xl font-normal">
                {selectedDate ? fullDate(selectedDate) : "Tasks"}
              </SheetTitle>
            </SheetHeader>
            {selectedTasks.length ? (
              <div className="space-y-2">
                {selectedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    contacts={contacts}
                    overdue={(task.due_date ?? today) < today}
                  />
                ))}
              </div>
            ) : (
              <p className="border-t border-border py-6 text-sm text-muted-foreground">
                Nothing scheduled
              </p>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

function DesktopMonthGrid({
  days,
  tasksByDate,
  today,
  onSelect,
}: {
  days: MonthDay[];
  tasksByDate: Map<string, Task[]>;
  today: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="hidden sm:block">
      <div className="grid grid-cols-7 border-l border-t border-border" aria-hidden>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="border-b border-r border-border px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-border">
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.iso) ?? [];
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(day.iso)}
              className="min-h-[132px] min-w-0 border-b border-r border-border p-2 text-left align-top hover:bg-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`${fullDate(day.iso)}, ${dayTasks.length} ${dayTasks.length === 1 ? "task" : "tasks"}`}
            >
              <span
                className={`mb-2 grid h-6 w-6 place-items-center text-xs tabular-nums ${day.iso === today ? "bg-primary text-primary-foreground" : day.inMonth ? "text-foreground" : "text-muted-foreground/50"}`}
              >
                {day.date.getDate()}
              </span>
              <span className="block space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <span
                    key={task.id}
                    className={`block truncate text-[11px] leading-4 ${task.priority === "Urgent" ? "font-bold" : "font-normal"} ${day.iso < today ? "text-alert" : "text-foreground"}`}
                  >
                    {task.due_time ? `${formatTime(task.due_time)} ` : ""}
                    {task.title}
                  </span>
                ))}
                {dayTasks.length > 3 && (
                  <span className="block text-[11px] text-muted-foreground">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileAgenda({
  visibleMonth,
  days,
  monthDates,
  tasksByDate,
  today,
  onSelect,
}: {
  visibleMonth: Date;
  days: MonthDay[];
  monthDates: string[];
  tasksByDate: Map<string, Task[]>;
  today: string;
  onSelect: (date: string) => void;
}) {
  const scrollToDay = (date: string) =>
    document
      .getElementById(`agenda-${date}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="sm:hidden">
      <div className="mb-8 border-l border-t border-border">
        <div className="grid grid-cols-7">
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="grid h-8 place-items-center border-b border-r border-border text-[10px] font-semibold text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {Array.from({
            length: new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay(),
          }).map((_, index) => (
            <span key={`blank-${index}`} className="h-11 border-b border-r border-border" />
          ))}
          {days.map((day) => {
            const hasTasks = tasksByDate.has(day.iso);
            return (
              <button
                key={day.iso}
                type="button"
                className="relative grid h-11 place-items-center border-b border-r border-border text-xs text-foreground"
                onClick={() => hasTasks && scrollToDay(day.iso)}
                aria-label={`${fullDate(day.iso)}${hasTasks ? ", has tasks" : ""}`}
              >
                <span
                  className={
                    day.iso === today
                      ? "grid h-6 w-6 place-items-center bg-primary text-primary-foreground"
                      : ""
                  }
                >
                  {day.date.getDate()}
                </span>
                {hasTasks && (
                  <span className="absolute bottom-1 h-1 w-1 bg-foreground" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {monthDates.length === 0 ? (
        <p className="border-t border-border py-8 text-sm text-muted-foreground">
          Nothing scheduled this month.
        </p>
      ) : (
        <div className="space-y-7">
          {monthDates.map((date) => (
            <section key={date} id={`agenda-${date}`} className="scroll-mt-0">
              <button
                type="button"
                onClick={() => onSelect(date)}
                className="sticky top-0 z-10 w-full border-t border-border bg-background py-3 text-left text-sm font-semibold text-foreground"
              >
                {shortDate(date)}
              </button>
              <div className="divide-y divide-border border-b border-border">
                {(tasksByDate.get(date) ?? []).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelect(date)}
                    className={`grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-2 text-left ${date < today ? "text-alert" : "text-foreground"}`}
                  >
                    <span className="w-[68px] text-[11px] tabular-nums text-muted-foreground">
                      {task.due_time ? formatTime(task.due_time) : "Any time"}
                    </span>
                    <span
                      className={`truncate text-sm ${task.priority === "Urgent" ? "font-bold" : "font-normal"}`}
                    >
                      {task.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type Counts = { today: number; overdue: number; waiting: number; coming: number; someday: number };

function CalendarSidebar({
  counts,
  displayName,
  initial,
  onSignOut,
}: {
  counts: Counts;
  displayName: string;
  initial: string;
  onSignOut: () => void;
}) {
  const taskLinks = [
    { label: "Today", count: counts.today, alert: counts.overdue > 0 },
    { label: "Waiting on someone", count: counts.waiting },
    { label: "Coming up", count: counts.coming },
    { label: "Whenever", count: counts.someday },
  ];
  const routeLinks = [
    { label: "People", to: "/contacts" as const },
    { label: "Completed", to: "/completed" as const },
    { label: "Calendar", to: "/calendar" as const },
    { label: "Applicants", to: "/applicants" as const },
    { label: "Settings", to: "/settings" as const },
  ];
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-5 min-[821px]:flex">
      <Link to="/dashboard" className="px-3 py-7 text-[13px] font-semibold uppercase tracking-[0.32em] text-foreground">
        Relay
      </Link>
      <nav aria-label="Task sections">
        {taskLinks.map((item) => (
          <Link
            key={item.label}
            to="/dashboard"
            className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center border-l-2 border-transparent px-3 py-2.5 text-[14px] text-muted-foreground hover:text-foreground"
          >
            <span className="truncate">{item.label}</span>
            <span className={item.alert ? "text-alert" : "text-muted-foreground"}>
              {item.count}
            </span>
          </Link>
        ))}
      </nav>
      <nav className="mx-3 mt-3 border-t border-border pt-3" aria-label="Main navigation">
        {routeLinks.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={item.to === "/calendar" ? "page" : undefined}
            className={`flex min-h-11 items-center border-l-2 px-3 py-2.5 text-[14px] ${item.to === "/calendar" ? "border-foreground font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-border pb-5 pt-5">
        <div className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3">
          <span className="grid h-[30px] w-[30px] place-items-center bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="min-w-0"><span className="block truncate text-[14px] font-medium text-foreground">{displayName}</span><span className="block text-[12px] text-muted-foreground">Personal assistant</span></span>
        </div>
        <Button
          variant="ghost"
          className="mt-1 h-10 w-full justify-start rounded-none px-2 text-xs"
          onClick={onSignOut}
        >
          <LogOut />
          Sign out
        </Button>
      </div>
    </aside>
  );
}

function CalendarMoreMenu({ onSignOut }: { onSignOut: () => void }) {
  const links = [
    ["People", "/contacts"],
    ["Completed", "/completed"],
    ["Calendar", "/calendar"],
    ["Applicants", "/applicants"],
    ["Settings", "/settings"],
  ] as const;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More">
          <Menu />
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
          {links.map(([label, to]) => (
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
        <Button variant="ghost" className="mt-6 h-11 w-full justify-start" onClick={onSignOut}>
          <LogOut />
          Sign out
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function CalendarMobileTabs({ counts }: { counts: Counts }) {
  const tabs = [
    { label: "Today", count: counts.today, alert: counts.overdue > 0 },
    { label: "Waiting", count: counts.waiting },
    { label: "Coming", count: counts.coming },
    { label: "Someday", count: counts.someday },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid min-h-[60px] grid-cols-4 border-t border-foreground bg-background pb-[env(safe-area-inset-bottom)] min-[821px]:hidden"
      aria-label="Task sections"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          to="/dashboard"
          className="relative flex min-w-0 flex-col items-center justify-center px-1 py-2 text-foreground"
        >
          <span
            className={`text-[15px] font-semibold tabular-nums ${tab.alert ? "text-alert" : ""}`}
          >
            {tab.count}
          </span>
          <span className="truncate text-[11px] uppercase tracking-[0.08em]">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function buildMonthDays(month: Date): MonthDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date, iso: localISO(date), inMonth: date.getMonth() === month.getMonth() };
  });
}

function localISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fullDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function shortDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDashboardCounts(tasks: Task[], today: string): Counts {
  let overdue = 0,
    dueToday = 0,
    waiting = 0,
    coming = 0,
    someday = 0;
  for (const task of tasks) {
    if (task.status === "Waiting on Someone") waiting += 1;
    if (!task.due_date) {
      if (task.status !== "Waiting on Someone") someday += 1;
    } else if (task.due_date < today) overdue += 1;
    else if (task.due_date === today) dueToday += 1;
    else coming += 1;
  }
  return { today: overdue + dueToday, overdue, waiting, coming, someday };
}
