import type { ParsedQuickEntry, QuickCategory, QuickPriority } from "./quick-parse";
import { NO_RECURRENCE, nextDueDate, type Recurrence } from "./recurrence";

export type QuickOverrides = {
  due_date?: string | null;
  due_time?: string | null;
  priority?: QuickPriority;
  category?: QuickCategory | null;
  recurrence?: Recurrence;
};

export function effectiveQuickValues(parsed: ParsedQuickEntry, manual: QuickOverrides, today: string) {
  const recurrence = manual.recurrence ?? parsed.recurrence ?? NO_RECURRENCE;
  const due_date = manual.due_date !== undefined ? manual.due_date :
    parsed.due_date ?? (recurrence.recurrence_type !== "none" ? nextDueDate(today, recurrence) : null);
  return {
    due_date,
    due_time: due_date ? (manual.due_time !== undefined ? manual.due_time : parsed.due_time) : null,
    priority: manual.priority ?? parsed.priority ?? "Normal",
    category: manual.category !== undefined ? manual.category : parsed.category,
    recurrence,
  };
}

export function quickDateOptions(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const shifted = (offset: number) => {
    const date = new Date(year, month - 1, day + offset);
    return { date, value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` };
  };
  const twoDays = shifted(2);
  return [
    { label: "Today", value: today },
    { label: "Tomorrow", value: shifted(1).value },
    { label: twoDays.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), value: twoDays.value },
    { label: "Next week", value: shifted(7).value },
    { label: "No date", value: null },
  ];
}