import { todayISO } from "./date-utils";

export const RECURRENCE_TYPES = ["none", "daily", "weekly", "monthly"] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Dow = (typeof DOW)[number];

export type Recurrence = {
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_days: string[];
  recurrence_end_date: string | null;
};

export const NO_RECURRENCE: Recurrence = {
  recurrence_type: "none",
  recurrence_interval: 1,
  recurrence_days: [],
  recurrence_end_date: null,
};

function shiftDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return toISO(date);
}

function toISO(date: Date): string {
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function shiftMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + n, 1);
  // Clamp to the last day of the target month (e.g. 31 Jan + 1 month).
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISO(target);
}

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Next due date for a recurring task, given the date the finished occurrence
 * was due (or today, when the occurrence had no date at all).
 * Returns null when the rule has run out (`none`, or past its end date).
 */
export function nextDueDate(
  from: string | null,
  rule: Recurrence,
): string | null {
  if (rule.recurrence_type === "none") return null;
  const base = from ?? todayISO();
  const interval = Math.max(1, rule.recurrence_interval || 1);

  let next: string;
  if (rule.recurrence_type === "daily") {
    next = shiftDays(base, interval);
  } else if (rule.recurrence_type === "monthly") {
    next = shiftMonths(base, interval);
  } else {
    const picked = (rule.recurrence_days ?? [])
      .map((d) => DOW.indexOf(d as Dow))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (picked.length === 0) {
      next = shiftDays(base, interval * 7);
    } else {
      const cur = dayIndex(base);
      const upcoming = picked.find((i) => i > cur);
      if (upcoming !== undefined) {
        next = shiftDays(base, upcoming - cur);
      } else {
        // Wraps into a following week — honour "every N weeks".
        const delta = 7 - cur + picked[0] + (interval - 1) * 7;
        next = shiftDays(base, delta);
      }
    }
  }

  // Never spawn something already in the past.
  const today = todayISO();
  while (next < today) {
    const bumped = nextDueDate(next, rule);
    if (!bumped || bumped === next) break;
    next = bumped;
  }

  if (rule.recurrence_end_date && next > rule.recurrence_end_date) return null;
  return next;
}

/** Short human label for the Repeats field / task card tooltip. */
export function recurrenceLabel(rule: Recurrence): string {
  const n = Math.max(1, rule.recurrence_interval || 1);
  switch (rule.recurrence_type) {
    case "daily":
      return n === 1 ? "Daily" : `Every ${n} days`;
    case "weekly": {
      const days = (rule.recurrence_days ?? []).filter((d) =>
        (DOW as readonly string[]).includes(d),
      );
      const every = n === 1 ? "Weekly" : `Every ${n} weeks`;
      return days.length ? `${every} on ${days.join(", ")}` : every;
    }
    case "monthly":
      return n === 1 ? "Monthly" : `Every ${n} months`;
    default:
      return "Does not repeat";
  }
}

export function isRecurring(rule: Pick<Recurrence, "recurrence_type"> | null) {
  return !!rule && rule.recurrence_type !== "none";
}
