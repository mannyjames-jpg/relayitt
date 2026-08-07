import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, X } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createTask } from "@/lib/tasks.functions";
import { createContact, listContacts } from "@/lib/contacts.functions";
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

export function QuickCapture({
  filter,
  onFilterChange,
}: {
  filter: FilterSource;
  onFilterChange: (f: FilterSource) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTask);
  const createC = useServerFn(createContact);
  const listC = useServerFn(listContacts);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => listC(),
  });

  // Name the person tasks come from, when a contact is marked as such.
  const bossName = useMemo(() => {
    const match = contacts.find((c) =>
      /boss|principal|employer/i.test(c.role ?? ""),
    );
    return match?.name.split(" ")[0] ?? null;
  }, [contacts]);

  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>("Personal Reminder");
  const [contactId, setContactId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [category, setCategory] = useState<Category | null>(null);
  const [repeat, setRepeat] = useState<Recurrence>(NO_RECURRENCE);

  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [savePrompt, setSavePrompt] = useState<{ name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    },
  });

  const saveContactM = useMutation({
    mutationFn: createC,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });

  useEffect(() => {
    inputRef.current?.focus();
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
      parsed.due_date ??
      (rule.recurrence_type !== "none" ? nextDueDate(todayISO(), rule) : null);
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
    <div className="sticky top-0 z-20 border-b border-border-strong bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between pb-3">
          <span className="font-wordmark text-foreground">Relay</span>
          <div className="flex items-center gap-2">
            <span className="micro-label">Showing</span>
            <Select
              value={filter}
              onValueChange={(v) => onFilterChange(v as FilterSource)}
            >
              <SelectTrigger
                className="h-7 w-auto gap-1.5 border-border-strong bg-card px-2 text-[11px]"
                aria-label="Filter tasks by source"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="All">All tasks</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {sourceLabel(s, bossName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className={cn("flex gap-2", shake && "animate-shake")}
        >
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !(e.nativeEvent as KeyboardEvent).isComposing
                ) {
                  e.preventDefault();
                  if (!m.isPending) void submitTask();
                }
              }}
              placeholder="What do you need to remember? Just type it naturally…"
              maxLength={200}
              className="h-11 border-border-strong bg-card pl-3.5 pr-10 text-[15px]"
              aria-label="New task"
            />
            {flash && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-flash text-foreground">
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
            )}
          </div>

          <VoiceCapture contacts={contacts} />
          <Button
            type="submit"
            className="h-11 px-5"
            disabled={!title.trim() || m.isPending}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add task
          </Button>
        </form>


        {/* Details collapse to keep the top of the screen calm on mobile. */}
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                detailsOpen && "rotate-180",
              )}
            />
            {detailsOpen ? "Hide details" : "Add details"}
          </button>
          <Link
            to="/settings"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Settings
          </Link>
        </div>

        <div
          hidden={!detailsOpen}
          className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2.5 data-[hidden]:hidden"
        >
          <Field label="Created by / From" help={SOURCE_HELP[source]}>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger
                className="h-8 w-[168px] text-xs"
                aria-label="Created by or from"
              >
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

          <Field
            label="Assigned to"
            help="Who will actually do this. Leave empty if it's you."
          >
            <AssigneeCombobox
              compact
              contacts={contacts}
              contactId={contactId}
              freeText={freeText}
              onChange={({ contactId: id, freeText: t }) => {
                setContactId(id);
                setFreeText(t);
              }}
            />
          </Field>

          <Field label="Priority" help="Urgent tasks pin to the top of a list.">
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
            >
              <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Priority">
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

          <Field label="Category" help="Used to group and colour-code tasks.">
            <Select
              value={category ?? "__none"}
              onValueChange={(v) =>
                setCategory(v === "__none" ? null : (v as Category))
              }
            >
              <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Category">
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
            <RepeatField
              compact
              value={parsed.recurrence ?? repeat}
              onChange={setRepeat}
            />
          </Field>



          <Link
            to="/settings"
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Settings
          </Link>
        </div>

        {parsed.hints.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="micro-label">Detected</span>
            {parsed.hints.map((h) => (
              <span key={h} className="tag-quiet">
                {h}
              </span>
            ))}
          </div>
        )}

        {savePrompt && (
          <div className="mt-2 flex items-center justify-between border border-border-strong bg-card px-3 py-2 text-sm">

            <span>
              Save <span className="font-medium">{savePrompt.name}</span> as a
              contact?
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSavePrompt(null)}
              >
                No
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await saveContactM.mutateAsync({
                    data: { name: savePrompt.name },
                  });
                  setSavePrompt(null);
                }}
              >
                Save
              </Button>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setSavePrompt(null)}
                className="ml-1 rounded p-1 hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
