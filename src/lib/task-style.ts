import {
  Plane,
  Home,
  CalendarDays,
  ShoppingBag,
  Gift,
  Wallet,
  Wrench,
  Tag,
  type LucideIcon,
} from "lucide-react";

export type TaskCategory =
  | "Travel"
  | "Household"
  | "Scheduling"
  | "Errands"
  | "Gifts/Events"
  | "Finance"
  | "Vendors"
  | "Other";

/** One neutral shade per category, used everywhere: accent bar + pill + dots. */
export const CATEGORY_PILL: Record<TaskCategory, string> = {
  Travel: "pill-cat-travel",
  Household: "pill-cat-household",
  Scheduling: "pill-cat-scheduling",
  Errands: "pill-cat-errands",
  "Gifts/Events": "pill-cat-gifts",
  Finance: "pill-cat-finance",
  Vendors: "pill-cat-vendors",
  Other: "pill-cat-other",
};

/** CSS colour value for the card's left accent bar / dots. */
export const CATEGORY_COLOR: Record<TaskCategory, string> = {
  Travel: "var(--cat-slate)",
  Household: "var(--cat-taupe)",
  Scheduling: "var(--cat-moss)",
  Errands: "var(--cat-sand)",
  "Gifts/Events": "var(--cat-mauve)",
  Finance: "var(--cat-ink)",
  Vendors: "var(--cat-clay)",
  Other: "var(--cat-ash)",
};

export const CATEGORY_TINT: Record<TaskCategory, string> = {
  Travel: "var(--cat-slate-tint)",
  Household: "var(--cat-taupe-tint)",
  Scheduling: "var(--cat-moss-tint)",
  Errands: "var(--cat-sand-tint)",
  "Gifts/Events": "var(--cat-mauve-tint)",
  Finance: "var(--cat-ink-tint)",
  Vendors: "var(--cat-clay-tint)",
  Other: "var(--cat-ash-tint)",
};

export const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  Travel: Plane,
  Household: Home,
  Scheduling: CalendarDays,
  Errands: ShoppingBag,
  "Gifts/Events": Gift,
  Finance: Wallet,
  Vendors: Wrench,
  Other: Tag,
};

/**
 * The five dashboard status groups are the one place we allow hue.
 * Everything else stays on the neutral stone palette.
 */
export type GroupKey =
  | "overdue"
  | "today"
  | "waiting"
  | "upcoming"
  | "whenever";

export const GROUP_COLOR: Record<GroupKey, string> = {
  overdue: "var(--grp-overdue)",
  today: "var(--grp-today)",
  waiting: "var(--grp-waiting)",
  upcoming: "var(--grp-upcoming)",
  whenever: "var(--grp-whenever)",
};

export const GROUP_TINT: Record<GroupKey, string> = {
  overdue: "var(--grp-overdue-tint)",
  today: "var(--grp-today-tint)",
  waiting: "var(--grp-waiting-tint)",
  upcoming: "var(--grp-upcoming-tint)",
  whenever: "var(--grp-whenever-tint)",
};

export const CATEGORY_ORDER: TaskCategory[] = [

  "Finance",
  "Travel",
  "Scheduling",
  "Household",
  "Errands",
  "Gifts/Events",
  "Vendors",
  "Other",
];

/** Plain-language labels for the three task sources. */
export function sourceLabel(
  source: "From Boss" | "Delegated by Me" | "Personal Reminder",
  bossName?: string | null,
) {
  if (source === "From Boss")
    return bossName ? `From ${bossName}` : "From your boss";
  if (source === "Delegated by Me") return "I've handed off";
  return "Just for me";
}

/** Short explanation of each source, shown in tooltips. */
export const SOURCE_HELP: Record<
  "From Boss" | "Delegated by Me" | "Personal Reminder",
  string
> = {
  "From Boss": "Your principal asked you to handle this.",
  "Delegated by Me": "You handed this to someone else and are tracking it.",
  "Personal Reminder": "Something you're doing yourself, for yourself.",
};

export type TaskStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting on Someone"
  | "Complete";

export const STATUS_ORDER: TaskStatus[] = [
  "Not Started",
  "In Progress",
  "Waiting on Someone",
  "Complete",
];

export const STATUS_HELP: Record<TaskStatus, string> = {
  "Not Started": "Nothing has happened on this yet.",
  "In Progress": "You've started and it's actively moving.",
  "Waiting on Someone":
    "You've done your part — you're waiting on another person to respond or act.",
  Complete: "Finished. It leaves your active list.",
};

/** Neutral badge styling per status. */
export const STATUS_BADGE: Record<TaskStatus, string> = {
  "Not Started": "bg-[var(--cat-ash-tint)] text-[var(--cat-ash)]",
  "In Progress": "bg-[var(--cat-slate-tint)] text-[var(--cat-slate)]",
  "Waiting on Someone": "bg-[var(--cat-sand-tint)] text-[var(--cat-sand)]",
  Complete: "bg-[var(--cat-moss-tint)] text-[var(--cat-moss)]",
};

/** "Just asked, waiting" / "Waiting 3 days" — never abbreviated. */
export function waitingLabel(days: number) {
  if (days <= 0) return "Just asked, waiting";
  if (days === 1) return "Waiting 1 day";
  return `Waiting ${days} days`;
}

export const PETAL_COLORS = [
  "#6d6157",
  "#5d666e",
  "#57614f",
  "#6e6046",
  "#665a63",
  "#8a857b",
];

/** Urgent first, then Important, then everything else — stable otherwise. */
export function byPriority<T extends { priority: "Normal" | "Important" | "Urgent" }>(
  tasks: T[],
): T[] {
  const rank = { Urgent: 0, Important: 1, Normal: 2 } as const;
  return [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority]);
}
