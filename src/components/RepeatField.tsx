import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DOW, type Recurrence, type RecurrenceType } from "@/lib/recurrence";

type Mode = "none" | "daily" | "weekly" | "monthly" | "custom";

function modeOf(v: Recurrence): Mode {
  if (v.recurrence_type === "none") return "none";
  if ((v.recurrence_interval ?? 1) > 1) return "custom";
  return v.recurrence_type;
}

/**
 * "Repeats" control — a quiet select plus the extra inputs each rule needs.
 * Monochrome by design: no colour, hairline borders, micro-labels only.
 */
export function RepeatField({
  value,
  onChange,
  compact,
}: {
  value: Recurrence;
  onChange: (next: Recurrence) => void;
  compact?: boolean;
}) {
  const mode = modeOf(value);
  const [endsOpen, setEndsOpen] = useState(!!value.recurrence_end_date);

  function setMode(next: Mode) {
    if (next === "none") {
      setEndsOpen(false);
      onChange({
        recurrence_type: "none",
        recurrence_interval: 1,
        recurrence_days: [],
        recurrence_end_date: null,
      });
      return;
    }
    if (next === "custom") {
      onChange({
        ...value,
        recurrence_type:
          value.recurrence_type === "none" ? "weekly" : value.recurrence_type,
        recurrence_interval: Math.max(2, value.recurrence_interval || 2),
      });
      return;
    }
    onChange({
      ...value,
      recurrence_type: next as RecurrenceType,
      recurrence_interval: 1,
      recurrence_days: next === "weekly" ? value.recurrence_days : [],
    });
  }

  function toggleDay(d: string) {
    const set = new Set(value.recurrence_days ?? []);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    onChange({
      ...value,
      recurrence_days: DOW.filter((x) => set.has(x)),
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <SelectTrigger
          className={cn(compact ? "h-8 w-[150px] text-xs" : "mt-1 h-10")}
          aria-label="Repeats"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Does not repeat</SelectItem>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
          <SelectItem value="monthly">Monthly</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {mode === "custom" && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>every</span>
          <Input
            type="number"
            min={1}
            max={365}
            value={value.recurrence_interval || 1}
            onChange={(e) =>
              onChange({
                ...value,
                recurrence_interval: Math.max(
                  1,
                  Math.min(365, Number(e.target.value) || 1),
                ),
              })
            }
            className="h-8 w-16 text-xs"
            aria-label="Repeat interval"
          />
          <Select
            value={value.recurrence_type}
            onValueChange={(v) =>
              onChange({ ...value, recurrence_type: v as RecurrenceType })
            }
          >
            <SelectTrigger className="h-8 w-[92px] text-xs" aria-label="Repeat unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">days</SelectItem>
              <SelectItem value="weekly">weeks</SelectItem>
              <SelectItem value="monthly">months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {value.recurrence_type === "weekly" && (
        <div className="flex flex-wrap gap-1">
          {DOW.map((d) => {
            const on = (value.recurrence_days ?? []).includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={cn(
                  "h-6 w-8 border text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors",
                  on
                    ? "border-foreground bg-foreground text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      )}

      {value.recurrence_type !== "none" &&
        (endsOpen ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="whitespace-nowrap">Ends on</span>
            <Input
              type="date"
              value={value.recurrence_end_date ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  recurrence_end_date: e.target.value || null,
                })
              }
              className="h-8 w-[140px] text-xs"
              aria-label="Repeat end date"
            />
            <button
              type="button"
              onClick={() => {
                setEndsOpen(false);
                onChange({ ...value, recurrence_end_date: null });
              }}
              className="underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEndsOpen(true)}
            className="self-start text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            + Ends on
          </button>
        ))}
    </div>
  );
}
