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

/**
 * No colour anywhere. Category is routine information, so it always uses the
 * "quiet" tag style — light hairline border, muted text.
 */
export const CATEGORY_PILL: Record<TaskCategory, string> = {
  Travel: "tag-quiet",
  Household: "tag-quiet",
  Scheduling: "tag-quiet",
  Errands: "tag-quiet",
  "Gifts/Events": "tag-quiet",
  Finance: "tag-quiet",
  Vendors: "tag-quiet",
  Other: "tag-quiet",
};

/** Icons/marks sit on the neutral ink ramp — never a hue. */
export const CATEGORY_COLOR: Record<TaskCategory, string> = {
  Travel: "var(--muted-foreground)",
  Household: "var(--muted-foreground)",
  Scheduling: "var(--muted-foreground)",
  Errands: "var(--muted-foreground)",
  "Gifts/Events": "var(--muted-foreground)",
  Finance: "var(--muted-foreground)",
  Vendors: "var(--muted-foreground)",
  Other: "var(--muted-foreground)",
};

export const CATEGORY_TINT: Record<TaskCategory, string> = {
  Travel: "var(--surface)",
  Household: "var(--surface)",
  Scheduling: "var(--surface)",
  Errands: "var(--surface)",
  "Gifts/Events": "var(--surface)",
  Finance: "var(--surface)",
  Vendors: "var(--surface)",
  Other: "var(--surface)",
};

export const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  Travel: Plane,
  Household: Home,
  Scheduling: CalendarDays,
  Errands: ShoppingBag,
  Gifts/Events: Gift,
  Finance: Wallet,
  Vendors: Wrench,
  Other: Tag,
};

/**
 * The five dashboard groups are distinguished WITHOUT colour: the rule under
 * each panel header gets heavier and darker as urgency rises.
 */
export type GroupKey =
  | "overdue"
  | "today"
  | "waiting"
  | "upcoming"
  | "whenever";

/** Border shorthand for the rule beneath a panel header. */
export const GROUP_RULE: Record<GroupKey, string> = {
  overdue: "2px solid var(--ink-900)",
  today: "1.5px solid var(--ink-700)",
  waiting: "1.25px solid var(--ink-400)",
  upcoming: "1px solid var(--border-strong)",
  whenever: "1px solid var(--border)",
};

/** Neutral ink shade for the small stat dot beside each group in the hero. */
export const GROUP_DOT: Record<GroupKey, string> = {
  overdue: "var(--ink-900)",
  today: "var(--ink-700)",
  waiting: "var(--ink-500)",
  upcoming: "var(--ink-400)",
  whenever: "var(--ink-300)",
};

/** Kept for compatibility — everything reads as ink now. */
export const GROUP_COLOR: Record<GroupKey, string> = GROUP_DOT;

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

/** Status is routine information — always the quiet tag style. */
export const STATUS_BADGE: Record<TaskStatus, string> = {
  "Not Started": "tag-quiet",
  "In Progress": "tag-quiet",
  "Waiting on Someone": "tag-quiet",
  Complete: "tag-quiet",
};

/** "Just asked, waiting" / "Waiting 3 days" — never abbreviated. */
export function waitingLabel(days: number) {
  if (days <= 0) return "Just asked, waiting";
  if (days === 1) return "Waiting 1 day";
  return `Waiting ${days} days`;
}

export const PETAL_COLORS = [
  "#1c1a17",
  "#3d3934",
  "#6f6a62",
  "#8d877d",
  "#ab9a83",
  "#b3aca1",
];

/** Urgent first, then Important, then everything else — stable otherwise. */
export function byPriority<T extends { priority: "Normal" | "Important" | "Urgent" }>(
  tasks: T[],
): T[] {
  const rank = { Urgent: 0, Important: 1, Normal: 2 } as const;
  return [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority]);
}
