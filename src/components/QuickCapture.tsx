import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { sourceLabel, SOURCE_HELP } from "@/lib/task-style";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { contactFns, errorMessage, taskFns } from "@/lib/api-client";
import { AssigneeCombobox } from "./AssigneeCombobox";
import { VoiceCapture } from "./VoiceCapture";
import { toast } from "sonner";
import { parseQuickEntry, type QuickCategory } from "@/lib/quick-parse";
import { RepeatField } from "./RepeatField";
import { NO_RECURRENCE, nextDueDate, type Recurrence } from "@/lib/recurrence";
import { todayISO } from "@/lib/date-utils";

const SOURCES = ["From Boss", "Delegated by Me", "Personal Reminder"] as const;
type Source = (typeof SOURCES)[number];
export type FilterSource = Source | "All";

const PRIORITIES = ["Normal", "Important", "Urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

const CATEGORIES = [
  "Travel",
  "Household",
  "Scheduling",
  "Errands",
  "Gifts/Events",
  "Finance",
  "Vendors",
  "Other",
] as const;
type Category = QuickCategory;

export const QuickCapture = forwardRef<
  HTMLInputElement,
  {
    filter: FilterSource;
    onFilterChange: (f: FilterSource) => void;
    headerAction?: React.ReactNode;
    onHeightChange?: (height: number) => void;
  }
>(function QuickCapture({ filter, onFilterChange, headerAction, onHeightChange }, forwardedRef) {
  const qc = useQueryClient();
  const create = taskFns.create;
  const createC = contactFns.create;
  const listC = contactFns.list;

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => listC(),
  });

  // Name the person tasks come from, when a contact is marked as such.
  const bossName = useMemo(() => {
    const match = contacts.find((c) => /boss|principal|employer/i.test(c.role ?? ""));
    return match?.name.split(" ")[0] ?? null;
  }, [contacts]);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>("Personal Reminder");
  const [contactId, setContactId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [category, setCategory] = useState<Category | null>(null);
  const [repeat, setRepeat] = useState<Recurrence>(NO_RECURRENCE);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [savePrompt, setSavePrompt] = useState<{ name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  function setInputRef(node: HTMLInputElement | null) {
    inputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const saveContactM = useMutation({
    mutationFn: createC,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  useEffect(() => {
    const node = captureRef.current;
    if (!node || !onHeightChange) return;
    const report = () => onHeightChange(Math.ceil(node.getBoundingClientRect().height));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const parsed = useMemo(() => parseQuickEntry(title), [title]);

  async function submitTask() {
    const trimmed = parsed.title.trim() || title.trim();
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const usedFreeText = !contactId && freeText.trim();
    const rule = parsed.recurrence ?? repeat;
    // A repeating task with no date starts on its first matching day.
    const firstDue =
      parsed.due_date ?? (rule.recurrence_type !== "none" ? nextDueDate(todayISO(), rule) : null);
    await m.mutateAsync({
      data: {
        title: trimmed,
        source,
        priority: parsed.priority ?? priority,
        category: parsed.category ?? category,
        due_date: firstDue,
        due_time: parsed.due_time,
        assigned_to: contactId,
        assigned_to_name: contactId ? null : freeText.trim() || null,
        recurrence_type: rule.recurrence_type,
        recurrence_interval: rule.recurrence_interval,
        recurrence_days: rule.recurrence_days,
        recurrence_end_date: rule.recurrence_end_date,
      },
    });

    toast.success("Added to your list — you'll find it under Today", {
      duration: 4000,
      description: parsed.hints.length ? parsed.hints.join(" · ") : undefined,
    });
    setTitle("");
    if (usedFreeText) {
      const nm = freeText.trim();
      if (!contacts.some((c) => c.name.toLowerCase() === nm.toLowerCase())) {
        setSavePrompt({ name: nm });
      }
    }
    setContactId(null);
    setFreeText("");
    setPriority("Normal");
    setCategory(null);
    setRepeat(NO_RECURRENCE);

    inputRef.current?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitTask();
  }

  return (
    <div
      ref={captureRef}
      className={cn("sticky top-0 z-30 bg-card", scrolled && "border-b border-border")}
    >
      <div className="mx-auto max-w-[900px] px-5 pb-3.5 pt-3 min-[821px]:px-14">
        <form
          onSubmit={onSubmit}
          className={cn(
            "flex min-w-0 border border-foreground bg-white outline-offset-2 focus-within:border-alert focus-within:outline focus-within:outline-1 focus-within:outline-alert",
            shake && "animate-shake",
          )}
        >
          <Input
            ref={setInputRef}
            value={title}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setTitle("");
                e.currentTarget.blur();
                return;
              }
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !(e.nativeEvent as KeyboardEvent).isComposing
              ) {
                e.preventDefault();
                if (!m.isPending) void submitTask();
              }
            }}
            placeholder="What do you need to remember? Try “Book flights friday #travel !important”"
            maxLength={200}
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-4 text-[16px] shadow-none outline-none focus-visible:ring-0 sm:h-[52px] max-sm:placeholder:text-transparent"
            aria-label="New task"
          />
          {flash && (
            <span className="pointer-events-none self-center text-foreground">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </span>
          )}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border-l border-border sm:h-[52px] sm:w-[52px] [&>button]:h-full [&>button]:w-full">
            <VoiceCapture contacts={contacts} />
          </div>
          <Button
            type="submit"
            className="h-12 shrink-0 bg-primary px-3 text-[12px] text-primary-foreground opacity-100 tracking-[0.14em] hover:bg-alert disabled:pointer-events-none disabled:bg-primary disabled:text-primary-foreground disabled:opacity-100 sm:h-[52px] sm:px-[22px]"
            disabled={!title.trim() || m.isPending}
          >
            Add task
          </Button>
        </form>
        <span className="sr-only max-sm:not-sr-only max-sm:absolute max-sm:left-9 max-sm:top-[72px] max-sm:pointer-events-none max-sm:text-[16px] max-sm:text-muted-foreground peer-focus:hidden">
          {!title && "Add a task"}
        </span>

        <div className="mt-2.5 flex min-h-[30px] min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="micro-label hidden shrink-0 sm:inline">
              {inputFocused ? "New task from" : "Showing"}
            </span>
            <div
              role="group"
              aria-label="Filter tasks by source"
              className="flex min-w-0 max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {(["All", ...SOURCES] as FilterSource[]).map((option) => {
                const selected = filter === option;
                const labels: Record<FilterSource, string> = {
                  All: "All",
                  "From Boss": bossName ? `From ${bossName}` : "From boss",
                  "Delegated by Me": "Delegated",
                  "Personal Reminder": "Personal",
                };
                return (
                  <Button
                    key={option}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    aria-pressed={selected}
                    onClick={() => onFilterChange(option)}
                    className={cn(
                      "min-h-11 shrink-0 px-2.5 text-[12px] uppercase tracking-[0.08em] shadow-none sm:h-[30px] sm:min-h-[30px]",
                      !selected &&
                        "border-border bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {labels[option]}
                  </Button>
                );
              })}
            </div>
          </div>
          {parsed.hints.length > 0 && (
            <div className="hidden shrink-0 items-center gap-1.5 text-[11px] sm:flex">
              <span className="micro-label">Detected</span>
              {parsed.hints.map((hint) => (
                <span key={hint} className="text-muted-foreground">
                  {hint}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          aria-expanded={detailsOpen}
          className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", detailsOpen && "rotate-180")}
          />
          {detailsOpen ? "Hide details" : "Add details"}
        </button>

        <div
          hidden={!detailsOpen}
          className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2.5 data-[hidden]:hidden"
        >
          <Field label="Created by / From" help={SOURCE_HELP[source]}>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger className="h-8 w-[168px] text-xs" aria-label="Created by or from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned to" help="Who will actually do this. Leave empty if it's you.">
            <AssigneeCombobox
              compact
              contacts={contacts}
              contactId={contactId}
              freeText={freeText}
              onChange={({ contactId: id, freeText: text }) => {
                setContactId(id);
                setFreeText(text);
              }}
            />
          </Field>
          <Field label="Priority" help="Urgent tasks pin to the top of a list.">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category" help="Used to group tasks.">
            <Select
              value={category ?? "__none"}
              onValueChange={(v) => setCategory(v === "__none" ? null : (v as Category))}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Repeats"
            help="Spawns the next occurrence automatically when you complete this one."
          >
            <RepeatField compact value={parsed.recurrence ?? repeat} onChange={setRepeat} />
          </Field>
        </div>

        {savePrompt && (
          <div className="mt-2 flex items-center justify-between border border-border bg-white px-3 py-2 text-sm">
            <span>
              Save <span className="font-medium">{savePrompt.name}</span> as a contact?
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setSavePrompt(null)}>
                No
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await saveContactM.mutateAsync({ data: { name: savePrompt.name } });
                  setSavePrompt(null);
                }}
              >
                Save
              </Button>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setSavePrompt(null)}
                className="ml-1 p-1 hover:bg-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="micro-label whitespace-nowrap">{label}</span>
        </TooltipTrigger>
        <TooltipContent>{help}</TooltipContent>
      </Tooltip>
      {children}
    </label>
  );
}
