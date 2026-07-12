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

const SOURCES = ["From Boss", "Delegated by Me", "Personal Reminder"] as const;
type Source = (typeof SOURCES)[number];

export function QuickCapture() {
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const usedFreeText = source === "Delegated by Me" && !contactId && freeText.trim();
    await m.mutateAsync({
      data: {
        title: trimmed,
        source,
        assigned_to: source === "Delegated by Me" ? contactId : null,
        assigned_to_name:
          source === "Delegated by Me" && !contactId ? freeText.trim() || null : null,
      },
    });
    setTitle("");
    if (usedFreeText) {
      const nm = freeText.trim();
      // only prompt if not already an existing contact by name
      if (!contacts.some((c) => c.name.toLowerCase() === nm.toLowerCase())) {
        setSavePrompt({ name: nm });
      }
    }
    setContactId(null);
    setFreeText("");
    // Keep source (session memory)
    inputRef.current?.focus();
  }

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-2xl px-4 py-3">
        <form
          onSubmit={onSubmit}
          className={cn("flex gap-2", shake && "animate-shake")}
        >
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
          <Button
            type="submit"
            className="h-11 px-4"
            disabled={!title.trim() || m.isPending}
            aria-label="Add task"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Task source"
            className="inline-flex rounded-md border border-border bg-secondary p-0.5 text-xs"
          >
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={source === s}
                onClick={() => setSource(s)}
                className={cn(
                  "px-2.5 py-1.5 rounded-sm transition-colors min-h-[32px]",
                  source === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "From Boss" ? "Boss" : s === "Delegated by Me" ? "Delegated" : "Personal"}
              </button>
            ))}
          </div>

          {source === "Delegated by Me" && (
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
          )}
        </div>

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
