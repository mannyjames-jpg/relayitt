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

/** One hue per category, used everywhere: left accent bar + pill + dots. */
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
  Travel: "var(--lavender)",
  Household: "var(--coral)",
  Scheduling: "var(--sage)",
  Errands: "var(--gold)",
  "Gifts/Events": "var(--plum)",
  Finance: "var(--rose)",
  Vendors: "var(--gold)",
  Other: "#d8c6c8",
};

export const CATEGORY_TINT: Record<TaskCategory, string> = {
  Travel: "var(--lavender-tint)",
  Household: "var(--coral-tint)",
  Scheduling: "var(--sage-tint)",
  Errands: "var(--gold-tint)",
  "Gifts/Events": "var(--plum-tint)",
  Finance: "var(--rose-tint)",
  Vendors: "var(--gold-tint)",
  Other: "#f3eceb",
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

/** Warm, plain-language labels for the three task sources. */
export function sourceLabel(
  source: "From Boss" | "Delegated by Me" | "Personal Reminder",
  bossName?: string | null,
) {
  if (source === "From Boss")
    return bossName ? `From ${bossName}` : "From your boss";
  if (source === "Delegated by Me") return "I've handed off";
  return "Just for me";
}

/** "Just asked, waiting" / "Waiting 3 days" — never abbreviated. */
export function waitingLabel(days: number) {
  if (days <= 0) return "Just asked, waiting";
  if (days === 1) return "Waiting 1 day";
  return `Waiting ${days} days`;
}

export const PETAL_COLORS = [
  "#D9748E",
  "#9A82B8",
  "#E88C7D",
  "#C89A5B",
  "#A45D77",
  "#EFA0B2",
];
