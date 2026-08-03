import { todayISO } from "./date-utils";
import {
  DOW,
  NO_RECURRENCE,
  recurrenceLabel,
  type Recurrence,
} from "./recurrence";



export type QuickCategory =
  | "Travel"
  | "Household"
  | "Scheduling"
  | "Errands"
  | "Gifts/Events"
  | "Finance"
  | "Vendors"
  | "Other";

export type QuickPriority = "Normal" | "Important" | "Urgent";

const CATEGORY_ALIASES: Record<string, QuickCategory> = {
  travel: "Travel",
  trip: "Travel",
  household: "Household",
  home: "Household",
  scheduling: "Scheduling",
  schedule: "Scheduling",
  cal: "Scheduling",
  errands: "Errands",
  errand: "Errands",
  gifts: "Gifts/Events",
  gift: "Gifts/Events",
  events: "Gifts/Events",
  event: "Gifts/Events",
  finance: "Finance",
  money: "Finance",
  vendors: "Vendors",
  vendor: "Vendors",
  other: "Other",
};

const PRIORITY_ALIASES: Record<string, QuickPriority> = {
  urgent: "Urgent",
  high: "Urgent",
  "1": "Urgent",
  important: "Important",
  imp: "Important",
  med: "Important",
  "2": "Important",
  normal: "Normal",
  low: "Normal",
  "3": "Normal",
};

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type ParsedQuickEntry = {
  title: string;
  due_date: string | null;
  due_time: string | null;
  category: QuickCategory | null;
  priority: QuickPriority | null;
  /** Human-readable list of what was detected, for feedback. */
  hints: string[];
};

/**
 * Parse inline shortcuts out of a quick-capture string:
 *   "Book flights tomorrow 9am #travel !urgent"
 * Recognises dates (today/tomorrow/weekday names/next week/YYYY-MM-DD),
 * times (9am, 09:30), #category and !priority tokens.
 */
export function parseQuickEntry(input: string): ParsedQuickEntry {
  let due_date: string | null = null;
  let due_time: string | null = null;
  let category: QuickCategory | null = null;
  let priority: QuickPriority | null = null;
  const hints: string[] = [];
  const today = todayISO();

  const kept: string[] = [];
  const words = input.split(/\s+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const bare = w.replace(/[.,;:]$/, "");
    const lower = bare.toLowerCase();

    if (lower.startsWith("#") && lower.length > 1) {
      const cat = CATEGORY_ALIASES[lower.slice(1)];
      if (cat) {
        category = cat;
        hints.push(cat);
        continue;
      }
    }

    if (lower.startsWith("!") && lower.length > 1) {
      const p = PRIORITY_ALIASES[lower.slice(1)];
      if (p) {
        priority = p;
        hints.push(p);
        continue;
      }
    }

    if (!due_date) {
      if (lower === "today") {
        due_date = today;
        hints.push("today");
        continue;
      }
      if (lower === "tomorrow" || lower === "tmr" || lower === "tmrw") {
        due_date = addDays(today, 1);
        hints.push("tomorrow");
        continue;
      }
      if (
        lower === "next" &&
        words[i + 1]?.toLowerCase().replace(/[.,;:]$/, "") === "week"
      ) {
        due_date = addDays(today, 7);
        hints.push("next week");
        i++;
        continue;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) {
        due_date = lower;
        hints.push(lower);
        continue;
      }
      const wdIndex = WEEKDAYS.findIndex(
        (d) => d === lower || d.slice(0, 3) === lower,
      );
      if (wdIndex >= 0) {
        const [y, m, d] = today.split("-").map(Number);
        const cur = new Date(y, m - 1, d).getDay();
        let delta = (wdIndex - cur + 7) % 7;
        if (delta === 0) delta = 7;
        due_date = addDays(today, delta);
        hints.push(WEEKDAYS[wdIndex]);
        continue;
      }
    }

    if (!due_time) {
      const ampm = lower.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
      if (ampm) {
        let h = Number(ampm[1]) % 12;
        if (ampm[3] === "pm") h += 12;
        due_time = `${String(h).padStart(2, "0")}:${ampm[2] ?? "00"}`;
        hints.push(due_time);
        continue;
      }
      const hhmm = lower.match(/^(\d{1,2}):(\d{2})$/);
      if (hhmm && Number(hhmm[1]) < 24) {
        due_time = `${hhmm[1].padStart(2, "0")}:${hhmm[2]}`;
        hints.push(due_time);
        continue;
      }
    }

    kept.push(w);
  }

  // A time on its own has no meaning without a date — default to today.
  if (due_time && !due_date) due_date = today;

  return {
    title: kept.join(" ").replace(/\s{2,}/g, " ").trim(),
    due_date,
    due_time,
    category,
    priority,
    hints,
  };
}
