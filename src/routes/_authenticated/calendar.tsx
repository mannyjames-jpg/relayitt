import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { contactFns, taskFns } from "@/lib/api-client";
import { formatTime, todayISO } from "@/lib/date-utils";
import { TaskRow, type Task } from "@/components/TaskRow";
import { ErrorState, LoadingState } from "@/components/QueryState";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useServerFn } from "@tanstack/react-start";
import { listKeyDates, type KeyDate } from "@/lib/exec-info.functions";
import { AppMobileTabs, AppMoreMenu, AppSidebar, useAppShell } from "@/components/AppSidebar";

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
  const now = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => taskFns.list() });
  const contactsQ = useQuery({ queryKey: ["contacts"], queryFn: () => contactFns.list() });
  const getKeyDates = useServerFn(listKeyDates);
  const keyDatesQ = useQuery({ queryKey: ["key-dates"], queryFn: () => getKeyDates() });
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
  const keyByDate = useMemo(() => {
    const map = new Map<string, KeyDate[]>();
    const list = keyDatesQ.data ?? [];
    if (!list.length) return map;
    for (const day of monthDays) {
      const m = day.date.getMonth() + 1;
      const d = day.date.getDate();
      const y = day.date.getFullYear();
      const hits = list.filter(
        (k) => k.month === m && k.day === d && (k.kind === "date" || k.year === y),
      );
      if (hits.length) map.set(day.iso, hits);
    }
    return map;
  }, [keyDatesQ.data, monthDays]);
  const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthDates = useMemo(
    () =>
      [...new Set([...tasksByDate.keys(), ...keyByDate.keys()])]
        .filter((date) => date.startsWith(monthPrefix))
        .sort(),
    [tasksByDate, keyByDate, monthPrefix],
  );
  const monthTaskCount = monthDates.reduce(
    (total, date) =>
      total + (tasksByDate.get(date)?.length ?? 0) + (keyByDate.get(date)?.length ?? 0),
    0,
  );
  const selectedTasks = selectedDate ? (tasksByDate.get(selectedDate) ?? []) : [];
  const selectedKeys = selectedDate ? (keyByDate.get(selectedDate) ?? []) : [];

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

  const shell = useAppShell();
  const moreMenu = <AppMoreMenu onSignOut={shell.signOut} />;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-relay-workspace
        className="min-h-screen bg-surface min-[821px]:grid min-[821px]:grid-cols-[232px_minmax(0,1fr)]"
      >
        <AppSidebar
          counts={shell.counts}
          currentRoute="/calendar"
          displayName={shell.displayName}
          initial={shell.initial}
          onSignOut={shell.signOut}
        />
        <main className="min-w-0 bg-card px-5 pb-28 pt-6 sm:px-8 sm:pb-12 min-[821px]:px-14">
          <div className="mx-auto max-w-[900px]">
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
                  {monthTaskCount} {monthTaskCount === 1 ? "item" : "items"} this month
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                  <span>■ Task</span>
                  <span>◆ Birthday or anniversary</span>
                  <span>
                    <span className="text-alert">⚑</span> Document expiry
                  </span>
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
                  keyByDate={keyByDate}
                  today={today}
                  onSelect={setSelectedDate}
                />
                <MobileAgenda
                  visibleMonth={visibleMonth}
                  days={monthDays.filter((day) => day.inMonth)}
                  monthDates={monthDates}
                  tasksByDate={tasksByDate}
                  keyByDate={keyByDate}
                  today={today}
                  onSelect={setSelectedDate}
                />
                <p className="mt-6 text-[12.5px] text-muted-foreground">
                  Birthdays and anniversaries come from Executive info &gt; Family &amp; dates.
                  Passport and visa expiries come from Travel &amp; documents. Edit them there and
                  the calendar updates.
                </p>
              </>
            )}
          </div>
        </main>
        <AppMobileTabs current="/calendar" />
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
            {selectedKeys.length > 0 && selectedDate && (
              <ul className="mb-4 border-t border-border">
                {selectedKeys.map((k) => (
                  <li key={`${k.kind}-${k.label}`} className="border-b border-border py-3">
                    <KeyLabel item={k} className="text-[15px]" />
                    <KeySubline item={k} iso={selectedDate} today={today} />
                  </li>
                ))}
              </ul>
            )}
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
            ) : selectedKeys.length ? null : (
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
  keyByDate,
  today,
  onSelect,
}: {
  days: MonthDay[];
  tasksByDate: Map<string, Task[]>;
  keyByDate: Map<string, KeyDate[]>;
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
          const dayKeys = keyByDate.get(day.iso) ?? [];
          const keyShown = dayKeys.slice(0, 3);
          const taskSlots = Math.max(0, 3 - keyShown.length);
          const hidden =
            dayKeys.length - keyShown.length + Math.max(0, dayTasks.length - taskSlots);
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
                {keyShown.map((k) => (
                  <KeyLabel
                    key={`${k.kind}-${k.label}`}
                    item={k}
                    className="text-[11px] leading-4"
                  />
                ))}
                {dayTasks.slice(0, taskSlots).map((task) => (
                  <span
                    key={task.id}
                    className={`block truncate text-[11px] leading-4 ${task.priority === "Urgent" ? "font-bold" : "font-normal"} ${day.iso < today ? "text-alert" : "text-foreground"}`}
                  >
                    {task.due_time ? `${formatTime(task.due_time)} ` : ""}
                    {task.title}
                  </span>
                ))}
                {hidden > 0 && (
                  <span className="block text-[11px] text-muted-foreground">+{hidden} more</span>
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
  keyByDate,
  today,
  onSelect,
}: {
  visibleMonth: Date;
  days: MonthDay[];
  monthDates: string[];
  tasksByDate: Map<string, Task[]>;
  keyByDate: Map<string, KeyDate[]>;
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
            const hasTasks = tasksByDate.has(day.iso) || keyByDate.has(day.iso);
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
                {(keyByDate.get(date) ?? []).map((k) => (
                  <button
                    key={`${k.kind}-${k.label}`}
                    type="button"
                    onClick={() => onSelect(date)}
                    className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-2 text-left"
                  >
                    <span
                      className={`w-[68px] text-[11px] ${k.kind === "doc" ? "font-semibold text-alert" : "text-muted-foreground"}`}
                    >
                      {k.kind === "doc" ? "Expiry" : "Date"}
                    </span>
                    <KeyLabel item={k} className="text-sm" />
                  </button>
                ))}
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

function KeyLabel({ item, className }: { item: KeyDate; className?: string }) {
  const doc = item.kind === "doc";
  return (
    <span
      className={`block min-w-0 truncate ${doc ? "font-semibold text-alert" : "font-normal text-foreground"} ${className ?? ""}`}
    >
      <span aria-hidden className="mr-1 text-[9px] align-middle">
        {doc ? "⚑" : "◆"}
      </span>
      {item.label}
    </span>
  );
}

function KeySubline({ item, iso, today }: { item: KeyDate; iso: string; today: string }) {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let text: string | null = null;
  if (item.kind === "doc") {
    const days = Math.round(
      (new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000,
    );
    text =
      days >= 0
        ? `In ${days} ${days === 1 ? "day" : "days"}`
        : `Expired ${-days} ${-days === 1 ? "day" : "days"} ago`;
  } else {
    const parts: string[] = [];
    if (item.relationship) parts.push(item.relationship);
    if (item.year && item.year < y) {
      const n = y - item.year;
      parts.push(`${n} ${n === 1 ? "year" : "years"}`);
    }
    text = parts.join(" · ") || null;
  }
  return text ? (
    <span className="mt-0.5 block text-[13px] text-muted-foreground">{text}</span>
  ) : null;
}
