import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BellRing,
  Calendar as CalIcon,
  Check,
  Circle,
  Clock,
  MessageCircleQuestion,
  MessageSquare,
  Phone,
  Play,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  deleteTask,
  getVoiceNoteUrl,
  nudgeTask,
  updateTask,
} from "@/lib/tasks.functions";
import { formatTime, daysSince } from "@/lib/date-utils";
import type { ContactOption } from "./AssigneeCombobox";
import { AssigneeCombobox } from "./AssigneeCombobox";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  source: "From Boss" | "Delegated by Me" | "Personal Reminder";
  status: "Not Started" | "In Progress" | "Waiting on Someone" | "Done";
  category:
    | "Travel"
    | "Household"
    | "Scheduling"
    | "Errands"
    | "Gifts/Events"
    | "Finance"
    | "Vendors"
    | "Other"
    | null;
  priority: "Normal" | "Important" | "Urgent";
  assigned_to: string | null;
  assigned_to_name: string | null;
  delegated_to_contact_id?: string | null;
  due_date: string | null;
  due_time: string | null;
  last_followup_at: string | null;
  next_followup_reminder_at?: string | null;
  source_type?: "Typed" | "Voice";
  voice_note_url?: string | null;
  raw_transcript?: string | null;
  created_at: string;
};

type Category = NonNullable<Task["category"]>;

const CATEGORIES: Category[] = [
  "Travel",
  "Household",
  "Scheduling",
  "Errands",
  "Gifts/Events",
  "Finance",
  "Vendors",
  "Other",
];

const CATEGORY_PILL: Record<Category, string> = {
  Travel: "pill-cat-travel",
  Household: "pill-cat-household",
  Scheduling: "pill-cat-scheduling",
  Errands: "pill-cat-errands",
  "Gifts/Events": "pill-cat-gifts",
  Finance: "pill-cat-finance",
  Vendors: "pill-cat-vendors",
  Other: "pill-cat-other",
};

const STATUS_ICON: Record<Task["status"], React.ReactNode> = {
  "Not Started": <Circle className="h-3.5 w-3.5" />,
  "In Progress": <Play className="h-3.5 w-3.5" />,
  "Waiting on Someone": <MessageCircleQuestion className="h-3.5 w-3.5" />,
  Done: <Check className="h-3.5 w-3.5" />,
};

