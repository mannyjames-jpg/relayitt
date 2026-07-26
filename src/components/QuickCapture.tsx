import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTask } from "@/lib/tasks.functions";
import { createContact, listContacts } from "@/lib/contacts.functions";
import { AssigneeCombobox } from "./AssigneeCombobox";
import { VoiceCapture } from "./VoiceCapture";
import { toast } from "sonner";
import { parseQuickEntry, type QuickCategory } from "@/lib/quick-parse";


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

  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>("Personal Reminder");
  const [contactId, setContactId] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [category, setCategory] = useState<Category | null>(null);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [focused, setFocused] = useState(false);
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
    const usedFreeText =
      source === "Delegated by Me" && !contactId && freeText.trim();
    await m.mutateAsync({
      data: {
        title: trimmed,
        source,
        priority:
          parsed.priority ??
          (source === "Delegated by Me" ? priority : "Normal"),
        category:
          parsed.category ?? (source === "From Boss" ? category : null),
        due_date: parsed.due_date,
        due_time: parsed.due_time,
        assigned_to: source === "Delegated by Me" ? contactId : null,
        assigned_to_name:
          source === "Delegated by Me" && !contactId
            ? freeText.trim() || null
            : null,
      },
    });
    toast.success("Task added", {
      description: parsed.hints.length ? parsed.hints.join(" · ") : undefined,
    });
    setTitle("");
    if (usedFreeText) {
      const nm = freeText.trim();
      if (!contacts.some((c) => c.name.toLowerCase() === nm.toLowerCase())) {
        setSavePrompt({ name: nm });
      }
    }
    // Collapse contextual fields back to defaults after each capture.
    setContactId(null);
    setFreeText("");
    setPriority("Normal");
    setCategory(null);
    inputRef.current?.focus();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitTask();
  }


  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-2xl px-4 py-3">
        <form onSubmit={onSubmit} className={cn("flex gap-2", shake && "animate-shake")}>
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                // Delay so pill taps register as source changes, not filter changes.
                setTimeout(() => setFocused(false), 150);
              }}
              placeholder="Add a task…"
              maxLength={200}
              className="h-11 pr-10"
              aria-label="New task"
            />
            {flash && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-flash">
                ✓
              </span>
            )}
          </div>
          <VoiceCapture contacts={contacts} />
          <Button
            type="submit"
            className="h-11 px-4"
            disabled={!title.trim() || m.isPending}
            aria-label="Add task"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {focused ? "Adding as:" : "Showing:"}
          </span>
          <div
            role="tablist"
            aria-label={focused ? "Task source" : "Filter tasks by source"}
            className={cn(
              "inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs",
              focused && "border-primary/40 bg-primary/5",
            )}
          >
            {!focused && (
              <button
                type="button"
                role="tab"
                aria-selected={filter === "All"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onFilterChange("All")}
                className={cn(
                  "px-2.5 py-1.5 rounded-sm transition-colors min-h-[32px]",
                  filter === "All"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
            )}
            {SOURCES.map((s) => {
              const selected = focused ? source === s : filter === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking so focus stays and we set source.
                    if (focused) e.preventDefault();
                  }}
                  onClick={() => {
                    if (focused) setSource(s);
                    else onFilterChange(s);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 rounded-sm transition-colors min-h-[32px]",
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "From Boss" ? "Boss" : s === "Delegated by Me" ? "Delegated" : "Personal"}
                </button>
              );
            })}
          </div>
        </div>

        {focused && (
          <div className="mt-2 flex flex-wrap items-center gap-2">


          {source === "Delegated by Me" && (
            <>
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
              <div
                role="tablist"
                aria-label="Priority"
                className="inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs"
              >
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={priority === p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-sm transition-colors min-h-[32px]",
                      priority === p
                        ? p === "Urgent"
                          ? "bg-primary/15 text-primary shadow-sm font-medium"
                          : "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}

          {source === "From Boss" && (
            <div className="flex flex-wrap items-center gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() =>
                    setCategory((prev) => (prev === c ? null : c))
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors min-h-[32px]",
                    category === c
                      ? "border-transparent bg-sage/25 text-sage-foreground"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          </div>
        )}


        {savePrompt && (
          <div className="mt-2 flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
            <span>
              Save <span className="font-medium">{savePrompt.name}</span> as a contact?
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
