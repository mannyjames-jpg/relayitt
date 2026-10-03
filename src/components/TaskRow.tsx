import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronRight,
  Check,
  MessageSquare,
  Phone,
  Play,
  PlayCircle,
  Repeat,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PetalBurst } from "@/components/PetalBurst";
import { STATUS_ORDER, waitingLabel, type TaskStatus } from "@/lib/task-style";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { getVoiceNoteUrl } from "@/lib/tasks.functions";
import { errorMessage, taskFns } from "@/lib/api-client";
import { addStep, deleteStep, listSteps } from "@/lib/steps.functions";
import { formatTime, daysSince } from "@/lib/date-utils";
import { recurrenceLabel, type Recurrence, type RecurrenceType } from "@/lib/recurrence";
import { RepeatField } from "./RepeatField";
import type { ContactOption } from "./AssigneeCombobox";
import { AssigneeCombobox } from "./AssigneeCombobox";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  next_step?: string | null;
  source: "From Boss" | "Delegated by Me" | "Personal Reminder";
  status: TaskStatus;
  status_updated_at?: string | null;
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
  recurrence_type?: RecurrenceType | null;
  recurrence_interval?: number | null;
  recurrence_days?: string[] | null;
  recurrence_end_date?: string | null;
  parent_task_id?: string | null;
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
  const update = taskFns.update;
  const del = taskFns.remove;
  const nudge = taskFns.nudge;
  const getVoice = useServerFn(getVoiceNoteUrl);

  const [expanded, setExpanded] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [nudgeFlash, setNudgeFlash] = useState(false);
  const [nudgeStep, setNudgeStep] = useState<null | "contact" | "status" | "reminder">(null);
  const [remindDays, setRemindDays] = useState<number>(2);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [stepDraft, setStepDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [dueTime, setDueTime] = useState(task.due_time?.slice(0, 5) ?? "");
  const [contactId, setContactId] = useState<string | null>(task.assigned_to);
  const [freeText, setFreeText] = useState(task.assigned_to_name ?? "");
  const [category, setCategory] = useState<Category | null>(task.category);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const taskRule = (t: Task): Recurrence => ({
    recurrence_type: t.recurrence_type ?? "none",
    recurrence_interval: t.recurrence_interval ?? 1,
    recurrence_days: t.recurrence_days ?? [],
    recurrence_end_date: t.recurrence_end_date ?? null,
  });
  const [repeat, setRepeat] = useState<Recurrence>(taskRule(task));
  const rule = taskRule(task);
  const repeats = rule.recurrence_type !== "none";

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
    setRepeat({
      recurrence_type: task.recurrence_type ?? "none",
      recurrence_interval: task.recurrence_interval ?? 1,
      recurrence_days: task.recurrence_days ?? [],
      recurrence_end_date: task.recurrence_end_date ?? null,
    });
  }, [task]);

  const fetchSteps = useServerFn(listSteps);
  const createStep = useServerFn(addStep);
  const removeStep = useServerFn(deleteStep);

  const { data: allSteps = [] } = useQuery({
    queryKey: ["task-steps"],
    queryFn: () => fetchSteps(),
    staleTime: 30_000,
  });
  const steps = allSteps.filter((s) => s.task_id === task.id);
  const latestStep = steps[0] ?? null;

  const invalidateSteps = () => qc.invalidateQueries({ queryKey: ["task-steps"] });
  const addStepM = useMutation({
    mutationFn: createStep,
    onSuccess: invalidateSteps,
  });
  const deleteStepM = useMutation({
    mutationFn: removeStep,
    onSuccess: invalidateSteps,
  });

  async function submitStep() {
    const body = stepDraft.trim();
    if (!body) return;
    setStepDraft("");
    const row = await addStepM.mutateAsync({ data: { task_id: task.id, body } });
    toast("Step logged", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: async () => {
          await deleteStepM.mutateAsync({ data: { id: row.id } });
        },
      },
    });
  }

  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const deleteM = useMutation({
    mutationFn: del,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const nudgeM = useMutation({
    mutationFn: nudge,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const assignee = contacts.find((c) => c.id === task.assigned_to)?.name ?? task.assigned_to_name;

  const isUrgent = task.priority === "Urgent";

  async function setStatusTo(next: TaskStatus) {
    setStatus(next);
    await updateM.mutateAsync({ data: { id: task.id, status: next } });
  }

  async function toggleDone() {
    setBurst(true);
    setTimeout(() => setBurst(false), 700);
    setCompleting(true);
    setTimeout(async () => {
      await updateM.mutateAsync({ data: { id: task.id, status: "Complete" } });
      toast(
        repeats
          ? "Done — the next one is already on your list"
          : "Nicely done — one less thing to worry about",
        {
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              await updateM.mutateAsync({
                data: { id: task.id, status: "Not Started" },
              });
            },
          },
        },
      );
    }, 500);
  }

  async function handleDelete(scope: "one" | "series" = "one") {
    const snapshot = task;
    await deleteM.mutateAsync({ data: { id: task.id, scope } });
    if (repeats) {
      toast(
        scope === "series"
          ? "Stopped repeating — no more occurrences"
          : "Skipped this one — the next occurrence is on your list",
        { duration: 4000 },
      );
      return;
    }
    toast("Removed from your list", {
      duration: 4000,
      action: {
        label: "Undo",
        onClick: async () => {
          await taskFns.create({
            data: {
              title: snapshot.title,
              source: snapshot.source,
              notes: snapshot.notes,
              next_step: snapshot.next_step ?? null,
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
        recurrence_type: repeat.recurrence_type,
        recurrence_interval: repeat.recurrence_interval,
        recurrence_days: repeat.recurrence_days,
        recurrence_end_date: repeat.recurrence_end_date,
      },
    });
    setEditDetailsOpen(false);
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
  const waitingNeedsAttention = !!showWaitingBadge && (waitDays >= 3 || followupOverdue);
  const lateDays = task.due_date ? Math.max(1, daysSince(task.due_date)) : 0;
  const nudgeContact = contacts.find((c) => c.id === task.assigned_to) ?? null;

  const dateParts = task.due_date?.split("-").map(Number);
  const dueDateObject = dateParts ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2]) : null;
  const shortDueDate = dueDateObject?.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const comingDate = dueDateObject?.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const rightColumn = overdue
    ? {
        first: `${lateDays} ${lateDays === 1 ? "day" : "days"} late`,
        second: `${shortDueDate ?? ""}${task.due_time ? ` · ${formatTime(task.due_time)}` : ""}`,
        alert: true,
      }
    : showWaitingBadge
      ? {
          first: waitingLabel(waitDays),
          second: waitingNeedsAttention ? "Time to follow up" : "",
          alert: waitingNeedsAttention,
        }
      : task.due_date === new Date().toLocaleDateString("en-CA")
        ? { first: task.due_time ? formatTime(task.due_time) : "Today", second: "", alert: false }
        : task.due_date
          ? {
              first: comingDate ?? "",
              second: task.due_time ? formatTime(task.due_time) : "",
              alert: false,
            }
          : null;
  const meta = [
    task.category,
    task.priority === "Important" ? "Important" : null,
    repeats ? recurrenceLabel(rule) : null,
    status === "In Progress" ? "In progress" : null,
  ].filter(Boolean);

  async function moveToToday() {
    const today = new Date().toLocaleDateString("en-CA");
    await updateM.mutateAsync({ data: { id: task.id, due_date: today } });
    toast.success("Moved to today");
  }

  return (
    <div
      className={cn(
        "group relative border-t border-border transition-colors hover:bg-foreground/[0.035]",
        completing && "animate-complete",
      )}
    >
      {waitingNeedsAttention && (
        <span
          aria-hidden
          className="absolute -left-3 top-2.5 bottom-2.5 w-0.5 bg-alert min-[821px]:-left-3.5"
        />
      )}
      <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[44px_minmax(0,1fr)_auto]">
        <div className="relative flex h-11 w-11 items-center justify-center">
          {burst && <PetalBurst />}
          <button
            type="button"
            onClick={toggleDone}
            data-task-check={task.id}
            aria-label={`Mark ${task.title} complete`}
            className={cn(
              "relative flex h-[18px] w-[18px] items-center justify-center border-[1.5px] border-foreground transition-transform duration-100 active:scale-[0.84]",
              completing && "bg-primary animate-ring-pop",
            )}
          >
            <Check
              className={cn(
                "h-3 w-3 text-primary-foreground transition-opacity",
                completing ? "opacity-100" : "opacity-0",
              )}
              strokeWidth={3}
            />
          </button>
        </div>

        <div className="min-w-0 py-3 pr-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            data-task-title={task.id}
            className="flex w-full min-w-0 items-start text-left"
          >
            {isUrgent && (
              <span
                aria-label="Urgent"
                className="mr-2 mt-[7px] h-[7px] w-[7px] shrink-0 bg-foreground"
              />
            )}
            <span
              className={cn(
                "min-w-0 break-words text-[15.5px] leading-[1.35] text-foreground",
                isUrgent ? "font-bold" : "font-normal",
              )}
            >
              {task.title}
            </span>
          </button>
          {meta.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center text-[12.5px] text-muted-foreground">
              {meta.map((item, index) => (
                <span
                  key={String(item)}
                  className={cn(item === "Important" && "font-semibold text-foreground")}
                >
                  {index > 0 && <span className="mx-1.5">·</span>}
                  {item === recurrenceLabel(rule) && repeats && (
                    <Repeat className="mr-1 inline h-3 w-3" strokeWidth={1.5} />
                  )}
                  {item}
                </span>
              ))}
            </div>
          )}
          {!expanded && latestStep && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 block max-w-full truncate text-left text-[12.5px] text-muted-foreground"
            >
              <span className="font-semibold text-foreground">Next:</span> {latestStep.body}
            </button>
          )}
        </div>

        {rightColumn && (
          <div className="col-start-2 pb-3 pr-2 text-left text-[12.5px] tabular-nums text-muted-foreground sm:col-start-3 sm:row-start-1 sm:pb-0 sm:pl-4 sm:pt-3 sm:text-right">
            <div
              className={cn(
                "whitespace-nowrap text-[13px] font-semibold",
                rightColumn.alert ? "text-alert" : "text-foreground",
              )}
            >
              {rightColumn.first}
            </div>
            {rightColumn.second && (
              <div
                className={cn(
                  "mt-0.5 whitespace-nowrap",
                  rightColumn.alert && showWaitingBadge && "text-alert",
                )}
              >
                {rightColumn.second}
              </div>
            )}
          </div>
        )}

        {expanded && (
          <div className="col-span-2 col-start-1 space-y-4 pb-[18px] pl-11 pr-0 sm:col-span-2 sm:col-start-2">
            <div className="border-l border-border pl-3">
              {steps.length === 0 ? (
                <p className="py-2 text-[13px] text-muted-foreground">No steps logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {steps.map((step) => (
                    <StepEntry
                      key={step.id}
                      body={step.body}
                      at={step.created_at}
                      onDelete={() => void deleteStepM.mutateAsync({ data: { id: step.id } })}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="flex max-w-[460px] border border-border bg-white">
              <Input
                value={stepDraft}
                maxLength={300}
                placeholder="Log the next step"
                onChange={(event) => setStepDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitStep();
                  }
                }}
                className="h-12 flex-1 border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 sm:h-10"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => void submitStep()}
                disabled={!stepDraft.trim() || addStepM.isPending}
                className="h-12 border-l border-border px-4 text-[11px] tracking-[0.14em] hover:bg-primary hover:text-primary-foreground sm:h-10"
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {showWaitingBadge && (
                <RowAction
                  onClick={() => {
                    setRemindDays(2);
                    setNudgeStep(nudgeContact?.phone || nudgeContact?.email ? "contact" : "status");
                  }}
                >
                  Follow up
                </RowAction>
              )}
              {overdue && <RowAction onClick={() => void moveToToday()}>Move to today</RowAction>}
              <RowAction onClick={() => setEditDetailsOpen((value) => !value)}>
                Edit details
              </RowAction>
              <RowAction onClick={() => setConfirmDelete(true)}>Delete</RowAction>
            </div>

            {editDetailsOpen && (
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <Label htmlFor={`t-${task.id}`} className="text-xs">
                    Title
                  </Label>
                  <Input
                    id={`t-${task.id}`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
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
                    onChange={(event) => setNotes(event.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as TaskStatus)}
                    >
                      <SelectTrigger className="mt-1 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={category ?? "__none"}
                      onValueChange={(value) =>
                        setCategory(value === "__none" ? null : (value as Category))
                      }
                    >
                      <SelectTrigger className="mt-1 h-10">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">None</SelectItem>
                        {CATEGORIES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={priority}
                      onValueChange={(value) => setPriority(value as Task["priority"])}
                    >
                      <SelectTrigger className="mt-1 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Normal", "Important", "Urgent"].map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Repeats</Label>
                  <RepeatField value={repeat} onChange={setRepeat} />
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
                      onChange={(event) => {
                        setDueDate(event.target.value);
                        if (!event.target.value) setDueTime("");
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
                      onChange={(event) => setDueTime(event.target.value)}
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
                      onChange={({ contactId: id, freeText: text }) => {
                        setContactId(id);
                        setFreeText(text);
                      }}
                    />
                  </div>
                </div>
                {task.source_type === "Voice" && (
                  <div className="border border-border px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">From voice note</span>
                      {task.voice_note_url && (
                        <Button type="button" size="sm" variant="ghost" onClick={playOriginal}>
                          <PlayCircle />
                          Play original
                        </Button>
                      )}
                    </div>
                    {task.raw_transcript && <p className="mt-2 italic">“{task.raw_transcript}”</p>}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditDetailsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={saveEdits}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
                <DialogTitle className="font-hero text-lg">
                  Reach out to {nudgeContact?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-1">
                {nudgeContact?.phone ? (
                  <>
                    <Button
                      asChild
                      className="h-11 w-full justify-start"
                      variant="secondary"
                      onClick={() => setNudgeStep("status")}
                    >
                      <a href={`tel:${nudgeContact.phone}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call {nudgeContact.phone}
                      </a>
                    </Button>
                    <Button
                      asChild
                      className="h-11 w-full justify-start"
                      variant="secondary"
                      onClick={() => setNudgeStep("status")}
                    >
                      <a href={`sms:${nudgeContact.phone}`}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Text {nudgeContact.phone}
                      </a>
                    </Button>
                  </>
                ) : nudgeContact?.email ? (
                  <Button
                    asChild
                    className="h-11 w-full justify-start"
                    variant="secondary"
                    onClick={() => setNudgeStep("status")}
                  >
                    <a href={`mailto:${nudgeContact.email}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Email {nudgeContact.email}
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No phone number saved for this contact.{" "}
                    <a href={`/contacts/${nudgeContact?.id ?? ""}`} className="underline">
                      Add phone number
                    </a>
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setNudgeStep("status")}>
                  Skip
                </Button>
              </DialogFooter>
            </>
          )}

          {nudgeStep === "status" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-hero text-lg">Update the status?</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-1">
                <p className="text-sm text-muted-foreground">
                  You just reached out — where does this stand now?
                </p>
                {(["In Progress", "Waiting on Someone", "Complete"] as TaskStatus[]).map((s) => (
                  <Button
                    key={s}
                    variant="secondary"
                    className="h-10 w-full justify-start"
                    onClick={async () => {
                      await setStatusTo(s);
                      setNudgeStep(s === "Complete" ? null : "reminder");
                      if (s === "Complete") toast.success("Marked Complete");
                    }}
                  >
                    <span className="mr-2 inline-flex">{STATUS_ICON[s]}</span>
                    Mark as {s}
                  </Button>
                ))}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="ghost" onClick={() => setNudgeStep("reminder")}>
                  Leave as is
                </Button>
              </DialogFooter>
            </>
          )}

          {nudgeStep === "reminder" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-hero text-lg">Remind you again?</DialogTitle>
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
                      setRemindDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))
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
            <AlertDialogTitle className="font-hero text-lg">
              {repeats ? "Delete which?" : "Delete this task?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {repeats
                ? `"${task.title}" repeats ${recurrenceLabel(rule)}.`
                : `"${task.title}" will be removed. You'll have a moment to undo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            {repeats ? (
              <>
                <AlertDialogAction
                  onClick={async () => {
                    setConfirmDelete(false);
                    await handleDelete("one");
                  }}
                >
                  Just this one
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={async () => {
                    setConfirmDelete(false);
                    await handleDelete("series");
                  }}
                >
                  Stop the series
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={async () => {
                  setConfirmDelete(false);
                  await handleDelete("one");
                }}
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** One timestamped entry in a task's step log. */
function RowAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="h-11 px-3 text-[11px] tracking-[0.14em] hover:bg-primary hover:text-primary-foreground sm:h-9"
    >
      {children}
    </Button>
  );
}

/** One timestamped entry in a task's step log. */
function StepEntry({
  body,
  at,
  onDelete,
}: {
  body: string;
  at: string;
  onDelete: () => void;
  latest?: boolean;
}) {
  return (
    <div className="group/step flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {new Date(at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-0.5 break-words text-[13.5px] leading-snug text-foreground">{body}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete this step"
        className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/step:opacity-100"
      >
        <X className="h-3 w-3" strokeWidth={2} />
      </button>
    </div>
  );
}
