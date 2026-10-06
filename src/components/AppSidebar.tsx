import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Calendar as CalIcon, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taskFns } from "@/lib/api-client";
import { getProfile } from "@/lib/profile.functions";
import { todayISO } from "@/lib/date-utils";
import type { Task } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type SectionKey = "overdue" | "today" | "waiting" | "upcoming" | "someday";
export type AppRoute = "/calendar" | "/executive-info" | "/settings" | "/dashboard";
export type SidebarCounts = {
  overdue: number;
  dueToday: number;
  waiting: number;
  coming: number;
  whenever: number;
};

const ROUTE_LINKS = [
  { label: "People", to: "/contacts" as const },
  { label: "Completed", to: "/completed" as const },
  { label: "Calendar", to: "/calendar" as const },
  { label: "Executive personal", to: "/executive-info" as const, isNew: true },
  { label: "Applicants", to: "/applicants" as const },
  { label: "Settings", to: "/settings" as const },
];

function NewTag() {
  return (
    <span className="ml-2 border border-foreground px-2 py-[3px] text-[11px] uppercase leading-none tracking-[0.1em] text-foreground">
      New
    </span>
  );
}

export function AppSidebar({
  counts,
  current,
  onSection,
  currentRoute,
  displayName,
  initial,
  showCalendarConnect = false,
  onConnectCalendar,
  onSignOut,
}: {
  counts: SidebarCounts;
  current?: SectionKey;
  onSection?: (id: string) => void;
  currentRoute?: AppRoute;
  displayName: string;
  initial: string;
  showCalendarConnect?: boolean;
  onConnectCalendar?: () => void;
  onSignOut: () => void;
}) {
  const { overdue, dueToday, waiting, coming, whenever } = counts;
  const sectionLinks = [
    {
      label: "Today",
      count: overdue + dueToday,
      id: "sec-overdue",
      active: current === "overdue" || current === "today",
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
  const rowClass = (active: boolean) =>
    `grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center border-l-2 px-3 py-2.5 text-left text-[14px] ${
      active
        ? "border-foreground font-semibold text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface px-5 min-[821px]:flex">
      <div className="px-3 py-7 text-[13px] font-semibold uppercase tracking-[0.32em] text-foreground">
        Relay
      </div>
      <nav aria-label="Task sections">
        {sectionLinks.map((item) => {
          const inner = (
            <>
              <span className="truncate">{item.label}</span>
              <span className="flex items-center text-[12px] tabular-nums text-muted-foreground">
                {item.label === "Today" && overdue > 0 && (
                  <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-alert">
                    {overdue} late
                  </span>
                )}
                {item.count}
              </span>
            </>
          );
          return onSection ? (
            <button
              key={item.id}
              type="button"
              onClick={() => onSection(item.id)}
              aria-current={item.active ? "location" : undefined}
              className={rowClass(item.active)}
            >
              {inner}
            </button>
          ) : (
            <Link key={item.id} to="/dashboard" className={rowClass(false)}>
              {inner}
            </Link>
          );
        })}
      </nav>
      <nav
        className="relative mt-3 pt-3 before:absolute before:inset-x-3 before:top-0 before:border-t before:border-border"
        aria-label="Main navigation"
      >
        {ROUTE_LINKS.map((item) => {
          const active = currentRoute === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center border-l-2 px-3 py-2.5 text-[14px] ${
                active
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="min-w-0">{item.label}</span>
              {item.isNew && <NewTag />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border pb-5 pt-5">
        <div className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-3">
          <span className="grid h-[30px] w-[30px] place-items-center bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-foreground">
              {displayName}
            </span>
            <span className="block truncate text-[12px] text-muted-foreground">
              Personal assistant
            </span>
          </span>
        </div>
        {showCalendarConnect && onConnectCalendar && (
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

export function AppMoreMenu({
  onSignOut,
  extra,
}: {
  onSignOut: () => void;
  extra?: React.ReactNode;
}) {
  return (
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
          {ROUTE_LINKS.map((item) => (
            <SheetClose asChild key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-12 items-center border-b border-border text-sm font-medium text-foreground"
              >
                <span className="min-w-0">{item.label}</span>
                {item.isNew && <NewTag />}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-6 space-y-2">
          {extra}
          <Button
            variant="ghost"
            className="h-11 w-full justify-start rounded-none"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Phone bottom bar for Calendar, Executive personal and Settings. */
export function AppMobileTabs({ current }: { current: AppRoute }) {
  const tabs = [
    { label: "Info", to: "/executive-info" as const },
    { label: "Calendar", to: "/calendar" as const },
    { label: "Today", to: "/dashboard" as const },
    { label: "Settings", to: "/settings" as const },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid min-h-[60px] grid-cols-4 border-t border-foreground bg-background pb-[env(safe-area-inset-bottom)] min-[821px]:hidden"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const active = current === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className="relative flex min-w-0 items-center justify-center px-1 py-2 text-foreground"
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-[20%] right-[20%] top-0 h-0.5 bg-foreground"
              />
            )}
            <span
              className={`truncate text-[11px] uppercase tracking-[0.08em] ${active ? "font-semibold" : ""}`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Shared data for non-dashboard pages that show the sidebar. */
export function useAppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => taskFns.list() });
  const getProf = useServerFn(getProfile);
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => getProf() });
  const today = todayISO();
  const counts = useMemo<SidebarCounts>(() => {
    const c = { overdue: 0, dueToday: 0, waiting: 0, coming: 0, whenever: 0 };
    for (const task of (tasksQ.data ?? []) as Task[]) {
      if (task.status === "Complete") continue;
      if (task.status === "Waiting on Someone") c.waiting += 1;
      if (!task.due_date) {
        if (task.status !== "Waiting on Someone") c.whenever += 1;
      } else if (task.due_date < today) c.overdue += 1;
      else if (task.due_date === today) c.dueToday += 1;
      else c.coming += 1;
    }
    return c;
  }, [tasksQ.data, today]);
  const displayName = profile?.display_name?.trim() || "Relay user";
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return { counts, displayName, initial: displayName.charAt(0).toUpperCase(), signOut };
}