export function TaskRow({
  task,
  contacts,
  showWaitingBadge,
  overdue,
}: {
  task: Task;
  contacts: ContactOption[];
  showWaitingBadge?: boolean;
  overdue?: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const nudge = useServerFn(nudgeTask);
  const getVoice = useServerFn(getVoiceNoteUrl);

  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [nudgeFlash, setNudgeFlash] = useState(false);
  const [nudgeStep, setNudgeStep] = useState<null | "contact" | "reminder">(null);
  const [remindDays, setRemindDays] = useState<number>(2);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [dueTime, setDueTime] = useState(task.due_time?.slice(0, 5) ?? "");
  const [contactId, setContactId] = useState<string | null>(task.assigned_to);
  const [freeText, setFreeText] = useState(task.assigned_to_name ?? "");
  const [category, setCategory] = useState<Category | null>(task.category);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setDueTime(task.due_time?.slice(0, 5) ?? "");
    setContactId(task.assigned_to);
    setFreeText(task.assigned_to_name ?? "");
    setCategory(task.category);
    setPriority(task.priority);
  }, [task]);

  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const deleteM = useMutation({
    mutationFn: del,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const nudgeM = useMutation({
    mutationFn: nudge,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const assignee =
    contacts.find((c) => c.id === task.assigned_to)?.name ??
    task.assigned_to_name;

  const isUrgent = task.priority === "Urgent";

  async function toggleDone() {
    setCompleting(true);
    setTimeout(async () => {
      await updateM.mutateAsync({ data: { id: task.id, status: "Done" } });
      toast("Task completed", {
        action: {
          label: "Undo",
          onClick: async () => {
            await updateM.mutateAsync({
              data: { id: task.id, status: "Not Started" },
            });
          },
        },
      });
    }, 500);
  }

  async function handleDelete() {
    const snapshot = task;
    await deleteM.mutateAsync({ data: { id: task.id } });
    toast("Task deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const create = (await import("@/lib/tasks.functions")).createTask;
          await create({
            data: {
              title: snapshot.title,
              source: snapshot.source,
              notes: snapshot.notes,
              category: snapshot.category,
              priority: snapshot.priority,
              assigned_to: snapshot.assigned_to,
              assigned_to_name: snapshot.assigned_to_name,
              due_date: snapshot.due_date,
              due_time: snapshot.due_time,
            },
          });
          qc.invalidateQueries({ queryKey: ["tasks"] });
        },
      },
    });
  }

  async function saveEdits() {
    await updateM.mutateAsync({
      data: {
        id: task.id,
        title: title.trim() || task.title,
        notes: notes || null,
        status,
        category,
        priority,
        assigned_to: contactId,
        assigned_to_name: contactId ? null : freeText.trim() || null,
        due_date: dueDate || null,
        due_time: dueDate ? dueTime || null : null,
      },
    });
    setExpanded(false);
  }

  async function playOriginal() {
    if (!task.voice_note_url) return;
    try {
      const res = await getVoice({ data: { path: task.voice_note_url } });
      const audio = new Audio(res.url);
      void audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't play audio");
    }
  }

  const waitDays = daysSince(task.last_followup_at ?? task.created_at);
  const followupOverdue =
    !!task.next_followup_reminder_at &&
    new Date(task.next_followup_reminder_at).getTime() < Date.now();
  const nudgeContact = contacts.find((c) => c.id === task.assigned_to) ?? null;

  const accent = CATEGORY_COLOR[task.category ?? "Other"];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_10px_-9px_rgba(61,43,48,0.7)] transition-shadow hover:shadow-[0_10px_24px_-18px_rgba(61,43,48,0.8)]",
        completing && "animate-complete",
      )}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: accent }}
      />

      <div className="flex items-start gap-3 py-3 pl-5 pr-3">
        <div className="relative mt-0.5 shrink-0">
          {burst && <PetalBurst />}
          <button
            type="button"
            onClick={toggleDone}
            aria-label={`Mark ${task.title} done`}
            className={cn(
              "relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-border transition-all hover:border-primary",
              completing && "border-transparent bg-gradient-rose animate-ring-pop",
            )}
          >
            <Check
              className={cn(
                "h-3.5 w-3.5 text-primary-foreground transition-opacity",
                completing ? "opacity-100" : "opacity-0",
              )}
              strokeWidth={3}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start gap-2">
            {isUrgent && (
              <span
                aria-label="Urgent"
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
              />
            )}
            <div
              className={cn(
                "min-w-0 break-words text-[15px] leading-snug text-foreground",
                isUrgent && "font-semibold",
              )}
            >
              {task.title}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {task.category && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  CATEGORY_PILL[task.category],
                )}
              >
                {task.category}
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                <AlertCircle className="h-3 w-3" strokeWidth={2} />
                Past its date
              </span>
            )}
            {task.priority === "Important" && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold pill-cat-gifts">
                Important
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              {STATUS_ICON[status]}
              <span>{status}</span>
            </span>
            {task.due_date && (
              <span className="inline-flex items-center gap-1">
                <CalIcon className="h-3.5 w-3.5" strokeWidth={2} />
                {task.due_date}
                {task.due_time && (
                  <>
                    <Clock className="ml-1 h-3.5 w-3.5" strokeWidth={2} />
                    {formatTime(task.due_time)}
                  </>
                )}
              </span>
            )}
            {assignee && <span className="truncate">→ {assignee}</span>}
            {showWaitingBadge && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                  waitDays >= 3
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "bg-secondary text-muted-foreground",
                  followupOverdue &&
                    "ring-2 ring-primary/50 ring-offset-1 ring-offset-card",
                  nudgeFlash && "animate-flash",
                )}
                title={
                  followupOverdue
                    ? "You asked to be reminded about this — that time has passed"
                    : undefined
                }
              >
                {waitingLabel(waitDays)}
              </span>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Select
            value={status}
            onValueChange={async (v) => {
              const next = v as Task["status"];
              setStatus(next);
              await updateM.mutateAsync({ data: { id: task.id, status: next } });
            }}
          >
            <SelectTrigger
              className="h-8 w-8 border-0 bg-transparent p-0 shadow-none [&>svg:last-child]:hidden"
              aria-label="Change status"
              title={`Status: ${status}`}
            >
              <span className="sr-only">{status}</span>
            </SelectTrigger>
            <SelectContent align="end">
              {(
                [
                  "Not Started",
                  "In Progress",
                  "Waiting on Someone",
                  "Done",
                ] as Task["status"][]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="inline-flex items-center gap-2">
                    {STATUS_ICON[s]}
                    {s}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Quick actions slide in from the right on hover / keyboard focus */}
          <div className="flex items-center gap-1 translate-x-3 opacity-0 transition-all duration-200 focus-within:translate-x-0 focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100">
            {showWaitingBadge && (
              <button
                type="button"
                onClick={() => {
                  setRemindDays(2);
                  setNudgeStep(
                    nudgeContact?.phone || nudgeContact?.email
                      ? "contact"
                      : "reminder",
                  );
                }}
                title="Nudge them and set a reminder"
                aria-label="Follow up and set a reminder"
                className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-colors hover:bg-accent"
              >
                <BellRing className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="Remove this task"
              aria-label={`Delete ${task.title}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>


      {expanded && (
        <div className="px-3 pb-4 space-y-3 bg-surface border-t border-border">
          <div className="pt-3">
            <Label htmlFor={`t-${task.id}`} className="text-xs">
              Title
            </Label>
            <Input
              id={`t-${task.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`n-${task.id}`} className="text-xs">
              Notes
            </Label>
            <Textarea
              id={`n-${task.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                value={category ?? "__none"}
                onValueChange={(v) =>
                  setCategory(v === "__none" ? null : (v as Category))
                }
              >
                <SelectTrigger className="mt-1 h-10">
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
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Task["priority"])}
              >
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Important">Important</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`d-${task.id}`} className="text-xs">
                Due date
              </Label>
              <Input
                id={`d-${task.id}`}
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  if (!e.target.value) setDueTime("");
                }}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`ti-${task.id}`} className="text-xs">
                Time
              </Label>
              <Input
                id={`ti-${task.id}`}
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Assigned to</Label>
            <div className="mt-1">
              <AssigneeCombobox
                contacts={contacts}
                contactId={contactId}
                freeText={freeText}
                onChange={({ contactId: id, freeText: t }) => {
                  setContactId(id);
                  setFreeText(t);
                }}
              />
            </div>
          </div>

          {task.source_type === "Voice" && (
            <div className="rounded-md bg-secondary/70 px-3 py-2 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground/80">
                  From voice note
                </span>
                {task.voice_note_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1"
                    onClick={playOriginal}
                  >
                    <PlayCircle className="h-4 w-4" />
                    Play original
                  </Button>
                )}
              </div>
              {task.raw_transcript && (
                <p className="italic">"{task.raw_transcript}"</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveEdits}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={nudgeStep !== null}
        onOpenChange={(o) => {
          if (!o) setNudgeStep(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {nudgeStep === "contact" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Reach out to {nudgeContact?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-1">
                {nudgeContact?.phone ? (
                  <>
                    <Button
                      asChild
                      className="w-full justify-start h-11"
                      variant="secondary"
                      onClick={() => setNudgeStep("reminder")}
                    >
                      <a href={`tel:${nudgeContact.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call {nudgeContact.phone}
                      </a>
                    </Button>
                    <Button
                      asChild
                      className="w-full justify-start h-11"
                      variant="secondary"
                      onClick={() => setNudgeStep("reminder")}
                    >
                      <a href={`sms:${nudgeContact.phone}`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Text {nudgeContact.phone}
                      </a>
                    </Button>
                  </>
                ) : nudgeContact?.email ? (
                  <Button
                    asChild
                    className="w-full justify-start h-11"
                    variant="secondary"
                    onClick={() => setNudgeStep("reminder")}
                  >
                    <a href={`mailto:${nudgeContact.email}`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Email {nudgeContact.email}
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No phone number saved for this contact.{" "}
                    <a
                      href={`/contacts/${nudgeContact?.id ?? ""}`}
                      className="text-primary underline"
                    >
                      Add phone number
                    </a>
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setNudgeStep("reminder")}>
                  Skip
                </Button>
              </DialogFooter>
            </>
          )}

          {nudgeStep === "reminder" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  Remind you again?
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <p className="text-sm text-muted-foreground">
                  If there's no response, we'll flag this task again.
                </p>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`rd-${task.id}`} className="text-sm">
                    In
                  </Label>
                  <Input
                    id={`rd-${task.id}`}
                    type="number"
                    min={1}
                    max={60}
                    value={remindDays}
                    onChange={(e) =>
                      setRemindDays(
                        Math.max(1, Math.min(60, Number(e.target.value) || 1)),
                      )
                    }
                    className="h-10 w-20"
                  />
                  <span className="text-sm">days</span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="ghost"
                  onClick={async () => {
                    setNudgeStep(null);
                    setNudgeFlash(true);
                    setTimeout(() => setNudgeFlash(false), 700);
                    await nudgeM.mutateAsync({
                      data: { id: task.id, remind_in_days: null },
                    });
                  }}
                >
                  Skip reminder
                </Button>
                <Button
                  onClick={async () => {
                    setNudgeStep(null);
                    setNudgeFlash(true);
                    setTimeout(() => setNudgeFlash(false), 700);
                    await nudgeM.mutateAsync({
                      data: { id: task.id, remind_in_days: remindDays },
                    });
                  }}
                >
                  Remind in {remindDays}d
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete this task?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be removed. You'll have a moment to undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmDelete(false);
                await handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

